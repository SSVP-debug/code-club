import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/auth/RoleRoute";
import PremiumRoute from "./components/auth/PremiumRoute";
import ThemeGate from "./routes/ThemeGate";
import DailyQuizProvider from "./context/DailyQuizProvider";
import DashboardRoleRedirect from "./routes/DashboardRoleRedirect";
import { warmBackend } from "./services/api";

// ── Eagerly loaded ─────────────────────────────────────────────────────────
// These are tiny and needed immediately on first paint.
// LandingPage: first thing any visitor sees — no delay acceptable.
// LoginPage: auth flow must be instant.
// NotFoundPage: tiny, no reason to split.
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import PortalPage from "./pages/PortalPage";
import NotFoundPage from "./pages/NotFoundPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPreviewBanner from "./components/admin/AdminPreviewBanner";
import AnnouncementBanner from "./components/admin/AnnouncementBanner";
import OfflineBanner from "./components/OfflineBanner";

// ── Lazily loaded ──────────────────────────────────────────────────────────
// Each lazy() call creates a separate JS chunk.
// React only downloads + executes a chunk when the user first navigates to it.
// Monaco Editor lives inside ProblemDetailsPage — the single biggest win here.
// Before: Monaco downloaded on app init for every user (including those who never open a problem).
// After:  Monaco only downloads when a user opens a problem page.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Profile = lazy(() => import("./pages/Profile"));
const ProblemsPage = lazy(() => import("./pages/ProblemsPage"));
const ProblemDetailsPage = lazy(() => import("./pages/ProblemDetailsPage"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const ThemeSelectionPage = lazy(() => import("./pages/ThemeSelectionPage"));
const ThemeConfirmationPage = lazy(() => import("./pages/ThemeConfirmationPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const ClubPage = lazy(() => import("./pages/ClubPage"));
const RecruiterSignupPage = lazy(() => import("./pages/RecruiterSignupPage"));
const RecruiterDashboardPage = lazy(() => import("./pages/RecruiterDashboardPage"));
const CandidateTestsPage = lazy(() => import("./pages/CandidateTestsPage"));
const CertificationsPage = lazy(() => import("./pages/CertificationsPage"));
const CertVerifyPage = lazy(() => import("./pages/CertVerifyPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ContestsPage = lazy(() => import("./pages/ContestsPage"));
const ContestDetailPage = lazy(() => import("./pages/ContestDetailPage"));
const PrivateContestsPage = lazy(() => import("./pages/PrivateContestsPage"));
const BattleRoomsPage = lazy(() => import("./pages/BattleRoomsPage"));
const BattleRoomDetailPage = lazy(() => import("./pages/BattleRoomDetailPage"));
const CollegeVerifyConfirmPage = lazy(() => import("./pages/CollegeVerifyConfirmPage"));
const AmbassadorPage = lazy(() => import("./pages/AmbassadorPage"));
const ContributionsPage = lazy(() => import("./pages/ContributionsPage"));
const CreditsPage = lazy(() => import("./pages/CreditsPage"));
const RewardsStorePage = lazy(() => import("./pages/RewardsStorePage"));
const FeatureRequestsPage = lazy(() => import("./pages/FeatureRequestsPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const InterviewModePage = lazy(() => import("./pages/InterviewModePage"));
const TpoSignupPage = lazy(() => import("./pages/TpoSignupPage"));
const TpoDashboardPage = lazy(() => import("./pages/TpoDashboardPage"));
const CollegeTpoDirectoryPage = lazy(() => import("./pages/CollegeTpoDirectoryPage"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverviewPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminCollegesPage = lazy(() => import("./pages/admin/AdminCollegesPage"));
const AdminProblemsPage = lazy(() => import("./pages/admin/AdminProblemsPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminSystemHealthPage = lazy(() => import("./pages/admin/AdminSystemHealthPage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const OpportunityRadarPage = lazy(() => import("./pages/OpportunityRadarPage"));
const OpportunityDetailPage = lazy(() => import("./pages/OpportunityDetailPage"));
const AdminOpportunitiesPage = lazy(() => import("./pages/admin/AdminOpportunitiesPage"));
const AdminContributionsPage = lazy(() => import("./pages/admin/AdminContributionsPage"));
const AdminRewardsStorePage = lazy(() => import("./pages/admin/AdminRewardsStorePage"));
const AdminFeatureRequestsPage = lazy(() => import("./pages/admin/AdminFeatureRequestsPage"));
const AdminOpportunityFormPage = lazy(() => import("./pages/admin/AdminOpportunityFormPage"));
const AdminOpportunityImportPage = lazy(() => import("./pages/admin/AdminOpportunityImportPage"));
const AdminGenerateShareCardPage = lazy(() => import("./pages/admin/AdminGenerateShareCardPage"));
const AdminOpportunityAnalyticsPage = lazy(() => import("./pages/admin/AdminOpportunityAnalyticsPage"));
// ── Route-level loading fallback ───────────────────────────────────────────
// Shown while a chunk is downloading. Matches the app's dark background
// so there's no white flash during navigation.
function PageLoader() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--theme-primary,#2dd4bf)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--muted-foreground)] text-sm">Loading…</p>
      </div>
    </div>
  );
}

// Phase 12A: /contests/:id moved to /club/public-contests/:id. useParams()
// only works inside a rendered route element, so a plain <Navigate> can't
// interpolate :id on its own — this tiny wrapper reads it and redirects.
function RedirectToContestDetail() {
  const { id } = useParams();
  return <Navigate to={`/club/public-contests/${id}`} replace />;
}

function App() {
  // Fire-and-forget — see warmBackend's own comment in services/api.js for
  // why this can't just be part of AppContext's existing hydrate() call.
  useEffect(() => {
    warmBackend();
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      {/* Daily Quiz Gate — DailyQuizProvider only fetches/caches status
          here (once per session/day, shared across route changes); it
          renders every route unconditionally, so public pages (landing,
          /login, /portal, /theme-selection, etc.) are never affected.
          The actual gating happens per-protected-page, inside
          ProtectedRoute -> DailyQuizGate (see those files) — that's what
          keeps the app shell/navbar from ever mounting on a genuinely
          protected page while today's quiz is incomplete. */}
      <DailyQuizProvider>
      <OfflineBanner />
      <AnnouncementBanner />
      <AdminPreviewBanner />
      <Routes>

        {/* ── Public routes ──────────────────────────────────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/portal" element={<PortalPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/u/:username" element={<PublicProfile />} />

        {/* ── Theme setup (semi-public — no ThemeGate wrapping needed) ───── */}
        <Route path="/theme-selection" element={<ThemeSelectionPage />} />
        <Route path="/theme-confirmation" element={<ThemeConfirmationPage />} />

        {/* ── Protected routes ───────────────────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute guestPortal="student">
              <ThemeGate>
                <DashboardRoleRedirect>
                  <Dashboard />
                </DashboardRoleRedirect>
              </ThemeGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <ThemeGate><Analytics /></ThemeGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/college-tpos"
          element={
            <ProtectedRoute>
              <ThemeGate><CollegeTpoDirectoryPage /></ThemeGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ThemeGate><Profile /></ThemeGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ThemeGate><SettingsPage /></ThemeGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/club/leaderboard"
          element={
            <ProtectedRoute>
              <ThemeGate><LeaderboardPage /></ThemeGate>
            </ProtectedRoute>
          }
        />
        {/* Phase 12A: moved under /club/*. Redirect keeps old links working. */}
        <Route path="/leaderboard" element={<Navigate to="/club/leaderboard" replace />} />

        {/* ── Club hub — Leaderboard, Public/Private Contests, Battle Rooms, Ambassador ── */}
        <Route
          path="/club"
          element={
            <ProtectedRoute>
              <ThemeGate><ClubPage /></ThemeGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/problems"
          element={
            <ProtectedRoute guestPortal="student">
              <ThemeGate><ProblemsPage /></ThemeGate>
            </ProtectedRoute>
          }
        />

        {/* ProblemDetailsPage contains Monaco Editor (~3MB chunk).         */}
        {/* Lazy-loading this route alone saves ~60% of initial bundle.     */}
        <Route
          path="/problems/:slug"
          element={
            <ProtectedRoute guestPortal="student">
              <ThemeGate><ProblemDetailsPage /></ThemeGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/tpo/signup"
          element={
            <ProtectedRoute>
              <TpoSignupPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tpo/dashboard"
          element={
            <ProtectedRoute guestPortal="tpo">
              <RoleRoute allowedRoles={["tpo", "admin"]}>
                <TpoDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />


        {/* ── Phase 7: Recruiter ──────────────────────────────────────── */}
        <Route path="/recruiter/signup" element={<ProtectedRoute><RecruiterSignupPage /></ProtectedRoute>} />
        <Route
          path="/recruiter/dashboard"
          element={
            <ProtectedRoute guestPortal="recruiter">
              <RoleRoute allowedRoles={["recruiter", "admin"]}>
                <RecruiterDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* ── Phase 7: Candidate tests ────────────────────────────────── */}
        <Route path="/candidate/tests" element={<ProtectedRoute><CandidateTestsPage /></ProtectedRoute>} />

        {/* ── Phase 7: Certifications ─────────────────────────────────── */}
        <Route path="/certifications" element={<ProtectedRoute><ThemeGate><CertificationsPage /></ThemeGate></ProtectedRoute>} />
        <Route path="/verify/:code" element={<CertVerifyPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* ── Phase 7: Contests ───────────────────────────────────────── */}
        <Route path="/club/public-contests" element={<ProtectedRoute><ThemeGate><ContestsPage /></ThemeGate></ProtectedRoute>} />
        <Route path="/club/public-contests/:id" element={<ProtectedRoute><ThemeGate><ContestDetailPage /></ThemeGate></ProtectedRoute>} />
        <Route path="/club/private-contests" element={<ProtectedRoute><ThemeGate><PrivateContestsPage /></ThemeGate></ProtectedRoute>} />
        <Route path="/club/battle-rooms" element={<ProtectedRoute><ThemeGate><BattleRoomsPage /></ThemeGate></ProtectedRoute>} />
        <Route path="/club/battle-rooms/:id" element={<ProtectedRoute><ThemeGate><BattleRoomDetailPage /></ThemeGate></ProtectedRoute>} />
        <Route path="/verify-college" element={<ProtectedRoute><ThemeGate><CollegeVerifyConfirmPage /></ThemeGate></ProtectedRoute>} />

        {/* ── Opportunity Radar ─────────────────────────────────────────
            Fully public — no ProtectedRoute/ThemeGate. This is exactly
            the page a QR code / shared card sends a logged-out visitor
            to; requiring login here would break the whole distribution
            flow described in the feature spec (research → admin review
            → Code Club page → external application). */}
        <Route path="/opportunities" element={<OpportunityRadarPage />} />
        <Route path="/opportunities/:ccId" element={<OpportunityDetailPage />} />

        {/* Phase 12A: contests moved under /club/*. Redirects so any
            existing bookmarks/links to the old paths keep working. */}
        <Route path="/contests" element={<Navigate to="/club/public-contests" replace />} />
        <Route path="/contests/:id" element={<RedirectToContestDetail />} />

        {/* ── Phase 8: Campus Ambassador Portal ──────────────────────── */}
        <Route path="/ambassador" element={<ProtectedRoute><ThemeGate><AmbassadorPage /></ThemeGate></ProtectedRoute>} />

        {/* ── Phase 2F: Contribution Infrastructure ────────────────────── */}
        <Route path="/contribute" element={<ProtectedRoute><ThemeGate><ContributionsPage /></ThemeGate></ProtectedRoute>} />

        {/* ── Phase 3: Token Economy — Credits balance + history ───────── */}
        <Route path="/credits" element={<ProtectedRoute><ThemeGate><CreditsPage /></ThemeGate></ProtectedRoute>} />

        {/* ── Phase 4: Rewards Store — browse + redeem + redemption history ── */}
        <Route path="/rewards-store" element={<ProtectedRoute><ThemeGate><RewardsStorePage /></ThemeGate></ProtectedRoute>} />

        {/* ── Phase 5: Feature Requests — public board + submit + vote ──── */}
        <Route path="/feature-requests" element={<ProtectedRoute><ThemeGate><FeatureRequestsPage /></ThemeGate></ProtectedRoute>} />

        {/* ── Phase 9: Pricing Page ───────────────────────────────────── */}
        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <ThemeGate>
                <PricingPage />
              </ThemeGate>
            </ProtectedRoute>
          }
        />
        {/* ── Phase 10: Interview Mode ────────────────────────────────── */}
        {/* Audit fix: this route was previously registered without a
            :slug param, but InterviewModePage reads useParams().slug and
            sends it straight to POST /api/interview/start, which the
            backend rejects (slug is a required field) — the page could
            never actually start a session even when reached directly.
            There was also no link anywhere in the app pointing here; see
            the launch button added in ProblemInfo.jsx. */}
        <Route
          path="/interview-mode/:slug"
          element={
            <ProtectedRoute>
              <ThemeGate>
                <PremiumRoute feature="Interview Mode">
                  <InterviewModePage />
                </PremiumRoute>
              </ThemeGate>
            </ProtectedRoute>
          }
        />

        {/* ── Phase C: Admin Console + View-As God Mode ────────────────── */}
        {/* Plan 001: dedicated layout/nav via nested routes. Guard stays on
            the parent only — RoleRoute renders AdminLayout, whose <Outlet />
            resolves to whichever child route below matched. Every /admin/*
            path inherits this guard automatically; nothing below repeats it. */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={["admin"]}>
                <AdminLayout />
              </RoleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="colleges" element={<AdminCollegesPage />} />
          <Route path="problems" element={<AdminProblemsPage />} />
          <Route path="opportunities" element={<AdminOpportunitiesPage />} />
          <Route path="contributions" element={<AdminContributionsPage />} />
          <Route path="reward-store" element={<AdminRewardsStorePage />} />
          <Route path="feature-requests" element={<AdminFeatureRequestsPage />} />
          <Route path="opportunities/import" element={<AdminOpportunityImportPage />} />
          <Route path="opportunities/new" element={<AdminOpportunityFormPage />} />
          <Route path="opportunities/:id/edit" element={<AdminOpportunityFormPage />} />
          <Route path="opportunities/:id/share" element={<AdminGenerateShareCardPage />} />
          <Route path="opportunities/:id/analytics" element={<AdminOpportunityAnalyticsPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="system-health" element={<AdminSystemHealthPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />

      </Routes>
      </DailyQuizProvider>
    </Suspense>
  );
}

export default App;