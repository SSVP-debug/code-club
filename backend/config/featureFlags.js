/**
 * Feature Flags — Code Club
 *
 * MONETIZATION_ENABLED controls the entire payment/paywall system.
 * Default: false (off). The product has zero real users yet — pricing,
 * paywalls, and upgrade prompts are fully built but invisible until
 * this flag is flipped to "true" in production env vars.
 *
 * This lets the team ship Phase 6 code now and turn on monetization
 * later with zero additional deploys — just an env var change.
 */
export const MONETIZATION_ENABLED = process.env.MONETIZATION_ENABLED === "true";

/**
 * B2B_ENABLED controls TPO/college admin features.
 * Can be enabled independently of consumer monetization — a college
 * pilot can go live before individual subscriptions do.
 */
export const B2B_ENABLED = process.env.B2B_ENABLED === "true";

/**
 * B2B_BILLING_ENABLED controls institution subscription enforcement.
 * It is intentionally separate from B2B_ENABLED: colleges can run free
 * pilots while the commercial entitlement layer is being prepared.
 */
export const B2B_BILLING_ENABLED = process.env.B2B_BILLING_ENABLED === "true";

/**
 * OPPORTUNITY_RADAR_ENABLED controls the public-facing Opportunity Radar
 * (/opportunities, /opportunities/:ccId). Admin management
 * (/admin/opportunities) always works regardless of this flag — admins
 * need to be able to draft/verify/build up curated content *before*
 * flipping the public site live, same reasoning as MONETIZATION_ENABLED
 * above (pricing pages built and gated ahead of going live).
 */
export const OPPORTUNITY_RADAR_ENABLED = process.env.OPPORTUNITY_RADAR_ENABLED === "true";

/**
 * Pricing — single source of truth, read by both backend (webhook/order
 * creation) and exposed via /api/billing/plans for frontend display.
 * All prices in paise (Razorpay's smallest unit) — 100 paise = ₹1.
 */
/**
 * Institutional B2B pricing — amounts in paise.
 * These are intentionally separate from consumer PRICING because the
 * institution is the paying entity and the entitlement belongs to College.
 */
export const B2B_PRICING = {
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
};

export const PRICING = {
  pro_monthly: {
    label: "Pro Monthly",
    amountPaise: 19900,        // ₹199
    interval: "monthly",
    durationDays: 30,
  },
  pro_yearly: {
    label: "Pro Yearly",
    amountPaise: 199900,       // ₹1,999
    interval: "yearly",
    durationDays: 365,
  },
  founding_lifetime: {
    label: "Founding Lifetime",
    amountPaise: 199900,       // ₹1,999 — first 500 users only
    interval: "lifetime",
    durationDays: null,        // never expires
    maxRedemptions: 500,
  },
  lifetime: {
    label: "Lifetime",
    amountPaise: 299900,       // ₹2,999 (post-founding-batch price)
    interval: "lifetime",
    durationDays: null,
  },
};

export const REFERRAL_REWARD_DAYS = 7; // both referrer and referee get 7 days
