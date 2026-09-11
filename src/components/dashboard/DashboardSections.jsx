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
// Row 1 — Greeting                        (full width)
// Row 2 — KPI strip                       (full width, 4-up internally)
// Row 3 — Status & goals: Rank | Weekly Goal | Daily Challenge | Next Contest
// Row 4 — Patterns: Activity Heatmap (wide) | Topic Progress
// Row 5 — Momentum: Continue | AI Insights | Recent Achievement
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

      {/* items-start: without it, CSS grid's default `align-items: stretch`
          forces Rank/Weekly Goal/Next Contest to match whatever height
          DailyChallengeSection needs for that day's title + description,
          leaving large dead whitespace in the shorter cards. Paired with
          the line-clamp on DailyChallengeSection itself so that card also
          has a sane ceiling instead of just growing unbounded. */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <RankProgressSection />
        <WeeklyGoalSection />
        <DailyChallengeSection />
        <ContestCountdownCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActivityHeatmapCard />
        <TopicProgressCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ContinueLearningSection />
        <AIInsightsSection />
        <RecentAchievementCard />
      </div>

      <ProfileShareCard />
    </div>
  );
}

export default DashboardSections;