import RankProgressSection from "./sections/RankProgressSection";
import DailyChallengeSection from "./sections/DailyChallengeSection";
import WelcomeBanner from "./sections/WelcomeBanner";
import ContinueLearningSection from "./sections/ContinueLearningSection";
import WeeklyGoalSection from "./sections/WeeklyGoalSection";
import RecentAchievementCard from "./sections/RecentAchievementCard";
import AdvancedStatsSection from "./sections/AdvancedStatsSection";
import AIInsightsSection from "./sections/AIInsightsSection";
import ProfileShareCard from "./sections/ProfileShareCard";
import ActivityHeatmapCard from "./sections/ActivityHeatmapCard";
import TopicProgressCard from "./sections/TopicProgressCard";
import ContestCountdownCard from "./sections/ContestCountdownCard";

// ── Dashboard grid ──────────────────────────────────────────────────────
// Phase A reflow (unchanged): the original 9 sections are untouched — same
// components, same props, same data. Only the composition changed.
//
// Phase B (this batch): 3 new widgets, all built from data that was
// already flowing through the app — zero new backend endpoints required.
//   - ActivityHeatmapCard reads `activityDates` (already in AppContext)
//   - TopicProgressCard reads `topicStats` (already in AppContext, same
//     field Analytics.jsx's radar chart already uses)
//   - ContestCountdownCard calls the already-existing, already-cached
//     GET /api/contests?status=upcoming endpoint
//
// Phase C (this batch): Row 3 reordered into an explicit priority ladder —
// what should a returning user see first, second, third, fourth:
//   1. Continue Learning  — resume the most recent in-progress problem
//   2. Daily Challenge    — today's problem, if they'd rather start fresh
//   3. Weekly Goal        — a lighter-weight ask than the daily challenge
//   4. Next Contest       — awareness, lowest urgency of the four
// Rank moved out of Row 3 to make room and now lives in Row 5 alongside
// the other "momentum" cards (AI Insights, Recent Achievement) — same
// slot Continue Learning used to occupy there.
//
// Row 1 — Greeting                        (full width)
// Row 2 — KPI strip                       (full width, 4-up internally)
// Row 3 — Priority ladder: Continue Learning | Daily Challenge | Weekly Goal | Next Contest
// Row 4 — Patterns: Activity Heatmap (wide) | Topic Progress
// Row 5 — Momentum: Rank | AI Insights | Recent Achievement
// Row 6 — Profile-share CTA               (full width, compact)
//
// Row 6 (PublicProfileCard, which duplicated stats already shown in Row 2 and
// on /profile) was removed — see plans/004-dashboard-row6-deduplication.md.
// Replaced with a compact profile-share CTA (ProfileShareCard) instead of a
// second full stats block.

function DashboardSections() {
  return (
    <div className="space-y-6">
      <WelcomeBanner />

      <AdvancedStatsSection />

      {/* Default grid stretch (no items-start) is intentional here: with
          DailyChallengeSection's title/description now line-clamped, its
          height is bounded to a sane, consistent size — so letting the
          other three cards stretch to match it is what makes the row look
          even, instead of the tallest card dragging the others up
          unboundedly. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <ContinueLearningSection />
        <DailyChallengeSection />
        <WeeklyGoalSection />
        <ContestCountdownCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActivityHeatmapCard />
        <TopicProgressCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RankProgressSection />
        <AIInsightsSection />
        <RecentAchievementCard />
      </div>

      <ProfileShareCard />
    </div>
  );
}

export default DashboardSections;