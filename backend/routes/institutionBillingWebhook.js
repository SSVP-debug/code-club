import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import College from "../models/College.js";
import InstitutionBillingEvent from "../models/InstitutionBillingEvent.js";
import { B2B_BILLING_ENABLED, B2B_PRICING } from "../config/featureFlags.js";
import { logger } from "../config/logger.js";

const router = express.Router();

export function isValidInstitutionWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    received.length === expectedBuffer.length &&
    crypto.timingSafeEqual(received, expectedBuffer)
  );
}

function getPaymentEntity(payload) {
  return payload?.payload?.payment?.entity || null;
}

function getSubscriptionEntity(payload) {
  return payload?.payload?.subscription?.entity || null;
}

function getNotes(payload) {
  return getPaymentEntity(payload)?.notes || getSubscriptionEntity(payload)?.notes || {};
}

function getContext(payload) {
  const payment = getPaymentEntity(payload);
  const subscription = getSubscriptionEntity(payload);
  const notes = getNotes(payload);

  return {
    collegeId: notes.collegeId || null,
    planId: notes.planId || null,
    billingType: notes.billingType || null,
    providerOrderId: payment?.order_id || notes.providerOrderId || null,
    providerPaymentId: payment?.id || null,
    providerSubscriptionId: subscription?.id || null,
  };
}

function getProviderEventId(req, payload) {
  return req.headers["x-razorpay-event-id"] || payload?.id || null;
}

function getPlanDurationMs(planId) {
  const plan = B2B_PRICING[planId];
  if (!plan?.durationDays) return null;
  return plan.durationDays * 24 * 60 * 60 * 1000;
}

function isKnownPlan(planId) {
  return Boolean(planId && B2B_PRICING[planId]);
}

async function findInstitution(collegeId) {
  if (!collegeId || !mongoose.isValidObjectId(collegeId)) return null;
  const college = await College.findById(collegeId);
  if (!college || college.status !== "verified") return null;
  return college;
}

async function activateInstitutionFromPayment(context) {
  if (context.billingType !== "institution" || !context.collegeId || !isKnownPlan(context.planId)) {
    return;
  }

  const college = await findInstitution(context.collegeId);
  if (!college) {
    logger.warn({ collegeId: context.collegeId }, "[InstitutionBillingWebhook] payment for unknown/unverified college");
    return;
  }

  const now = new Date();
  const current = college.subscription || {};
  const durationMs = getPlanDurationMs(context.planId);

  // The checkout /verify path may already have activated this payment.
  // Never extend the same paid period twice when Razorpay retries a webhook.
  if (
    current.providerPaymentId === context.providerPaymentId &&
    current.plan === context.planId &&
    current.status === "active"
  ) {
    return;
  }

  college.subscription = {
    ...current,
    plan: context.planId,
    status: "active",
    startedAt: current.status === "active" && current.startedAt ? current.startedAt : now,
    expiresAt: durationMs ? new Date(now.getTime() + durationMs) : null,
    cancelledAt: null,
    provider: "razorpay",
    providerOrderId: context.providerOrderId || current.providerOrderId || null,
    providerPaymentId: context.providerPaymentId || current.providerPaymentId || null,
    providerSubscriptionId: context.providerSubscriptionId || current.providerSubscriptionId || null,
    lastPaymentAt: now,
  };

  await college.save();
  logger.info(
    {
      collegeId: college._id.toString(),
      planId: context.planId,
      paymentId: context.providerPaymentId,
    },
    "[InstitutionBillingWebhook] institution subscription activated"
  );
}

async function handlePaymentFailed(context) {
  if (context.billingType !== "institution") return;
  logger.info(
    {
      collegeId: context.collegeId,
      planId: context.planId,
      paymentId: context.providerPaymentId,
    },
    "[InstitutionBillingWebhook] institution payment.failed"
  );
}

async function handleRefundOrDispute(context, reason) {
  if (context.billingType !== "institution" || !context.collegeId) return;

  const college = await findInstitution(context.collegeId);
  if (!college) return;

  college.subscription.status = "cancelled";
  college.subscription.cancelledAt = new Date();
  college.subscription.expiresAt = new Date();
  await college.save();

  logger.warn(
    { collegeId: college._id.toString(), reason, paymentId: context.providerPaymentId },
    "[InstitutionBillingWebhook] institution entitlement revoked"
  );
}

async function handleSubscriptionEvent(payload) {
  const subscription = getSubscriptionEntity(payload);
  const notes = subscription?.notes || {};
  const collegeId = notes.collegeId;
  const college = await findInstitution(collegeId);
  if (!college || !subscription?.id) return;

  const providerSubscriptionId = subscription.id;
  const status = subscription.status;

  if (status === "active") {
    college.subscription.status = "active";
    college.subscription.provider = "razorpay";
    college.subscription.providerSubscriptionId = providerSubscriptionId;
    college.subscription.cancelledAt = null;
    if (subscription.current_end) {
      college.subscription.expiresAt = new Date(subscription.current_end * 1000);
    }
    await college.save();
    return;
  }

  if (status === "cancelled") {
    college.subscription.status = "cancelled";
    college.subscription.cancelledAt = subscription.ended_at
      ? new Date(subscription.ended_at * 1000)
      : new Date();
    college.subscription.provider = "razorpay";
    college.subscription.providerSubscriptionId = providerSubscriptionId;
    if (subscription.current_end) {
      college.subscription.expiresAt = new Date(subscription.current_end * 1000);
    }
    await college.save();
    return;
  }

  if (status === "halted" || status === "expired" || status === "completed") {
    college.subscription.status = "expired";
    college.subscription.expiresAt = subscription.current_end
      ? new Date(subscription.current_end * 1000)
      : new Date();
    college.subscription.provider = "razorpay";
    college.subscription.providerSubscriptionId = providerSubscriptionId;
    await college.save();
  }
}

export async function applyInstitutionWebhookEvent(payload) {
  const event = payload?.event;
  const context = getContext(payload);

  switch (event) {
    case "payment.captured":
      await activateInstitutionFromPayment(context);
      return;
    case "payment.failed":
      await handlePaymentFailed(context);
      return;
    case "refund.created":
    case "refund.processed":
      await handleRefundOrDispute(context, "refund");
      return;
    case "payment.dispute.created":
      await handleRefundOrDispute(context, "dispute");
      return;
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.cancelled":
    case "subscription.completed":
    case "subscription.expired":
      await handleSubscriptionEvent(payload);
      return;
    default:
      logger.debug({ event }, "[InstitutionBillingWebhook] unhandled event");
  }
}

router.post("/", async (req, res) => {
  if (!B2B_BILLING_ENABLED) {
    return res.status(200).json({ success: true, enabled: false });
  }

  try {
    const signature = req.headers["x-razorpay-signature"];
    if (
      !isValidInstitutionWebhookSignature(
        req.body,
        signature,
        process.env.RAZORPAY_B2B_WEBHOOK_SECRET
      )
    ) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const payload = JSON.parse(req.body.toString());
    const providerEventId = getProviderEventId(req, payload);
    if (!providerEventId) {
      return res.status(400).json({ success: false, message: "Missing webhook event id" });
    }

    const context = getContext(payload);
    const eventRecord = await InstitutionBillingEvent.findOneAndUpdate(
      { providerEventId },
      {
        $setOnInsert: {
          providerEventId,
          event: payload.event || "unknown",
          collegeId: mongoose.isValidObjectId(context.collegeId) ? context.collegeId : null,
          providerOrderId: context.providerOrderId,
          providerPaymentId: context.providerPaymentId,
          providerSubscriptionId: context.providerSubscriptionId,
          status: "received",
          receivedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (eventRecord.status === "processed") {
      return res.json({ success: true, duplicate: true });
    }

    try {
      await applyInstitutionWebhookEvent(payload);
      await InstitutionBillingEvent.updateOne(
        { _id: eventRecord._id },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
            lastError: null,
          },
        }
      );
      return res.json({ success: true });
    } catch (err) {
      await InstitutionBillingEvent.updateOne(
        { _id: eventRecord._id },
        {
          $set: {
            status: "failed",
            lastError: err?.message || "Webhook processing failed",
          },
        }
      ).catch(() => {});
      throw err;
    }
  } catch (err) {
    logger.error({ err }, "[InstitutionBillingWebhook] error");
    return res.status(500).json({ success: false });
  }
});

export default router;
