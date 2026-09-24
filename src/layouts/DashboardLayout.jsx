import Navbar from "../components/Navbar";
import ThemeSkin from "../themes/ThemeSkin";

/**
 * Shared shell for every student/recruiter/TPO page (Dashboard, Problems
 * detail, Profile, Club, Settings, Pricing, Leaderboard, Contests, Battle
 * Rooms, Recruiter/TPO dashboards, and more — 19 pages import this one
 * file). Migrating this root wrapper to the semantic theme tokens (see
 * index.css) is what makes Black/White Mode apply platform-wide instead
 * of only on the pre-login landing page: every page here now inherits a
 * theme-aware background and default text color from a single place.
 *
 * This is the shell only — it doesn't make every card/table/button on
 * every one of those 19 pages theme-aware by itself. Content that sets
 * its own explicit dark-only classes (bg-zinc-900 cards, text-zinc-400
 * body copy, etc.) still renders as it always has until that page's own
 * content is migrated in a follow-up pass; it just no longer looks
 * broken doing so, since a dark card's own internal text still has
 * exactly the contrast it always did against that same dark card.
 */
function DashboardLayout({ children }) {
  return (
    <ThemeSkin>
      <div className="relative isolate min-h-screen bg-transparent text-[var(--foreground)] font-display universe-shell">
        <Navbar />
        <main className="relative z-10 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </ThemeSkin>
  );
}

export default DashboardLayout;