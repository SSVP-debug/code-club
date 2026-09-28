/**
 * config/site.js — single source of truth for the deployed site URL and
 * support contact, frontend side.
 *
 * Before this file, the real domain (code-club-one.vercel.app) and two
 * placeholder domains that don't exist (code-club.com, codeclub.in) were
 * scattered across several pages. Changing to a real custom domain, or
 * setting up a real support inbox, should now be a one-line edit here
 * rather than a find-and-replace across pages.
 */

export const SITE_URL = "https://code-club-one.vercel.app"; // update when a custom domain is set

// TODO: not a real inbox yet — update once one exists.
export const SUPPORT_EMAIL = "connect.codeclub@gmail.com";

// Domain only, no protocol — for display copy like "share your profile at ___".
export const SITE_DOMAIN = SITE_URL.replace(/^https?:\/\//, "");

/**
 * Official Code Club community/contact channels (WhatsApp, Discord, email
 * for general inquiries) — shown in the landing footer and the Club
 * community hub.
 *
 * Deliberately separate from SUPPORT_EMAIL above: SUPPORT_EMAIL is the
 * legal/support inbox referenced in Privacy/Terms and TPO messaging, while
 * CONTACT_EMAIL here is the public "get in touch" channel alongside
 * WhatsApp/Discord. They may end up pointing at the same inbox one day,
 * but that's an operational decision, not a code one — keeping them as
 * separate env vars means changing one doesn't silently change the other.
 *
 * Every value here is read from an env var with no hardcoded fallback, on
 * purpose: unlike SITE_URL/SUPPORT_EMAIL (which have a real deployed
 * default), these three are genuinely optional. Consumers (ContactChannels
 * component) treat a missing value as "channel not configured" and hide
 * that option rather than rendering a dead link — see the null checks
 * below and the *_CONFIGURED flags.
 */
const rawWhatsapp = import.meta.env.VITE_CODECLUB_WHATSAPP || null;

// wa.me needs digits only (country code + number, no "+", spaces, or
// dashes) — normalize once here so every consumer gets a working link
// regardless of how the number is formatted in the env var.
export const WHATSAPP_NUMBER = rawWhatsapp;
export const WHATSAPP_LINK = rawWhatsapp
  ? `https://wa.me/${rawWhatsapp.replace(/[^\d]/g, "")}`
  : null;

export const DISCORD_INVITE_URL = import.meta.env.VITE_CODECLUB_DISCORD || null;

export const CONTACT_EMAIL = import.meta.env.VITE_CODECLUB_EMAIL || null;
export const CONTACT_EMAIL_LINK = CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : null;

/**
 * Public social profiles (GitHub org, X/Twitter, LinkedIn company page) —
 * shown as icon links in the landing footer's social row. Same
 * "unconfigured = hidden, never a dead link" contract as the channels
 * above, so a fresh clone with no .env doesn't ship broken social icons.
 */
export const GITHUB_URL = import.meta.env.VITE_CODECLUB_GITHUB || null;
export const TWITTER_URL = import.meta.env.VITE_CODECLUB_TWITTER || null;
export const LINKEDIN_URL = import.meta.env.VITE_CODECLUB_LINKEDIN || null;