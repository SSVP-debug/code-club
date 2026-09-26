import PageMeta from "../../components/seo/PageMeta";
import DashboardMetricsSection from "../../components/admin/DashboardMetricsSection";
import ViewAsSection from "../../components/admin/ViewAsSection";
import DemoDatasetSection from "../../components/admin/DemoDatasetSection";
import VerificationQueueSection from "../../components/admin/VerificationQueueSection";
import { formatVerificationDate as formatDate } from "../../utils/formatVerificationDate";
import CommandCenterHero from "../../components/admin/command/CommandCenterHero";
import AttentionRequiredSection from "../../components/admin/command/AttentionRequiredSection";
import PlatformActivitySection from "../../components/admin/command/PlatformActivitySection";
import CollapsiblePanel from "../../components/admin/command/CollapsiblePanel";
import { useAdminVerificationQueue } from "../../hooks/useAdminVerificationQueue";

// Plan 001, migration decision (a): AdminConsolePage.jsx split so the
// "Users" nav item maps to a page that matches its label (AdminUsersPage).
// Everything else — View As, demo dataset, the three verification
// queues — stays here, mounted at the /admin index route.
//
// Plan 004: the operational-metrics stat-card grid is prepended here too,
// rather than as a separate page/route. Pending-approval anchor links
// (#recruiter-queue / #tpo-queue) target the ids on the queue wrappers
// below — kept exactly as-is so CommandCenterHero/AttentionRequiredSection/
// DashboardMetricsSection's existing links keep working unchanged.
//
// Command Center transformation (Overview): the page now reads top-to-
// bottom as status (hero) → numbers (metrics) → what needs action
// (Attention Required) → what just happened (Platform Activity, sourced
// from the real audit log) → deep-dive tools (verification queues + admin
// utilities, folded into collapsible panels so they don't compete with the
// operational summary for attention, but are one click away with real
// pending counts still visible on the queue panel's own header).
export default function AdminOverviewPage() {
  const {
    loading,
    recruiters,
    tpos,
    studentCollegeRequests,
    busyIds,
    pendingCount,
    actOnRecruiter,
    actOnTpo,
    actOnStudentCollege,
  } = useAdminVerificationQueue();

  return (
    <>
      <PageMeta title="Command Center — Code Club Admin" description="Live operational overview, verification queue, and role preview." />
      <div className="max-w-5xl mx-auto">
        <CommandCenterHero pendingCount={pendingCount} />

        <DashboardMetricsSection />

        <AttentionRequiredSection />

        <PlatformActivitySection />

        <CollapsiblePanel
          title="Verification queues"
          count={pendingCount}
          defaultOpen={pendingCount > 0}
        >
          <div id="recruiter-queue">
            <VerificationQueueSection
              heading="Recruiter requests"
              loading={loading}
              emptyLabel="No recruiters awaiting review."
              items={recruiters}
              busyIds={busyIds}
              getRow={(r) => ({
                id: r.id,
                title: r.companyName || r.email,
                subtitle: `${r.displayName || r.email} · ${r.designation || "—"}`,
                meta: `${r.companyDomain} · requested ${formatDate(r.requestedAt)}`,
              })}
              onApprove={(id) => actOnRecruiter(id, "approve")}
              onReject={(id) => actOnRecruiter(id, "reject")}
            />
          </div>

          <div id="tpo-queue">
            <VerificationQueueSection
              heading="TPO / college requests"
              loading={loading}
              emptyLabel="No colleges awaiting review."
              items={tpos}
              busyIds={busyIds}
              getRow={(t) => ({
                id: t.collegeId,
                title: t.collegeName,
                subtitle: t.requestedBy?.displayName || t.requestedBy?.email || "Unknown requester",
                meta: `${(t.domains || []).join(", ")} · requested ${formatDate(t.requestedAt)}`,
                signal: t.emailRoleSignal,
                evidenceHint: t.additionalEvidenceRecommended,
                evidence: t.evidence,
              })}
              onApprove={(id) => actOnTpo(id, "approve")}
              onReject={(id) => actOnTpo(id, "reject")}
            />
          </div>

          <VerificationQueueSection
            heading="College requests from students"
            loading={loading}
            emptyLabel="No student college requests awaiting review."
            items={studentCollegeRequests}
            busyIds={busyIds}
            getRow={(c) => ({
              id: c.collegeId,
              title: c.collegeName,
              subtitle: c.autoDetected
                ? "Auto-detected from a student signup — name is a guess, not yet reviewed"
                : c.requestedBy?.displayName || c.requestedBy?.email || "Unknown requester",
              meta: `${(c.domains || []).join(", ")}${c.website ? " · " + c.website : ""} · requested ${formatDate(c.requestedAt)}`,
            })}
            onApprove={(id) => actOnStudentCollege(id, "approve")}
            onReject={(id) => actOnStudentCollege(id, "reject")}
          />
        </CollapsiblePanel>

        <CollapsiblePanel title="Admin tools" defaultOpen={false}>
          <ViewAsSection />
          <DemoDatasetSection />
        </CollapsiblePanel>
      </div>
    </>
  );
}
