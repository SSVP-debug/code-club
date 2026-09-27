import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import VerificationQueueSection from "./VerificationQueueSection";

function renderSection(overrides = {}) {
  const onApprove = vi.fn();
  const onReject = vi.fn();
  render(
    <VerificationQueueSection
      heading="Pending recruiters"
      loading={false}
      emptyLabel="No pending recruiters."
      items={[{ id: "r1", company: "Acme" }]}
      busyIds={{}}
      getRow={(item) => ({ id: item.id, title: item.company, subtitle: "recruiter@acme.com" })}
      onApprove={onApprove}
      onReject={onReject}
      {...overrides}
    />
  );
  return { onApprove, onReject };
}

// Admin UX audit (Phase UI-3, P0): Reject used to fire on a single click.
// Approve keeps its fast one-click path (low friction is right for the
// common "yes" case, and it's easy to walk back later via suspend);
// Reject now requires confirmation since it discards the request outright.
describe("VerificationQueueSection", () => {
  it("approve fires immediately with no confirmation", () => {
    const { onApprove } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(onApprove).toHaveBeenCalledWith("r1");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("reject requires confirmation before firing", () => {
    const { onReject } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    expect(onReject).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith("r1");
  });

  it("shows TPO evidence and requires a rejection reason before submitting", () => {
    const { onReject } = renderSection({
      heading: "TPO requests",
      items: [{
        id: "t1",
        company: "MIT",
        reviewTarget: "user",
        evidence: [{
          kind: "staff_id",
          label: "Staff ID",
          reference: "staff-42",
          note: "Verified by applicant.",
        }],
        reviewHistory: [{
          decision: "rejected",
          decisionReason: "Previous evidence was insufficient.",
          reviewedAt: "2026-09-20T10:00:00Z",
          reviewedBy: { displayName: "Admin One", email: "admin@example.com" },
        }],
      }],
      getRow: (item) => ({
        id: item.id,
        title: item.company,
        subtitle: "staff@mit.edu",
        reviewTarget: item.reviewTarget,
        evidence: item.evidence,
        reviewHistory: item.reviewHistory,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: /review details/i }));
    expect(screen.getByText("Staff ID")).toBeInTheDocument();
    expect(screen.getByText(/Previous evidence was insufficient/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(onReject).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/decision reason/i), {
      target: { value: "The submitted staff evidence could not be verified." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledWith(
      "t1",
      "The submitted staff evidence could not be verified."
    );
  });

  it("cancelling the reject confirmation never calls onReject", () => {
    const { onReject } = renderSection();
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onReject).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});