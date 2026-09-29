import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import SectionCard from "../components/ui/layout/SectionCard";
import Button from "../components/ui/Button";
import ContactChannels from "../components/common/ContactChannels";
import { WHATSAPP_LINK, DISCORD_INVITE_URL, CONTACT_EMAIL_LINK } from "../config/site.js";
import { apiFetch } from "../services/api";
import { useTheme } from "../hooks/useTheme";
import { withAlpha } from "../themes/themeIcons";
import { Trophy, Swords, Lock, Users, ArrowRight, GraduationCap, Medal, MessageCircle, Puzzle, Coins, Lightbulb } from "lucide-react";

const MEDAL_COLOR = { 1: "text-yellow-400", 2: "text-[var(--muted-foreground)]", 3: "text-orange-700" };

/**
 * ClubPage — the community hub (Phase 12A).
 *
 * Deliberately stays a hub, not a single long page (Bunny's routing
 * decision) — Leaderboard, Public Contests, and Private Contests each get
 * their own dedicated route under /club/*. This page shows summary
 * previews + quick actions and links out.
 *
 * The "active private contests" preview is intentionally an empty-state
 * CTA, not live data — there's no "contests I've joined" endpoint yet
 * (GET /api/contests only filters by status/type, not by participant).
 * Faking that card with placeholder numbers would look like a real
 * feature that silently does nothing; an honest CTA doesn't.
 */
function ClubPage() {
  const { theme } = useTheme();
  const [topThree, setTopThree] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const [contests, setContests] = useState([]);
  const [contestsLoading, setContestsLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/leaderboard/global?limit=3")
      .then((d) => setTopThree(d.users || []))
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));

    apiFetch("/api/contests?status=active,upcoming&type=public")
      .then((d) => setContests((d.contests || []).slice(0, 3)))
      .catch(() => {})
      .finally(() => setContestsLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Club</h1>
          <p className="text-[var(--muted-foreground)] mt-2">
            Where the Code Club community competes, connects, and grows.
          </p>
        </div>

        {/* ── Leaderboard preview ─────────────────────────────────────── */}
        <SectionCard
          title="Leaderboard"
          subtitle="Top performers right now"
          icon={<Trophy size={18} strokeWidth={2} />}
          accented
          action={
            <Link
              to="/club/leaderboard"
              className="text-sm hover:brightness-110 transition inline-flex items-center gap-1"
              style={{ color: theme.colors.primary }}
            >
              View full leaderboard <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          {leaderboardLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-[var(--surface-elevated)] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : topThree.length === 0 ? (
            <p className="text-[var(--muted-foreground)] text-sm py-2">
              No rankings yet — be the first to solve a problem.
            </p>
          ) : (
            <div className="space-y-2">
              {topThree.map((user) => (
                <Link
                  key={user.username}
                  to={`/u/${user.username}`}
                  className="flex items-center gap-3 bg-[var(--surface-elevated)] hover:bg-[var(--surface-elevated)]/70 rounded-xl px-4 py-2.5 transition"
                >
                  <span className={`w-6 text-center flex-shrink-0 flex items-center justify-center ${MEDAL_COLOR[user.rank] || "text-[var(--muted-foreground)]"}`}>
                    <Medal size={16} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="font-medium text-sm truncate flex-1">
                    {user.displayName}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0">
                    {user.totalXP.toLocaleString()} XP
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Public Contests preview ─────────────────────────────── */}
          <SectionCard
            title="Public Contests"
            subtitle="Compete live, race the clock"
            icon={<Swords size={18} strokeWidth={2} />}
            accented
          >
            {contestsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 bg-[var(--surface-elevated)] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : contests.length === 0 ? (
              <p className="text-[var(--muted-foreground)] text-sm py-2">
                No contests live or upcoming right now.
              </p>
            ) : (
              <div className="space-y-2 mb-4">
                {contests.map((c) => (
                  <Link
                    key={c._id}
                    to={`/club/public-contests/${c._id}`}
                    className="block bg-[var(--surface-elevated)] hover:bg-[var(--surface-elevated)]/70 rounded-xl px-4 py-2.5 transition"
                  >
                    <p className="text-sm font-medium truncate">{c.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                      {c.isActive ? "Live now" : `Starts ${new Date(c.startsAt).toLocaleDateString()}`}
                      {" · "}{c.problemCount} problems
                    </p>
                  </Link>
                ))}
              </div>
            )}
            <Button to="/club/public-contests" variant="theme" size="sm">
              Browse all contests
            </Button>
          </SectionCard>

          {/* ── Private Contests hub ────────────────────────────────── */}
          <SectionCard
            title="Private Contests"
            subtitle="Host or join with friends"
            icon={<Lock size={18} strokeWidth={2} />}
            accented
          >
            <p className="text-[var(--muted-foreground)] text-sm mb-4">
              Have an invite code from a friend or your college? Join instantly
              or set up your own contest to run.
            </p>
            <div className="flex gap-2">
              <Button to="/club/private-contests" variant="theme" size="sm" className="flex-1">
                Join with code
              </Button>
              <Button to="/club/private-contests" variant="secondary" size="sm" className="flex-1">
                Host a contest
              </Button>
            </div>
          </SectionCard>
        </div>

        {/* ── Battle Rooms ─────────────────────────────────────────────── */}
        <SectionCard
          title="Battle Rooms"
          subtitle="Team vs. team, live"
          icon={<Users size={18} strokeWidth={2} />}
          accented
        >
          <p className="text-[var(--muted-foreground)] text-sm mb-4">
            Form a team, share an invite code, and race another team to
            solve the problem set first. Scores update as each teammate's
            submission is verified.
          </p>
          <Button to="/club/battle-rooms" variant="theme" size="sm">
            Create or Join a Room
          </Button>
        </SectionCard>

        {/* ── Get in touch ─────────────────────────────────────────────── */}
        {/* Whole section is skipped, not just the cards inside it, when no
            channel env vars are configured (see config/site.js) — an
            "accented" SectionCard with an empty body would look broken. */}
        {(WHATSAPP_LINK || DISCORD_INVITE_URL || CONTACT_EMAIL_LINK) && (
          <SectionCard
            title="Get in Touch"
            subtitle="Talk to the Code Club team"
            icon={<MessageCircle size={18} strokeWidth={2} />}
            accented
          >
            <ContactChannels variant="panel" />
          </SectionCard>
        )}

        {/* ── Ambassador ───────────────────────────────────────────────── */}
        <Link
          to="/ambassador"
          className="group flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--theme-primary,#2dd4bf)] transition"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: withAlpha(theme.colors.primary, "1f"),
              color: theme.colors.primary,
            }}
          >
            <GraduationCap size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Ambassador Program</p>
            <p className="text-[var(--muted-foreground)] text-sm">Bring Code Club to your campus and earn rewards for it.</p>
          </div>
          <ArrowRight
            size={16}
            className="text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0"
            aria-hidden="true"
          />
        </Link>

        {/* ── Credits (Phase 3: Token Economy) ──────────────────────────── */}
        <Link
          to="/credits"
          className="group flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--theme-primary,#2dd4bf)] transition"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: withAlpha(theme.colors.primary, "1f"),
              color: theme.colors.primary,
            }}
          >
            <Coins size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Credits</p>
            <p className="text-[var(--muted-foreground)] text-sm">Manage your Credits, learn how they work, and redeem rewards in one place.</p>
          </div>
          <ArrowRight
            size={16}
            className="text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0"
            aria-hidden="true"
          />
        </Link>

        {/* ── Contribute (Phase 2F: Contribution Infrastructure) ───────── */}
        <Link
          to="/contribute"
          className="group flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--theme-primary,#2dd4bf)] transition"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: withAlpha(theme.colors.primary, "1f"),
              color: theme.colors.primary,
            }}
          >
            <Puzzle size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Contribute</p>
            <p className="text-[var(--muted-foreground)] text-sm">Submit a problem or improve testcases - approved contributions are rewarded.</p>
          </div>
          <ArrowRight
            size={16}
            className="text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0"
            aria-hidden="true"
          />
        </Link>

        {/* ── Feature Requests (Phase 5) ─────────────────────────────────── */}
        <Link
          to="/feature-requests"
          className="group flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--theme-primary,#2dd4bf)] transition"
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: withAlpha(theme.colors.primary, "1f"),
              color: theme.colors.primary,
            }}
          >
            <Lightbulb size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Feature Requests</p>
            <p className="text-[var(--muted-foreground)] text-sm">Suggest something for Code Club, or vote on what's already proposed.</p>
          </div>
          <ArrowRight
            size={16}
            className="text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition flex-shrink-0"
            aria-hidden="true"
          />
        </Link>
      </div>
    </DashboardLayout>
  );
}

export default ClubPage;