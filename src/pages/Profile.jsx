import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAppContext } from "../hooks/useAppContext";
import { useTheme } from "../hooks/useTheme";
import DashboardLayout from "../layouts/DashboardLayout";
import { getLevel, getLevelProgress } from "../utils/xpLevel";
import { Flame, BarChart3, Award, Zap, Inbox, FileText, ChevronDown } from "lucide-react";

// ── UI foundation ──────────────────────────────────────────────────────────────
import SectionCard from "../components/ui/layout/SectionCard";
import CollapsibleGroup from "../components/ui/layout/CollapsibleGroup";
import EmptyState from "../components/ui/feedback/EmptyState";
import ContentSlot from "../components/ui/slots/ContentSlot";
import ProfileQuickNav from "../components/profile/ProfileQuickNav";
import UniverseProfileHeader from "../components/profile/UniverseProfileHeader";
import AchievementGallery from "../components/dashboard/sections/AchievementGallery";
import ActivityHeatmap from "../components/profile/ActivityHeatmap";
import SkillRadar from "../components/profile/SkillRadar";
import CodingDNA from "../components/profile/CodingDNA";
import JourneyTimeline from "../components/profile/JourneyTimeline";
import RecruiterSnapshot from "../components/profile/RecruiterSnapshot";
import ProfessionalPresence from "../components/profile/ProfessionalPresence";
import ResumeCard from "../components/profile/ResumeCard";
import FeaturedProject from "../components/profile/FeaturedProject";
import PinnedProblems from "../components/profile/PinnedProblems";
import ProfileCompletion from "../components/profile/ProfileCompletion";
import EducationSection from "../components/profile/EducationSection";
import ContestHistorySection from "../components/profile/ContestHistorySection";
import AdminAccountView from "../components/profile/AdminAccountView";
import RoleAccountView from "../components/profile/RoleAccountView";

// ── Profile ────────────────────────────────────────────────────────────────────
// Profile information architecture: the page is composed from existing
// profile components and data contracts. This pass changes presentation and
// grouping only — no backend endpoints, role contracts, or component data
// models are changed. Student-only coding data remains isolated behind the
// existing role early returns below.

function Profile() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const {
    solvedProblems,
    recentActivity,
    submissions,
    currentStreak,
    longestStreak,
    totalXP,
    topicStats,
    activityDates,
    solvedDifficulty,
    achievements,
    joinedDate,
    role,
    roles,
    switchActiveRole,
  } = useAppContext();

  const [showAllActivity, setShowAllActivity] = useState(false);
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);

  const ACTIVITY_PREVIEW_COUNT = 5;
  const SUBMISSIONS_PREVIEW_COUNT = 5;
  const SUBMISSIONS_EXPANDED_COUNT = 15; // capped even when "expanded" — full history isn't paginated here

  const visibleActivity = showAllActivity
    ? recentActivity
    : recentActivity.slice(0, ACTIVITY_PREVIEW_COUNT);

  const recentSubmissions = submissions.slice(
    0,
    showAllSubmissions ? SUBMISSIONS_EXPANDED_COUNT : SUBMISSIONS_PREVIEW_COUNT
  );

  const level = getLevel(totalXP);
  const { current, needed, percent } = getLevelProgress(totalXP);

  const rank =
    level < 5 ? "Beginner" :
      level < 15 ? "Learner" :
        level < 30 ? "Intermediate" :
          level < 60 ? "Advanced" : "Expert";

  const joinedDisplay = joinedDate
    ? new Date(joinedDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : "Recently";

  // Admin UX audit (Phase UI-3, P0/P1): everything below this point (XP/
  // level hero, resume, GitHub/LinkedIn prompts, achievements, activity
  // heatmap, etc.) is student-shaped and meaningless for admin — see
  // AdminAccountView.jsx for the full rationale. Early return here, before
  // quickNavItems and the rest of the student-specific render, so none of
  // the logic below needs to know admin exists at all.
  if (role === "admin") {
    return (
      <DashboardLayout>
        <AdminAccountView user={user} joinedDisplay={joinedDisplay} />
      </DashboardLayout>
    );
  }

  // Role/profile isolation fix: TPO and Recruiter sessions used to fall
  // through into the student-shaped render below, which is where a TPO
  // could see a previous Student registration's leftover XP/streak/
  // solved-problem data (see models/User.js's role/roles comment for the
  // root cause and RoleAccountView.jsx for why this is a separate, small
  // component rather than threading role checks through every section
  // underneath — same reasoning as the admin case above).
  if (role === "tpo" || role === "recruiter") {
    return (
      <DashboardLayout>
        <RoleAccountView
          role={role}
          user={user}
          joinedDisplay={joinedDisplay}
          roles={roles}
          switchActiveRole={switchActiveRole}
        />
      </DashboardLayout>
    );
  }

  // Quick-jump nav — mirrors the ContentSlot ids below, with the same
  // role gating so a link never points at a section that isn't rendered.
  const quickNavItems = [
    { id: "profile-overview", label: "Overview" },
    { id: "profile-presence", label: "Presence" },
    ...(role === "student" ? [{ id: "profile-recruiter-snapshot", label: "Recruiter" }] : []),
    { id: "profile-skills-analytics", label: "Skills & Analytics" },
    { id: "profile-achievements", label: "Achievements" },
    { id: "profile-coding-activity", label: "Coding Activity" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 universe-profile">

        <ContentSlot id="profile-overview">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] gap-4 items-stretch">
            <ContentSlot id="profile-identity">
          <SectionCard accented>
            <div className="flex items-start gap-6">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-20 h-20 rounded-full flex-shrink-0"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
                  style={{
                    backgroundColor: `${theme.colors.primary}1f`,
                    color: theme.colors.primary,
                  }}
                >
                  {(user?.displayName || "U")[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold">{user?.displayName || "User"}</h2>
                    <p className="text-[var(--muted-foreground)] text-sm">{user?.email}</p>
                    <p className="text-[var(--muted-foreground)] text-sm mt-1">Joined {joinedDisplay}</p>
                  </div>
                  <Link
                    to="/settings"
                    className="flex-shrink-0 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition whitespace-nowrap"
                  >
                    Account settings →
                  </Link>
                </div>

                {/* Level / XP progress */}
                <div className="mt-5">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      Level {level} · {rank}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {current.toLocaleString()} / {needed.toLocaleString()} XP to next level
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--surface-elevated)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: theme.colors.primary,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick stat pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="bg-[var(--surface-elevated)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{totalXP.toLocaleString()}</p>
                <p className="text-[var(--muted-foreground)] text-xs mt-0.5">Total XP</p>
              </div>
              <div className="bg-[var(--surface-elevated)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{solvedProblems.length}</p>
                <p className="text-[var(--muted-foreground)] text-xs mt-0.5">Solved</p>
              </div>
              <div className="bg-[var(--surface-elevated)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold flex items-center justify-center gap-1.5">
                  <Flame size={18} strokeWidth={2} className="text-orange-400" aria-hidden="true" />
                  {currentStreak}
                </p>
                <p className="text-[var(--muted-foreground)] text-xs mt-0.5">Current Streak</p>
              </div>
              <div className="bg-[var(--surface-elevated)] rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{longestStreak}</p>
                <p className="text-[var(--muted-foreground)] text-xs mt-0.5">Longest Streak</p>
              </div>
            </div>
          </SectionCard>
            </ContentSlot>
            <div className="min-w-0">
<UniverseProfileHeader
          level={level}
          rank={rank}
          current={current}
          needed={needed}
          percent={percent}
          solved={solvedProblems.length}
          streak={currentStreak}
        />
            </div>
          </div>
        </ContentSlot>

        <ProfileQuickNav items={quickNavItems} />

        <ContentSlot id="profile-overview-details">
          <ProfileCompletion />

          {role === "student" && (
            <div className="mt-4">
              <EducationSection />
            </div>
          )}
        </ContentSlot>

        <ContentSlot id="profile-presence">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProfessionalPresence />
            <ResumeCard />
          </div>

          <div className="mt-4">
            <FeaturedProject />
          </div>

          <div className="mt-4">
            <PinnedProblems />
          </div>
        </ContentSlot>

        {role === "student" && (
          <ContentSlot id="profile-recruiter-snapshot">
            <RecruiterSnapshot />
          </ContentSlot>
        )}

        <ContentSlot id="profile-skills-analytics">
          <SectionCard
            title="Skills & Analytics"
            icon={<BarChart3 size={18} strokeWidth={2} />}
            accented
            collapsible
            defaultOpen
            storageKey="profile-collapse-skills-analytics"
          >
            <ContentSlot id="profile-heatmap-radar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ActivityHeatmap
                  activityDates={activityDates}
                  accentColor={theme.colors.primary}
                />
                <SkillRadar
                  topicStats={topicStats}
                  accentColor={theme.colors.primary}
                />
              </div>
            </ContentSlot>

            <div className="mt-4">
              <ContentSlot id="profile-coding-dna">
                <CodingDNA
                  submissions={submissions}
                  topicStats={topicStats}
                  solvedDifficulty={solvedDifficulty}
                  longestStreak={longestStreak}
                />
              </ContentSlot>
            </div>

            <div className="mt-4">
              <Link
                to="/analytics"
                className="group flex items-center gap-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--theme-primary,#2dd4bf)] transition"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: `${theme.colors.primary}1f`,
                    color: theme.colors.primary,
                  }}
                >
                  <BarChart3 size={20} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{theme.words.analytics}</p>
                  <p className="text-[var(--muted-foreground)] text-sm">
                    Deep dive into your solving patterns.
                  </p>
                </div>
                <span className="ml-auto text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition">
                  →
                </span>
              </Link>
            </div>
          </SectionCard>
        </ContentSlot>

        <ContentSlot id="profile-achievements">
          <SectionCard
            title="Achievements"
            icon={<Award size={18} strokeWidth={2} />}
            accented
            collapsible
            defaultOpen
            storageKey="profile-collapse-achievements"
          >
            <AchievementGallery
              collapsible={false}
              defaultOpen
            />

            {role === "student" && (
              <div className="mt-4">
                <ContestHistorySection />
              </div>
            )}

            <div className="mt-4">
              <JourneyTimeline
                joinedDate={joinedDate}
                achievements={achievements}
              />
            </div>

            <div className="mt-4">
              <CollapsibleGroup
                title="Certifications"
                icon={<Award size={15} strokeWidth={2} />}
                defaultOpen={false}
                storageKey="profile-collapse-certifications"
              >
                <Link
                  to="/certifications"
                  className="group flex items-center gap-4 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--theme-primary,#2dd4bf)] transition"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${theme.colors.primary}1f`,
                      color: theme.colors.primary,
                    }}
                  >
                    <Award size={20} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Certifications</p>
                    <p className="text-[var(--muted-foreground)] text-sm">
                      View and share what you've earned.
                    </p>
                  </div>
                  <span className="ml-auto text-[var(--muted-foreground)] group-hover:text-[var(--theme-primary,#2dd4bf)] transition">
                    →
                  </span>
                </Link>
              </CollapsibleGroup>
            </div>
          </SectionCard>
        </ContentSlot>

        <ContentSlot id="profile-coding-activity">
          <SectionCard
            title="Coding Activity"
            icon={<Zap size={18} strokeWidth={2} />}
            accented
            collapsible
            defaultOpen
            storageKey="profile-collapse-coding-activity"
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SectionCard
                title="Recent Activity"
                icon={<Zap size={18} strokeWidth={2} />}
                accented
                collapsible
                defaultOpen
                storageKey="profile-collapse-activity"
              >
                {recentActivity.length === 0 ? (
                  <EmptyState
                    icon={<Inbox size={28} strokeWidth={1.75} />}
                    title="No activity yet"
                    description="Solve a problem to start building your activity history."
                    actionLabel="Browse Problems"
                    actionHref="/problems"
                    compact
                  />
                ) : (
                  <>
                    <div className="space-y-3">
                      {visibleActivity.map((item, index) => (
                        <div
                          key={index}
                          className="bg-[var(--surface-elevated)] px-4 py-3 rounded-xl flex justify-between items-center"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                item.status?.includes("Accepted")
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            />
                            <span className="text-sm">{item.title}</span>
                          </div>
                          <span className="text-[var(--muted-foreground)] text-sm flex-shrink-0 ml-4">
                            {item.time}
                          </span>
                        </div>
                      ))}
                    </div>

                    {recentActivity.length > ACTIVITY_PREVIEW_COUNT && (
                      <button
                        type="button"
                        onClick={() => setShowAllActivity((v) => !v)}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2 rounded-lg hover:bg-white/[0.03] transition"
                      >
                        {showAllActivity ? "Show less" : `Show ${recentActivity.length - ACTIVITY_PREVIEW_COUNT} more`}
                        <ChevronDown
                          size={15}
                          strokeWidth={2}
                          className={`transition-transform duration-200 ${showAllActivity ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </>
                )}
              </SectionCard>

              <SectionCard
                title="Recent Submissions"
                icon={<FileText size={18} strokeWidth={2} />}
                accented
                collapsible
                defaultOpen={false}
                storageKey="profile-collapse-submissions"
              >
                {recentSubmissions.length === 0 ? (
                  <EmptyState
                    icon={<FileText size={28} strokeWidth={1.75} />}
                    title="No submissions yet"
                    description="Submit your first solution to see your history here."
                    actionLabel="Start solving"
                    actionHref="/problems"
                    compact
                  />
                ) : (
                  <>
                    <div className="space-y-3">
                      {recentSubmissions.map((submission, index) => (
                        <div
                          key={submission.id || submission.createdAt || index}
                          className="flex justify-between items-center border-b border-[var(--border)] pb-2 last:border-0"
                        >
                          <div>
                            <p className="font-medium">{submission.problemTitle}</p>
                            <p className="text-xs text-[var(--muted-foreground)]">{submission.language}</p>
                          </div>
                          <div className="text-right">
                            <p
                              className={
                                submission.status?.includes("Accepted")
                                  ? "text-green-500"
                                  : "text-red-500"
                              }
                            >
                              {submission.status}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">{submission.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {submissions.length > SUBMISSIONS_PREVIEW_COUNT && (
                      <button
                        type="button"
                        onClick={() => setShowAllSubmissions((v) => !v)}
                        className="w-full mt-3 flex items-center justify-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2 rounded-lg hover:bg-white/[0.03] transition"
                      >
                        {showAllSubmissions
                          ? "Show less"
                          : `Show ${Math.min(submissions.length, SUBMISSIONS_EXPANDED_COUNT) - SUBMISSIONS_PREVIEW_COUNT} more`}
                        <ChevronDown
                          size={15}
                          strokeWidth={2}
                          className={`transition-transform duration-200 ${showAllSubmissions ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                  </>
                )}
              </SectionCard>
            </div>
          </SectionCard>
        </ContentSlot>

      </div>
    </DashboardLayout>
  );
}

export default Profile;