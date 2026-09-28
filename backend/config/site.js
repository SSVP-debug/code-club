/**
 * config/site.js — single source of truth for the deployed site URL and
 * support contact, backend side.
 *
 * Before this file, the real domain (code-club-one.vercel.app) and two
 * placeholder domains that don't exist (code-club.com, codeclub.in) were
 * scattered across ~8 files. Changing to a real custom domain, or setting
 * up a real support inbox, should now be a one-line edit here (or just
 * setting the env vars below) rather than a find-and-replace.
 */

// Reuses FRONTEND_URL, which already exists for CORS — see backend/.env.example.
export const SITE_URL = process.env.FRONTEND_URL || "https://code-club-one.vercel.app";

// TODO: not a real inbox yet — set SUPPORT_EMAIL once one exists.
// Referenced in TPO early-access messaging and PDF export footers.
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "connect.codeclub@gmail.com";
