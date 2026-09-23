import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import { logger } from "../config/logger.js";
import { createNotification } from "../services/notificationService.js";
import InstitutionBillingEvent from "../models/InstitutionBillingEvent.js";
import { B2B_BILLING_ENABLED } from "../config/featureFlags.js";
import { applyInstitutionWebhookEvent } from "../services/institutionBillingWebhookService.js";

const router = express.Router();

// ── Signature verification ───────────────────────────────────────────────
// Extracted as a standalone function (rather than inline in the route) so
// it can be unit-tested without constructing a real Express req/res.
export function isValidSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison — a plain !== leaks timing information about
  // how many leading bytes matched, which an attacker can use to forge a
  // valid signature byte-by-byte. Buffers are compared by length first
  // since crypto.timingSafeEqual throws on mismatched lengths rather than
  // returning false.
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return (
    signatureBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

// routes/billing.js's create-order attaches `notes: { userId, planId }` to
// every Razorpay order it creates. Razorpay copies an order's notes onto
// the payment entity created against it, so every payment/refund/dispute
// webhook for a payment we originated carries `userId`/`planId` straight
// in the body — no extra Razorpay API round trip needed to resolve "who is
// this about".
function getPaymentEntity(payload) {
  return payload?.payload?.payment?.entity || null;
}

function getNotes(entity) {
  return entity?.notes || {};
}

function getInstitutionContext(payload) {
  const payment = getPaymentEntity(payload);
  const subscription = payload?.payload?.subscription?.entity || null;
  const notes = payment?.notes || subscription?.notes || {};
  return {
    billingType: notes.billingType || null,
    collegeId: notes.collegeId || null,
  };
}

function getProviderEventId(req, payload) {
  return req.headers["x-razorpay-event-id"] || payload?.id || null;
}

function getWebhookSecretCandidates() {
  return [
    process.env.RAZORPAY_WEBHOOK_SECRET,
    process.env.RAZORPAY_B2B_WEBHOOK_SECRET,
  ].filter(Boolean);
}

async function applyInstitutionEventWithIdempotency(req, payload) {
  if (!B2B_BILLING_ENABLED) return false;

  const context = getInstitutionContext(payload);
  if (context.billingType !== "institution") return false;

  const providerEventId = getProviderEventId(req, payload);
  if (!providerEventId) {
    const err = new Error("Missing webhook event id");
    err.code = "MISSING_WEBHOOK_EVENT_ID";
    throw err;
  }

  const eventRecord = await InstitutionBillingEvent.findOneAndUpdate(
    { providerEventId },
    {
      $setOnInsert: {
        providerEventId,
        event: payload.event || "unknown",
        status: "received",
        receivedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (eventRecord.status === "processed") {
    return true;
  }

  try {
    await applyInstitutionWebhookEvent(payload);
    await InstitutionBillingEvent.updateOne(
      { _id: eventRecord._id },
      { $set: { status: "processed", processedAt: new Date(), lastError: null } }
    );
    return true;
  } catch (err) {
    await InstitutionBillingEvent.updateOne(
      { _id: eventRecord._id },
      { $set: { status: "failed", lastError: err?.message || "Webhook processing failed" } }
    ).catch(() => {});
    throw err;
  }
}

async function activateSubscription(user, planId) {
  const { PRICING } = await import("../config/featureFlags.js");
  const plan = PRICING[planId];
  if (!plan) {
    logger.warn({ planId }, "[BillingWebhook] unknown planId in payment notes — skipping activation");
    return;
  }

  const now = new Date();
  const expiresAt = plan.durationDays
    ? new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
    : null;

  user.subscription = {
    ...user.subscription,
    plan: planId,
    status: "active",
    startedAt: now,
    expiresAt,
  };
  await user.save();
}

async function revokeSubscription(user, { reason }) {
  user.subscription.status = "cancelled";
  user.subscription.cancelledAt = new Date();
  // Unlike POST /billing/cancel (which leaves expiresAt alone so access
  // continues until the period the user already paid for naturally ends),
  // a refund or dispute means that period is being clawed back — revoke
  // access immediately rather than at the original expiry.
  user.subscription.expiresAt = new Date();
  await user.save();
  logger.warn({ userId: user._id.toString(), reason }, "[BillingWebhook] revoked subscription");
}

// ── Event handlers ────────────────────────────────────────────────────────
// Each handler is intentionally tolerant of missing/unrecognized data
// (unknown user, no notes, unknown plan) — a webhook handler must never
// throw on a payload shape it doesn't fully recognize, since Razorpay
// sends the same event types to every merchant and not every payment on
// the account is guaranteed to have originated from our /create-order flow
// (e.g. a manual payment link created from the Razorpay dashboard).

/**
 * payment.captured — backup activation path. The primary path is
 * POST /api/billing/verify, called by the frontend immediately after
 * checkout completes. This covers the case where that round trip never
 * happens (tab closed, network drop right after payment) by activating
 * from the webhook instead. Safe to run even if /verify already activated
 * the same plan — it's a no-op in that case.
 */
async function handlePaymentCaptured(payload) {
  const payment = getPaymentEntity(payload);
  const { userId, planId } = getNotes(payment);
  if (!userId || !planId) {
    logger.debug(
      { paymentId: payment?.id },
      "[BillingWebhook] payment.captured with no userId/planId in notes — not one of our checkout orders, skipping"
    );
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    logger.warn({ userId }, "[BillingWebhook] payment.captured for unknown user — skipping");
    return;
  }

  if (user.subscription?.status === "active" && user.subscription?.plan === planId) {
    return; // already activated via /verify — nothing to do
  }

  await activateSubscription(user, planId);
  logger.info({ userId, planId }, "[BillingWebhook] activated subscription via payment.captured backup path");
}

/**
 * payment.failed — never activated a plan in the first place (activation
 * only happens in /verify or handlePaymentCaptured above), so there's no
 * subscription state to revert. Logged so failed-payment/renewal patterns
 * are visible without digging through the Razorpay dashboard.
 */
function handlePaymentFailed(payload) {
  const payment = getPaymentEntity(payload);
  const { userId, planId } = getNotes(payment);
  logger.info({ userId, planId, paymentId: payment?.id }, "[BillingWebhook] payment.failed");
}

/**
 * refund.created / refund.processed — this is the concrete gap the staff
 * review called out: a refund issued from the Razorpay dashboard or via a
 * support ticket has no client round-trip at all, so subscription.status
 * previously only ever changed via the user-initiated /billing/cancel
 * route. A refund means access should end now, not "keep working until
 * natural expiry" the way a self-serve cancellation does.
 */
async function handleRefund(payload) {
  const payment = getPaymentEntity(payload);
  const { userId } = getNotes(payment);
  if (!userId) {
    logger.warn({ paymentId: payment?.id }, "[BillingWebhook] refund event with no userId in notes — skipping");
    return;
  }

  const user = await User.findById(userId);
  if (!user) return;

  await revokeSubscription(user, { reason: "refund" });

  await createNotification({
    userId,
    type: "subscription_refunded",
    title: "Your subscription was refunded",
    message: "A refund was processed for your Code Club payment, so premium access has ended.",
  }).catch((err) => logger.error({ err, userId }, "[BillingWebhook] notification failed after refund"));
}

/**
 * payment.dispute.created — a chargeback is in progress. Revoke access
 * immediately rather than waiting for the dispute to resolve; if it's
 * later resolved in the merchant's favor there's no automated
 * reinstatement — that's a manual support action, deliberately, since it
 * involves a human judgment call.
 */
async function handleDisputeCreated(payload) {
  const payment = getPaymentEntity(payload);
  const { userId } = getNotes(payment);
  if (!userId) return;

  const user = await User.findById(userId);
  if (!user) return;

  await revokeSubscription(user, { reason: "dispute" });
}

const EVENT_HANDLERS = {
  "payment.captured": handlePaymentCaptured,
  "payment.failed": handlePaymentFailed,
  "refund.created": handleRefund,
  "refund.processed": handleRefund,
  "payment.dispute.created": handleDisputeCreated,
};

/**
 * Dispatches a verified, parsed webhook payload to the right handler.
 * Exported separately from the route handler so it can be unit-tested
 * directly, without needing to construct a real Express req/res carrying a
 * raw Buffer body and a valid HMAC signature.
 */
export async function applyWebhookEvent(payload) {
  const handler = EVENT_HANDLERS[payload?.event];
  if (!handler) {
    logger.debug({ event: payload?.event }, "[BillingWebhook] unhandled event type — no-op");
    return;
  }
  await handler(payload);
}

router.post("/", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secrets = getWebhookSecretCandidates();

    if (!secrets.length || !secrets.some((secret) => isValidSignature(req.body, signature, secret))) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const payload = JSON.parse(req.body.toString());
    logger.info({ event: payload.event }, "[BillingWebhook] received");

    // Institution webhooks use the same public endpoint but a distinct
    // billingType marker and their own idempotency ledger. Razorpay documents
    // duplicate delivery and recommends using x-razorpay-event-id.
    if (await applyInstitutionEventWithIdempotency(req, payload)) {
      return res.json({ success: true });
    }

    // Apply consumer events before responding so handler failures produce a
    // non-2xx response and Razorpay can retry them safely.
    await applyWebhookEvent(payload);

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[BillingWebhook] error");
    return res.status(500).json({ success: false });
  }
});

export default router;
