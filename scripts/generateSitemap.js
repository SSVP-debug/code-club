/**
 * Generate the production sitemap before Vite copies public/ into dist/.
 *
 * Static pages are deliberately limited to useful, public, canonical pages.
 * Published opportunity detail pages are discovered from the public API at
 * build time. Private dashboards, auth flows, verification utilities, and
 * arbitrary route patterns are not sitemap URLs.
 *
 * Public profile URLs are not enumerated here yet: they need a privacy-aware
 * endpoint that returns only profiles whose owners opted into public visibility.
 * Never add the literal /u/:username route to a sitemap.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE_URL = (process.env.SITE_URL || "https://code-club-one.vercel.app").replace(/\/+$/, "");
const API_URL = (process.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const OUTPUT = resolve(process.cwd(), "public/sitemap.xml");

const STATIC_PAGES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/opportunities", changefreq: "daily", priority: "0.9" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, changefreq, priority, lastmod }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ].filter(Boolean).join("\n");
}

async function fetchPublishedOpportunities() {
  if (!API_URL) {
    console.warn("[sitemap] VITE_API_URL is not set; generating static-page sitemap only.");
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/api/opportunities`, {
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`[sitemap] Opportunity API returned HTTP ${response.status}; using static pages only.`);
      return [];
    }

    const payload = await response.json();
    const opportunities = Array.isArray(payload?.opportunities) ? payload.opportunities : [];

    return opportunities
      .filter((item) => Number.isInteger(Number(item?.ccNumber)) && Number(item.ccNumber) > 0)
      .map((item) => {
        const date = item.publishedAt ? new Date(item.publishedAt) : null;
        const lastmod = date && !Number.isNaN(date.getTime())
          ? date.toISOString().slice(0, 10)
          : undefined;

        return {
          loc: `${SITE_URL}/opportunities/${encodeURIComponent(String(Number(item.ccNumber)))}`,
          changefreq: "weekly",
          priority: "0.8",
          lastmod,
        };
      });
  } catch (error) {
    console.warn(`[sitemap] Could not fetch published opportunities (${error.message}); using static pages only.`);
    return [];
  }
}

const dynamicPages = await fetchPublishedOpportunities();
const entries = new Map();

for (const page of STATIC_PAGES) {
  const entry = { ...page, loc: `${SITE_URL}${page.path === "/" ? "/" : page.path}` };
  entries.set(entry.loc, entry);
}

for (const page of dynamicPages) {
  // The API only returns published, non-expired opportunities. Keep the map
  // as a second line of defense against duplicate URLs in malformed data.
  if (!entries.has(page.loc)) entries.set(page.loc, page);
}

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...[...entries.values()].map(urlEntry),
  "</urlset>",
  "",
].join("\n");

await writeFile(OUTPUT, xml, "utf8");
console.log(`[sitemap] Wrote ${entries.size} URLs to public/sitemap.xml (${dynamicPages.length} opportunity detail URLs).`);
