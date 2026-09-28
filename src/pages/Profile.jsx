import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAppContext } from "../hooks/useAppContext";
import { useTheme } from "../hooks/useTheme";
import DashboardLayout from "../layouts/DashboardLayout";
import { getLevel, getLevelProgress } from "../utils/xpLevel";
import { Flame, BarChart3, Award, Zap, FileText, ChevronDown } from "lucide-react";

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

  const [showAllSubmissions, setShowAllSubmissions] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);

  const SUBMISSIONS_PREVIEW_COUNT = 5;
  const SUBMISSIONS_EXPANDED_COUNT = 15; // capped even when "expanded" — full history isn't paginated here

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

  return (
    <DashboardLayout>
      <div className="profile-wow max-w-7xl mx-auto">
        <ContentSlot id="profile-overview">
          <section className="profile-wow-hero">
            <div className="profile-wow-hero__grid" aria-hidden="true" />
            <div className="profile-wow-hero__orb profile-wow-hero__orb--one" aria-hidden="true" />
            <div className="profile-wow-hero__orb profile-wow-hero__orb--two" aria-hidden="true" />

            <div className="profile-wow-hero__identity">
              <div className="profile-wow-avatar">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                  />
                ) : (
                  <span>{(user?.displayName || "U")[0]}</span>
                )}
                <span className="profile-wow-avatar__online" aria-label="Online" />
              </div>

              <div className="min-w-0">
                <p className="profile-wow-kicker">CODE CLUB / CODING IDENTITY</p>
                <h1 className="profile-wow-name">{user?.displayName || "User"}</h1>
                <p className="profile-wow-email">{user?.email}</p>
                <div className="profile-wow-meta">
                  <span>Level {level}</span>
                  <span>{rank}</span>
                  <span>Joined {joinedDisplay}</span>
                </div>
              </div>
            </div>

            <div className="profile-wow-hero__actions">
              <Link to="/settings" className="profile-wow-action profile-wow-action--ghost">
                Account settings
              </Link>
              <button
                type="button"
                className="profile-wow-action profile-wow-action--primary"
                onClick={() => navigator.clipboard?.writeText(window.location.href)}
              >
                Share profile
              </button>
            </div>

            <div className="profile-wow-hero__metrics">
              <div>
                <span className="profile-wow-metric-value">{solvedProblems.length}</span>
                <span className="profile-wow-metric-label">Problems solved</span>
              </div>
              <div>
                <span className="profile-wow-metric-value">{totalXP.toLocaleString()}</span>
                <span className="profile-wow-metric-label">Total XP</span>
              </div>
              <div>
                <span className="profile-wow-metric-value profile-wow-metric-value--streak">
                  <Flame size={17} aria-hidden="true" /> {currentStreak}
                </span>
                <span className="profile-wow-metric-label">Current streak</span>
              </div>
              <div>
                <span className="profile-wow-metric-value">{longestStreak}</span>
                <span className="profile-wow-metric-label">Longest streak</span>
              </div>
            </div>

            <div className="profile-wow-hero__progress">
              <div>
                <span>Level {level} progress</span>
                <strong>{current.toLocaleString()} / {needed.toLocaleString()} XP</strong>
              </div>
              <div className="profile-wow-progress-track">
                <span style={{ width: `${Math.min(percent, 100)}%` }} />
              </div>
            </div>

            <div className="profile-wow-signal">
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
          </section>
        </ContentSlot>

        <ProfileQuickNav items={[
          { id: "profile-overview", label: "Overview" },
          { id: "profile-presence", label: "Presence" },
          { id: "profile-skills-analytics", label: "Coding Identity" },
          { id: "profile-achievements", label: "Achievements" },
          { id: "profile-coding-activity", label: "Activity" },
          ...(role === "student" ? [{ id: "profile-recruiter-snapshot", label: "Career" }] : []),
        ]} />

        <ContentSlot id="profile-overview-details">
          <div className="profile-wow-section-heading">
            <div>
              <span>01 / SNAPSHOT</span>
              <h2>Your profile at a glance</h2>
            </div>
            <p>Build a profile that shows more than a resume — show how you actually code.</p>
          </div>

          <div className="profile-wow-bento profile-wow-bento--overview">
            <div className="profile-wow-bento__large">
              <ProfileCompletion />
            </div>
            <div className="profile-wow-bento__medium">
              {role === "student" ? <EducationSection collapsible={false} /> : (
                <SectionCard title="Account" icon={<Award size={18} />} accented>
                  <div className="profile-wow-account-card">
                    <span className="profile-wow-account-card__icon"><Award size={18} /></span>
                    <div>
                      <strong>{rank} coder</strong>
                      <p>Your coding identity is active and ready to grow.</p>
                    </div>
                  </div>
                </SectionCard>
              )}
            </div>
            <div className="profile-wow-bento__medium profile-wow-presence-mini">
              <ProfessionalPresence collapsible={false} />
            </div>
            <div className="profile-wow-bento__small">
              <div className="profile-wow-stat-card">
                <span className="profile-wow-stat-card__eyebrow">NEXT LEVEL</span>
                <strong>{needed.toLocaleString()} XP</strong>
                <p>Keep solving to unlock the next level.</p>
                <div className="profile-wow-mini-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div>
              </div>
            </div>
          </div>
        </ContentSlot>

        <ContentSlot id="profile-presence">
          <div className="profile-wow-section-heading">
            <div>
              <span>02 / PRESENCE</span>
              <h2>Proof of work</h2>
            </div>
            <p>Projects, resume, links and problems that make your profile tangible.</p>
          </div>

          <div className="profile-wow-bento profile-wow-bento--work">
            <div className="profile-wow-feature">
              <ContentSlot id="profile-featured-project">
                <FeaturedProject collapsible={false} />
              </ContentSlot>
            </div>
            <div className="profile-wow-resume">
              <ResumeCard collapsible={false} />
            </div>
            <div className="profile-wow-pinned">
              <ContentSlot id="profile-pinned-problems">
                <PinnedProblems collapsible={false} />
              </ContentSlot>
            </div>
          </div>
        </ContentSlot>

        <ContentSlot id="profile-skills-analytics">
          <div className="profile-wow-section-heading">
            <div>
              <span>03 / CODING IDENTITY</span>
              <h2>How you code</h2>
            </div>
            <p>Patterns, consistency and problem-solving signals — not just a list of skills.</p>
          </div>

          <div className="profile-wow-bento profile-wow-bento--analytics">
            <div className="profile-wow-heatmap">
              <ContentSlot id="profile-heatmap-radar">
                <ActivityHeatmap
                  activityDates={activityDates}
                  accentColor={theme.colors.primary}
                />
              </ContentSlot>
            </div>
            <div className="profile-wow-radar">
              <SkillRadar
                topicStats={topicStats}
                accentColor={theme.colors.primary}
              />
            </div>
            <div className="profile-wow-dna">
              <ContentSlot id="profile-coding-dna">
                <CodingDNA collapsible={false}
                  submissions={submissions}
                  topicStats={topicStats}
                  solvedDifficulty={solvedDifficulty}
                  longestStreak={longestStreak}
                />
              </ContentSlot>
            </div>
            <Link to="/analytics" className="profile-wow-analytics-link">
              <BarChart3 size={20} aria-hidden="true" />
              <div>
                <strong>Open full analytics</strong>
                <span>Explore deeper solving patterns</span>
              </div>
              <span className="profile-wow-arrow">→</span>
            </Link>
          </div>
        </ContentSlot>

        <ContentSlot id="profile-achievements">
          <div className="profile-wow-section-heading">
            <div>
              <span>04 / MILESTONES</span>
              <h2>Achievements & journey</h2>
            </div>
            <p>Every solved problem, streak and milestone becomes part of your coding story.</p>
          </div>

          <div className="profile-wow-bento profile-wow-bento--achievements">
            <div className="profile-wow-achievements">
              <AchievementGallery collapsible={false} defaultOpen />
            </div>
            {role === "student" && (
              <div className="profile-wow-contests">
                <ContestHistorySection collapsible={false} />
              </div>
            )}
            <div className="profile-wow-journey">
              <JourneyTimeline joinedDate={joinedDate} achievements={achievements} collapsible={false} />
            </div>
            <div className="profile-wow-certifications">
              <CollapsibleGroup
                title="Certifications"
                icon={<Award size={15} strokeWidth={2} />}
                defaultOpen={false}
                storageKey="profile-collapse-certifications"
              >
                <Link
                  to="/certifications"
                  className="profile-wow-analytics-link"
                >
                  <Award size={20} aria-hidden="true" />
                  <div>
                    <strong>View certifications</strong>
                    <span>Share what you've earned.</span>
                  </div>
                  <span className="profile-wow-arrow">→</span>
                </Link>
              </CollapsibleGroup>
            </div>
          </div>
        </ContentSlot>

        <ContentSlot id="profile-coding-activity">\n          <div className="profile-wow-section-heading profile-wow-section-heading--activity">\n            <div>\n              <span>05 / ACTIVITY</span>\n              <h2>Recent coding activity</h2>\n            </div>\n            <p>A live trail of the problems you touched, languages you used and results you earned.</p>\n          </div>\n\n          <section className="profile-wow-activity" aria-label="Recent coding activity">\n            <button\n              type="button"\n              className="profile-wow-activity__header"\n              onClick={() => setActivityOpen((open) => !open)}\n              aria-expanded={activityOpen}\n            >\n              <span className="profile-wow-activity__index">RUN LOG</span>\n              <span className="profile-wow-activity__title">\n                <Zap size={18} aria-hidden="true" />\n                Submission stream\n              </span>\n              <span className="profile-wow-activity__count">{submissions.length} total</span>\n              <ChevronDown size={18} className={activityOpen ? "rotate-180" : ""} aria-hidden="true" />\n            </button>\n\n            <div className={activityOpen ? "profile-wow-activity__body profile-wow-activity__body--open" : "profile-wow-activity__body"}>\n              {recentSubmissions.length === 0 ? (\n                <EmptyState\n                  icon={<FileText size={28} strokeWidth={1.75} />}\n                  title="No coding activity yet"\n                  description="Submit your first solution to start your coding trail."\n                  actionLabel="Start solving"\n                  actionHref="/problems"\n                  compact\n                />\n              ) : (\n                <>\n                  <div className="profile-wow-activity__legend">\n                    <span>PROBLEM</span>\n                    <span>LANGUAGE</span>\n                    <span>RESULT</span>\n                    <span>DATE</span>\n                  </div>\n\n                  <div className="profile-wow-activity__rows">\n                    {recentSubmissions.map((submission, index) => {\n                      const accepted = submission.status?.includes("Accepted");\n                      return (\n                        <div\n                          key={submission.id || submission.createdAt || index}\n                          className="profile-wow-activity__row"\n                        >\n                          <span className="profile-wow-activity__pulse" aria-hidden="true" />\n                          <div className="profile-wow-activity__problem">\n                            <span className="profile-wow-activity__row-number">{String(index + 1).padStart(2, "0")}</span>\n                            <strong>{submission.problemTitle || "Untitled problem"}</strong>\n                          </div>\n                          <span className="profile-wow-activity__language">{submission.language || "—"}</span>\n                          <span className={accepted ? "profile-wow-status profile-wow-status--accepted" : "profile-wow-status profile-wow-status--rejected"}>\n                            <i aria-hidden="true" />\n                            {submission.status || "Unknown"}\n                          </span>\n                          <span className="profile-wow-activity__date">{submission.date || "—"}</span>\n                        </div>\n                      );\n                    })}\n                  </div>\n\n                  {submissions.length > SUBMISSIONS_PREVIEW_COUNT && (\n                    <button\n                      type="button"\n                      onClick={() => setShowAllSubmissions((v) => !v)}\n                      className="profile-wow-more"\n                    >\n                      {showAllSubmissions\n                        ? "Collapse stream"\n                        : `Reveal ${Math.min(submissions.length, SUBMISSIONS_EXPANDED_COUNT) - SUBMISSIONS_PREVIEW_COUNT} more runs`}\n                      <ChevronDown\n                        size={15}\n                        className={showAllSubmissions ? "rotate-180" : ""}\n                        aria-hidden="true"\n                      />\n                    </button>\n                  )}\n                </>\n              )}\n            </div>\n          </section>\n        </ContentSlot>\n        {role === "student" && (
          <ContentSlot id="profile-recruiter-snapshot">
            <div className="profile-wow-section-heading">
              <div>
                <span>06 / CAREER</span>
                <h2>Recruiter-ready profile</h2>
              </div>
              <p>Turn your coding identity into a clear professional signal.</p>
            </div>
            <RecruiterSnapshot collapsible={false} />
          </ContentSlot>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Profile;