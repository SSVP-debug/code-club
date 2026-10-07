import { Router } from "express";
import { createRequire } from "module";
import { isUserPremium } from "./billing.js";
import { PREMIUM_FEATURES } from "../middleware/premiumGate.js";
import { SITE_URL } from "../config/site.js";
import { getLevel } from "../utils/xpLevel.js";
import { topicStatsToObject } from "../utils/topicStats.js";
import { getSolvedSlugs } from "../services/problemProgressService.js";

const require = createRequire(import.meta.url);
const router  = Router();

router.get("/", async (req, res) => {
  let PDFDocument;
  try {
    PDFDocument = require("pdfkit");
  } catch {
    return res.status(503).json({
      error: "PDF generation unavailable. pdfkit not installed.",
      install: "cd backend && npm install pdfkit",
    });
  }

  try {
    const user = req.userDoc;
    if (!user) return res.status(503).json({ error: "Database unavailable." });

    // ── Free tier: 1 PDF download/month. Premium: unlimited. ────────────────
    if (!isUserPremium(user)) {
      const thisMonth = new Date().toISOString().slice(0, 7); // "2026-06"
      const log = user.pdfDownloadLog || {};
      const usedThisMonth = log.month === thisMonth ? (log.count || 0) : 0;

      if (usedThisMonth >= PREMIUM_FEATURES.PROFILE_PDF_UNLIMITED.freeLimitPerMonth) {
        return res.status(402).json({
          error: "Free plan includes 1 profile PDF download/month. Upgrade to Pro for unlimited downloads.",
          upgradeUrl: "/pricing",
        });
      }

      user.pdfDownloadLog = { month: thisMonth, count: usedThisMonth + 1 };
      await user.save();
    }

    const level        = getLevel(user.totalXP || 0);
    const solvedSlugs = await getSolvedSlugs(user._id);
    const solved       = solvedSlugs.length;
    const easy         = user.solvedDifficulty?.easy   ?? 0;
    const medium       = user.solvedDifficulty?.medium ?? 0;
    const hard         = user.solvedDifficulty?.hard   ?? 0;
    const streak       = user.currentStreak   ?? 0;
    const bestStreak   = user.longestStreak   ?? 0;
    const topicStats   = topicStatsToObject(user.topicStats);
    const recentSolves = (user.recentActivity || []).slice(0, 10);
    const profileUrl   = `${SITE_URL}/u/${user.username || "anonymous"}`;

    // ── Build PDF ─────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: "A4", margin: 50, info: {
      Title:   `${user.displayName ?? "Anonymous"} — Code Club Profile`,
      Author:  "Code Club",
      Subject: "DSA Practice Profile",
    }});

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${(user.username || "profile").replace(/[^a-z0-9]/gi,"_")}_codeclub.pdf"`
    );
    doc.pipe(res);

    // ── Header bar ────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 90).fill("#18181b");
    doc.fontSize(24).fillColor("#22c55e").font("Helvetica-Bold")
       .text("Code Club", 50, 28);
    doc.fontSize(10).fillColor("#71717a").font("Helvetica")
       .text("DSA Practice Profile", 50, 56);
    doc.fontSize(10).fillColor("#52525b")
       .text(new Date().toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }),
             doc.page.width - 200, 56, { align: "right", width: 150 });

    // ── Name & username ───────────────────────────────────────────────────
    doc.moveDown(2);
    doc.fontSize(22).fillColor("#ffffff").font("Helvetica-Bold")
       .text(user.displayName ?? "Anonymous", 50, 110);
    doc.fontSize(12).fillColor("#71717a").font("Helvetica")
       .text(`@${user.username ?? "unknown"} · Level ${level} · ${SITE_URL.replace("https://","")}`, 50, 138);

    // Divider
    doc.moveTo(50, 162).lineTo(doc.page.width - 50, 162).strokeColor("#27272a").lineWidth(1).stroke();

    // ── Stats row ─────────────────────────────────────────────────────────
    const stats = [
      { label: "Problems Solved", value: solved },
      { label: "Current Streak",  value: `${streak} days` },
      { label: "Best Streak",     value: `${bestStreak} days` },
      { label: "Total XP",        value: (user.totalXP || 0).toLocaleString() },
    ];

    let sx = 50;
    stats.forEach(s => {
      doc.fontSize(20).fillColor("#22c55e").font("Helvetica-Bold").text(String(s.value), sx, 175);
      doc.fontSize(9).fillColor("#71717a").font("Helvetica").text(s.label, sx, 200);
      sx += 125;
    });

    // Divider
    doc.moveTo(50, 225).lineTo(doc.page.width - 50, 225).strokeColor("#27272a").lineWidth(1).stroke();

    // ── Difficulty breakdown ──────────────────────────────────────────────
    doc.fontSize(11).fillColor("#a1a1aa").font("Helvetica-Bold").text("DIFFICULTY BREAKDOWN", 50, 240);
    const diffs = [
      { label: "Easy",   count: easy,   color: "#22c55e" },
      { label: "Medium", count: medium, color: "#f59e0b" },
      { label: "Hard",   count: hard,   color: "#ef4444" },
    ];
    let dx = 50;
    diffs.forEach(d => {
      doc.rect(dx, 258, 140, 36).fill("#27272a");
      doc.fontSize(18).fillColor(d.color).font("Helvetica-Bold").text(String(d.count), dx + 12, 262);
      doc.fontSize(9).fillColor("#71717a").font("Helvetica").text(d.label, dx + 12, 283);
      dx += 155;
    });

    // ── Topic breakdown ───────────────────────────────────────────────────
    doc.fontSize(11).fillColor("#a1a1aa").font("Helvetica-Bold").text("STRONGEST TOPICS", 50, 315);
    const topics = Object.entries(topicStats).sort((a,b) => b[1]-a[1]).slice(0, 8);
    let ty = 332;
    topics.forEach(([topic, count], i) => {
      const barW = Math.min(300, Math.round((count / (topics[0]?.[1] || 1)) * 280));
      doc.rect(50, ty, barW, 12).fill(i === 0 ? "#22c55e" : "#27272a");
      doc.fontSize(9).fillColor("#e4e4e7").font("Helvetica")
         .text(`${topic}  (${count})`, 360, ty + 1);
      ty += 20;
    });

    // ── Recent solves ─────────────────────────────────────────────────────
    ty += 12;
    doc.fontSize(11).fillColor("#a1a1aa").font("Helvetica-Bold").text("RECENT SOLVES", 50, ty);
    ty += 18;
    const diffColors = { Easy:"#22c55e", Medium:"#f59e0b", Hard:"#ef4444" };
    recentSolves.forEach(s => {
      doc.fontSize(9).fillColor(diffColors[s.difficulty] ?? "#71717a").font("Helvetica-Bold")
         .text(`[${(s.difficulty||"?").slice(0,1)}]`, 50, ty);
      doc.fillColor("#d4d4d8").font("Helvetica")
         .text(s.title || s.slug, 72, ty);
      ty += 16;
      if (ty > doc.page.height - 100) {
        doc.addPage();
        ty = 50;
      }
    });

    // ── Footer ────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 60;
    doc.moveTo(50, footerY - 8).lineTo(doc.page.width - 50, footerY - 8)
       .strokeColor("#27272a").lineWidth(1).stroke();
    doc.fontSize(9).fillColor("#52525b").font("Helvetica")
       .text(`Verify at: ${profileUrl}`, 50, footerY, { link: profileUrl });
    doc.text(`Generated by Code Club · ${SITE_URL.replace("https://","")}`, doc.page.width/2, footerY, { align: "center", width: doc.page.width - 100 });

    doc.end();

  } catch (err) {
    req.log.error({ err }, "[ProfilePDF] error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF." });
    }
  }
});

export default router;