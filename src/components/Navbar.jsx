import { Link, useNavigate, useLocation } from "react-router-dom";
import { logoutUser } from "../services/auth";
import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContextObject";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../hooks/useAppContext";
import { useGuest } from "../hooks/useGuest";
import { buildLoginRedirect } from "../utils/authRedirect";
import AvatarDropdown from "./AvatarDropdown";
import StreakBadge from "./common/StreakBadge";
import BWModeToggle from "./common/BWModeToggle";
import NotificationBell from "./notifications/NotificationBell";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import CommandPalette from "./CommandPalette";
import { WORKSPACES } from "../config/workspaces";

// Plain (non-switchable) workspace label shown in the brand block for
// roles that aren't admin (which gets the real WorkspaceSwitcher) or
// student (which gets the active theme name instead — see
// isStudentThemed below). Keeps "who am I logged in as" visible without
// implying these roles can jump to another workspace the way admin can.
const PLAIN_WORKSPACE_LABEL = {
  recruiter: "Recruiter",
  tpo: "TPO",
};

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { theme } = useTheme();
  const { currentStreak, role, isBackendReady } = useAppContext();
  const { isGuest, exitGuestMode } = useGuest();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Theme coloring is student-only (Phase 11, decision #2) — Navbar is
  // shared across roles (Admin Console renders it too via DashboardLayout),
  // so this is checked explicitly rather than assumed from ThemeSkin's
  // presence.
  const isStudentThemed = role === "student";

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleLogout = async () => {
    await logoutUser();
    // Guest Mode: harmless no-op for a real authenticated user (nothing
    // to clear); for a guest, this is the "Logout"/"Exit guest session"
    // action — clears guestPortal so the next visit to /portal starts
    // clean instead of silently re-entering the same guest portal.
    exitGuestMode();
    // JARVIS pass, spec §19: "provide subtle session-ended feedback" —
    // real feedback tied to the actual completed logout (this line only
    // runs after logoutUser() resolves), not a fabricated shutdown
    // animation. LoginPage reads this flag to show a one-line confirmation,
    // same treatment as its existing sessionExpired banner.
    navigate("/login?loggedOut=1");
  };

  const navigation = {
    student: {
      primary: [
        { to: "/dashboard", label: theme.words.dashboard },
        { to: "/problems", label: theme.words.problems },
        { to: "/club", label: "Club" },
        { to: "/college-tpos", label: "College TPOs" },
      ],
      // Analytics & Certifications now live inside Profile (avatar → View Profile).
      // Leaderboard, Contests & Ambassador now live inside Club, above.
      // Recruiters stay discoverable from the landing page footer; Pricing
      // stays one tap away in the avatar menu — neither needs a seat here.
      secondary: [],
    },

    recruiter: {
      primary: [
        { to: "/recruiter/dashboard", label: "Candidates" },
        { to: "/candidate/tests", label: "Tests" },
      ],
      secondary: [
        { to: "/profile", label: theme.words.profile },
      ],
    },

    tpo: {
      primary: [
        { to: "/tpo/dashboard", label: "Dashboard" },
      ],
      secondary: [
        { to: "/profile", label: theme.words.profile },
      ],
    },

    admin: {
      // Admin UX audit (Phase UI-3, continued — found from a screenshot,
      // not a code read): this used to list { "Admin Console" } as
      // primary and { Student, Recruiter, TPO } as secondary, rendered
      // as a flat link row right here. That made THREE simultaneous,
      // always-visible ways to do the exact same "jump to another
      // workspace" action on every single admin page: this row,
      // AdminPreviewBanner (the purple strip above, mounted globally),
      // and WorkspaceSwitcher (the "Command Center ▾" dropdown a few
      // pixels to the left, next to the brand). Directly the kind of
      // "visual overload" / "noisy" the spec's premium standard warns
      // against — three controls for one job reads as unfinished, not
      // powerful.
      // Kept both of the other two rather than picking just one:
      // AdminPreviewBanner does double duty as the impersonation-exit
      // safety banner (§ earlier P0 work) and can't be removed, while
      // WorkspaceSwitcher fills the same Navbar-brand-adjacent slot every
      // other role uses for a workspace/theme label (student's theme
      // name, recruiter/tpo's plain label) — removing it would leave
      // admin's Navbar looking broken relative to every other role, not
      // calmer. This row was the pure duplicate with zero unique value,
      // so it's gone. See WorkspaceSwitcher.jsx for the related fix
      // (its currentId now reflects the actual page, not a hardcoded
      // "admin", so it stays honest while previewing another workspace).
      primary: [],
      secondary: [],
    },
  };

  const nav = navigation[role] ?? navigation.student;

  // Which of the four WORKSPACES the admin is actually looking at right
  // now — matched by longest path prefix so nested routes (e.g.
  // /recruiter/dashboard/candidates) still resolve correctly. Falls back
  // to "admin" (Command Center) for any admin-only path not in the list.
  // Previously this was hardcoded to "admin" always, so WorkspaceSwitcher
  // kept reading "Command Center" even while an admin was actively
  // previewing the Student or Recruiter dashboard — a small but real
  // correctness gap found alongside the redundant-switchers issue above.
  const currentWorkspaceId =
    [...WORKSPACES].sort((a, b) => b.path.length - a.path.length).find((w) => isActive(w.path))?.id ?? "admin";

  // Search/command palette: offered to every role except admin. Admin
  // already has WorkspaceSwitcher for "go somewhere else", and Command
  // Center's own destinations don't fit the same "jump to a page in my
  // single workspace" model the palette is for.
  const showSearch = role !== "admin";
  const paletteDestinations = [...nav.primary, ...nav.secondary];

  // NotificationBell is student-facing (mentions, replies, achievement
  // pings tied to a personal learning journey) and doesn't apply to
  // admin, who gets the equivalent via AttentionCenter inside Command
  // Center instead — showing both would be a duplicate, confusing signal.
  const showNotificationBell = role !== "admin";

  // Nav destinations and search hit real backend data (Problems needs
  // fetched questions, Club needs contest/room data, etc.). DailyQuizGate
  // (src/routes/DailyQuizGate.jsx, reached via ProtectedRoute) already
  // waits for isBackendReady before ever letting a protected page's
  // Navbar mount in the first place, but this flag is kept as its own
  // explicit gate here too — cheap belt-and-suspenders in case that
  // upstream guarantee ever changes, rather than Navbar quietly relying
  // on an invariant it doesn't own.
  const navReady = isBackendReady;

  return (
    <nav className="universe-navbar bg-[var(--surface)] text-[var(--foreground)] border-b border-[var(--border)] relative z-50">
      <div className="px-4 sm:px-8 py-4 flex items-center justify-between">

        {/* Brand */}
        <div className="flex flex-col min-w-0">
          <span className="text-xl sm:text-2xl font-bold truncate">Code Club</span>
          {role === "admin" ? (
            <WorkspaceSwitcher currentId={currentWorkspaceId} />
          ) : isStudentThemed ? (
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary,#2dd4bf)]"
              />
              {theme.name}
            </span>
          ) : PLAIN_WORKSPACE_LABEL[role] ? (
            <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest">
              {PLAIN_WORKSPACE_LABEL[role]}
            </span>
          ) : null}
        </div>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-6 shrink-0">
          {nav.primary.map((link) => {
            const active = isActive(link.to);
            if (!navReady) {
              return (
                <span
                  key={link.to}
                  aria-disabled="true"
                  title="Preparing your workspace…"
                  className="relative pb-1 text-sm text-[var(--muted-foreground)] cursor-not-allowed select-none opacity-60"
                >
                  {link.label}
                </span>
              );
            }
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? "page" : undefined}
                className={`relative pb-1 text-sm transition ${active
                    ? "text-[var(--foreground)] font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
              >
                {link.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-0 right-0 -bottom-1 h-0.5 rounded-full ${isStudentThemed ? "bg-[var(--theme-primary,#2dd4bf)]" : "bg-[var(--foreground)]"
                      }`}
                  />
                )}
              </Link>
            );
          })}
          {nav.secondary.length > 0 && (
            <div className="flex items-center gap-4 border-l border-[var(--border)] pl-4 ml-2">
              {nav.secondary.map((link) => {
                const active = isActive(link.to);
                if (!navReady) {
                  return (
                    <span
                      key={link.to}
                      aria-disabled="true"
                      title="Preparing your workspace…"
                      className="text-sm text-[var(--muted-foreground)] cursor-not-allowed select-none opacity-60"
                    >
                      {link.label}
                    </span>
                  );
                }
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={active ? "page" : undefined}
                    className={`text-sm transition ${active ? "text-[var(--foreground)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {showSearch && (
            <button
              type="button"
              aria-label="Search (Ctrl+K)"
              onClick={() => setPaletteOpen(true)}
              disabled={!navReady}
              title={navReady ? undefined : "Preparing your workspace…"}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--muted-foreground)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <BWModeToggle />

          <StreakBadge
            streak={currentStreak}
            size="sm"
          />

          {showNotificationBell && <NotificationBell />}

          <AvatarDropdown
            user={user}
            isGuest={isGuest}
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile: search + streak + bell + avatar + hamburger */}
        <div className="flex lg:hidden items-center gap-3 shrink-0">
          {showSearch && (
            <button
              type="button"
              aria-label="Search (Ctrl+K)"
              onClick={() => setPaletteOpen(true)}
              disabled={!navReady}
              title={navReady ? undefined : "Preparing your workspace…"}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--muted-foreground)]"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <StreakBadge
            streak={currentStreak}
            size="sm"
          />

          {showNotificationBell && <NotificationBell />}

          <AvatarDropdown
            user={user}
            isGuest={isGuest}
            onLogout={handleLogout}
            mobile
          />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="p-2 rounded-lg text-[var(--foreground)] hover:bg-[var(--surface-elevated)] transition"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex flex-col gap-1">
          {[...nav.primary, ...nav.secondary].map((link) => {
            const active = isActive(link.to);
            if (!navReady) {
              return (
                <span
                  key={link.to}
                  aria-disabled="true"
                  title="Preparing your workspace…"
                  className="py-2.5 px-3 rounded-xl text-sm border-l-2 border-transparent text-[var(--muted-foreground)] cursor-not-allowed select-none opacity-60"
                >
                  {link.label}
                </span>
              );
            }
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`py-2.5 px-3 rounded-xl transition text-sm border-l-2 ${active
                    ? "bg-[var(--surface-elevated)] text-[var(--foreground)] font-medium"
                    : "border-transparent hover:bg-[var(--surface-elevated)] text-[var(--muted-foreground)]"
                  }`}
                style={{
                  borderLeftColor: active
                    ? isStudentThemed
                      ? "var(--theme-primary, #2dd4bf)"
                      : "var(--foreground)"
                    : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="border-t border-[var(--border)] mt-2 pt-3">
            <BWModeToggle showLabel />
          </div>
          <div className="border-t border-[var(--border)] mt-3 pt-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">
                {isGuest ? "Guest Session" : user?.displayName}
              </p>
              <p className="text-[var(--muted-foreground)] text-xs">
                {isGuest ? "Sign in to save your progress." : user?.email}
              </p>
            </div>
            {isGuest ? (
              <Link
                to={buildLoginRedirect(location.pathname + location.search)}
                className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition text-sm"
              >
                Sign In
              </Link>
            ) : (
              <button
                onClick={handleLogout}
                className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition text-sm"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          commands={paletteDestinations}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </nav>
  );
}

export default Navbar;