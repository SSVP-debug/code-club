import { describe, expect, it, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("../models/College.js", () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock("../models/InstitutionBillingEvent.js", () => ({
  default: {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("../config/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../config/featureFlags.js", () => ({
  B2B_BILLING_ENABLED: true,
  B2B_PRICING: {
    college_monthly: {
      label: "College Monthly",
      amountPaise: 99900,
      interval: "monthly",
      durationDays: 30,
    },
    college_yearly: {
      label: "College Yearly",
      amountPaise: 999900,
      interval: "yearly",
      durationDays: 365,
    },
  },
}));

import College from "../models/College.js";
import InstitutionBillingEvent from "../models/InstitutionBillingEvent.js";
import { isValidInstitutionWebhookSignature, applyInstitutionWebhookEvent } from "../services/institutionBillingWebhookService.js";

function college(overrides = {}) {
  return {
    _id: "college1",
    status: "verified",
    subscription: {
      plan: "college_monthly",
      status: "active",
      startedAt: new Date("2026-09-01T00:00:00Z"),
      expiresAt: new Date("2026-10-01T00:00:00Z"),
      cancelledAt: null,
      provider: "razorpay",
      providerOrderId: "order_old",
      providerPaymentId: "pay_old",
      providerSubscriptionId: null,
      lastPaymentAt: new Date("2026-09-01T00:00:00Z"),
    },
    save: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function paymentPayload({
  event = "payment.captured",
  collegeId = "507f1f77bcf86cd799439011",
  planId = "college_monthly",
  paymentId = "pay_new",
  orderId = "order_new",
} = {}) {
  return {
    event,
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          notes: {
            billingType: "institution",
            collegeId,
            planId,
          },
        },
      },
    },
  };
}

describe("institution webhook signature", () => {
  it("accepts the correct raw-body HMAC and rejects tampering", () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const secret = "b2b_secret";
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");

    expect(isValidInstitutionWebhookSignature(body, signature, secret)).toBe(true);
    expect(isValidInstitutionWebhookSignature(Buffer.from("{}"), signature, secret)).toBe(false);
  });
});

describe("institution webhook event application", () => {
  beforeEach(() => vi.clearAllMocks());

  it("activates a verified college from payment.captured", async () => {
    const doc = college({ subscription: { plan: "none", status: "none" } });
    College.findById.mockResolvedValue(doc);

    await applyInstitutionWebhookEvent(paymentPayload());

    expect(doc.subscription.plan).toBe("college_monthly");
    expect(doc.subscription.status).toBe("active");
    expect(doc.subscription.providerPaymentId).toBe("pay_new");
    expect(doc.save).toHaveBeenCalledOnce();
  });

  it("does not extend the same payment twice", async () => {
    const doc = college();
    College.findById.mockResolvedValue(doc);

    await applyInstitutionWebhookEvent(
      paymentPayload({ paymentId: "pay_old", orderId: "order_old" })
    );

    expect(doc.save).not.toHaveBeenCalled();
  });

  it("revokes institutional access on refund", async () => {
    const doc = college();
    College.findById.mockResolvedValue(doc);

    await applyInstitutionWebhookEvent(
      paymentPayload({ event: "refund.processed" })
    );

    expect(doc.subscription.status).toBe("cancelled");
    expect(doc.subscription.expiresAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalledOnce();
  });

  it("maps a halted provider subscription to expired", async () => {
    const doc = college();
    College.findById.mockResolvedValue(doc);

    await applyInstitutionWebhookEvent({
      event: "subscription.halted",
      payload: {
        subscription: {
          entity: {
            id: "sub_1",
            status: "halted",
            current_end: 1790000000,
            notes: { collegeId: "507f1f77bcf86cd799439011" },
          },
        },
      },
    });

    expect(doc.subscription.status).toBe("expired");
    expect(doc.subscription.providerSubscriptionId).toBe("sub_1");
    expect(doc.save).toHaveBeenCalledOnce();
  });

  it("ignores unrecognized events", async () => {
    await expect(
      applyInstitutionWebhookEvent({ event: "something.unknown", payload: {} })
    ).resolves.not.toThrow();
    expect(College.findById).not.toHaveBeenCalled();
  });
});
