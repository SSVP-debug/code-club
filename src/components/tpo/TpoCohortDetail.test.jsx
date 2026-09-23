import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TpoCohortDetail from "./TpoCohortDetail";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: toastMock }));

// TpoCohortFormModal and TpoCohortRoster each have their own dedicated
// test files — stub them here so this file only asserts the detail
// view's own header/edit-trigger/archive logic, not their internals.
vi.mock("./TpoCohortFormModal", () => ({
  default: ({ cohort, onSaved }) => (
    <div data-testid="form-modal-stub">
      <button onClick={() => onSaved({ ...cohort, name: "Edited Name" })}>save-edit-stub</button>
    </div>
  ),
}));
vi.mock("./TpoCohortRoster", () => ({
  default: ({ cohortId, cohortStatus }) => (
    <div data-testid="roster-stub">roster-for-{cohortId}-status-{cohortStatus}</div>
  ),
}));

const activeCohort = {
  id: "c1", name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027,
  branch: "Computer Science", section: "A", expectedHeadcount: 60,
  status: "active", archivedAt: null, archivedBy: null,
};

function renderDetail(cohortId = "c1", props = {}) {
  return render(<TpoCohortDetail cohortId={cohortId} onBack={vi.fn()} onCohortChanged={vi.fn()} {...props} />);
}

describe("TpoCohortDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the cohort header fields", async () => {
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail();

    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());
    expect(screen.getByText(/Computer Science.*2024-2025.*Graduating 2027.*Section A/)).toBeInTheDocument();
    expect(screen.getByText("Expected headcount: 60")).toBeInTheDocument();
  });

  it("renders the roster below the header", async () => {
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId("roster-stub")).toBeInTheDocument());
    expect(screen.getByText("roster-for-c1-status-active")).toBeInTheDocument();
  });

  it("passes the cohort's archived status through to the roster, so it can freeze mutations (TPO-2 closure audit)", async () => {
    apiFetch.mockResolvedValueOnce({ ...activeCohort, status: "archived" });
    renderDetail();
    await waitFor(() => expect(screen.getByText("roster-for-c1-status-archived")).toBeInTheDocument());
  });

  it("shows a retry-able error state if the cohort fails to load", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Failed to load cohort."));
    renderDetail();
    expect(await screen.findByText("Failed to load cohort.")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls onBack when 'Back to cohorts' is clicked", async () => {
    const onBack = vi.fn();
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail("c1", { onBack });

    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/back to cohorts/i));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows the Archive action for an active cohort, and no 'Archived' badge", async () => {
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail();
    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /archive/i })).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
  });

  it("hides the Archive action and shows an 'Archived' badge for an already-archived cohort", async () => {
    apiFetch.mockResolvedValueOnce({
      ...activeCohort, status: "archived", archivedAt: "2026-01-01T00:00:00.000Z", archivedBy: "u1",
    });
    renderDetail();
    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("archive: opens a confirmation dialog that doesn't overclaim assignment/privacy behavior", async () => {
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail();
    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /archive/i }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Archive CSE 2027\?/)).toBeInTheDocument();
    const description = within(dialog).getByText(/keeps this cohort and its roster/i);
    expect(description.textContent).not.toMatch(/assignment/i);
    expect(description.textContent).not.toMatch(/privacy/i);
  });

  it("archive: confirming calls POST /archive and updates the displayed status", async () => {
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail();
    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());

    apiFetch.mockResolvedValueOnce({ ...activeCohort, status: "archived", alreadyArchived: false });
    fireEvent.click(screen.getByRole("button", { name: /archive/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Archive" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/tpo/cohorts/c1/archive", expect.objectContaining({ method: "POST" }))
    );
    await waitFor(() => expect(screen.getByText("Archived")).toBeInTheDocument());
    expect(toastMock.success).toHaveBeenCalledWith("Cohort archived.");
  });

  it("archive: handles the idempotent already-archived response distinctly, without erroring", async () => {
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail();
    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());

    apiFetch.mockResolvedValueOnce({ ...activeCohort, status: "archived", alreadyArchived: true });
    fireEvent.click(screen.getByRole("button", { name: /archive/i }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("This cohort is already archived."));
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("edit: clicking Edit opens the form modal, and a save updates the displayed header", async () => {
    const onCohortChanged = vi.fn();
    apiFetch.mockResolvedValueOnce(activeCohort);
    renderDetail("c1", { onCohortChanged });
    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByTestId("form-modal-stub")).toBeInTheDocument();

    fireEvent.click(screen.getByText("save-edit-stub"));

    await waitFor(() => expect(screen.getByText("Edited Name")).toBeInTheDocument());
    expect(onCohortChanged).toHaveBeenCalled();
    expect(screen.queryByTestId("form-modal-stub")).not.toBeInTheDocument();
  });
});
