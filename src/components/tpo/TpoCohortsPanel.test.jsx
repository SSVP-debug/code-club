import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TpoCohortsPanel from "./TpoCohortsPanel";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: toastMock }));

// TpoCohortFormModal and TpoCohortDetail each have their own dedicated
// test files — stub them here so this file only asserts list/selection
// logic, not their internals.
vi.mock("./TpoCohortFormModal", () => ({
  default: ({ onSaved }) => (
    <div data-testid="form-modal-stub">
      <button onClick={() => onSaved({ id: "new-c1", name: "Brand New Cohort" })}>save-create-stub</button>
    </div>
  ),
}));
vi.mock("./TpoCohortDetail", () => ({
  default: ({ cohortId, onBack }) => (
    <div data-testid="detail-stub">
      detail-for-{cohortId}
      <button onClick={onBack}>back-stub</button>
    </div>
  ),
}));

const cohortA = {
  id: "c1", name: "CSE 2027", academicYear: "2024-2025", graduatingYear: 2027,
  branch: "Computer Science", section: "A", expectedHeadcount: 60, status: "active",
};
const cohortB = {
  id: "c2", name: "ECE 2026", academicYear: "2023-2024", graduatingYear: 2026,
  branch: "Electronics", section: null, expectedHeadcount: null, status: "archived",
};

function listResponse(items, total = items.length) {
  return { items, total, page: 1, limit: 25 };
}

function renderPanel(initialEntries = ["/tpo/dashboard?tab=cohorts"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <TpoCohortsPanel />
    </MemoryRouter>
  );
}

describe("TpoCohortsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading spinner, then the cohort list", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    renderPanel();
    expect(await screen.findByText("CSE 2027")).toBeInTheDocument();
    expect(screen.getByText(/Computer Science.*2024-2025.*Graduating 2027.*Section A/)).toBeInTheDocument();
  });

  it("shows an empty state with a Create Cohort action when there are no cohorts", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([]));
    renderPanel();
    expect(await screen.findByText("No cohorts yet")).toBeInTheDocument();
    expect(screen.getByText(/Create your first cohort/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /create cohort/i }).length).toBeGreaterThan(0);
  });

  it("shows a retry-able error state on failure", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Failed to load cohorts."));
    renderPanel();
    expect(await screen.findByText("Failed to load cohorts.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry"));
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("defaults to the active status filter", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    renderPanel();
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("status=active")));
  });

  it("switching the status filter to Archived refetches with the new status", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    renderPanel();
    await screen.findByText("CSE 2027");

    apiFetch.mockResolvedValueOnce(listResponse([cohortB]));
    fireEvent.change(screen.getByLabelText(/filter by status/i), { target: { value: "archived" } });

    await waitFor(() => expect(screen.getByText("ECE 2026")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenLastCalledWith(expect.stringContaining("status=archived"));
  });

  it("shows an 'Archived' badge on an archived cohort's card", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortB]));
    renderPanel();
    await waitFor(() => expect(screen.getByText("ECE 2026")).toBeInTheDocument());
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
  });

  it("searches server-side as you type (debounced)", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortA, cohortB]));
    renderPanel();
    await screen.findByText("CSE 2027");

    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    fireEvent.change(screen.getByPlaceholderText(/search cohorts by name/i), { target: { value: "cse" } });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("search=cse")));
  });

  it("paginates using items/total/page/limit directly", async () => {
    apiFetch.mockImplementation((url) => {
      const params = new URLSearchParams(url.split("?")[1] || "");
      const page = parseInt(params.get("page"), 10) || 1;
      return Promise.resolve(listResponse([{ ...cohortA, id: `page-${page}`, name: `Cohort Page ${page}` }], 30));
    });

    renderPanel();
    await screen.findByText("Cohort Page 1");
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByText("Cohort Page 2")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
  });

  it("clicking a cohort card opens its detail view", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    renderPanel();
    fireEvent.click(await screen.findByText("CSE 2027"));

    expect(screen.getByTestId("detail-stub")).toBeInTheDocument();
    expect(screen.getByText("detail-for-c1")).toBeInTheDocument();
  });

  it("going back from detail returns to the list", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    renderPanel();
    fireEvent.click(await screen.findByText("CSE 2027"));
    expect(screen.getByTestId("detail-stub")).toBeInTheDocument();

    apiFetch.mockResolvedValueOnce(listResponse([cohortA]));
    fireEvent.click(screen.getByText("back-stub"));

    await waitFor(() => expect(screen.getByText("CSE 2027")).toBeInTheDocument());
    expect(screen.queryByTestId("detail-stub")).not.toBeInTheDocument();
  });

  it("restores the selected cohort from the URL (?cohortId=) on mount, deep-link style", async () => {
    renderPanel(["/tpo/dashboard?tab=cohorts&cohortId=c9"]);
    expect(await screen.findByText("detail-for-c9")).toBeInTheDocument();
    // The list's own fetch never needed to run since the detail view opened directly.
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("create: opens the form modal, and a successful save refreshes the list and opens the new cohort", async () => {
    apiFetch.mockResolvedValueOnce(listResponse([]));
    renderPanel();
    await screen.findByText("No cohorts yet");

    fireEvent.click(screen.getAllByRole("button", { name: /create cohort/i })[0]);
    expect(screen.getByTestId("form-modal-stub")).toBeInTheDocument();

    apiFetch.mockResolvedValueOnce(listResponse([cohortA])); // refetch after save
    fireEvent.click(screen.getByText("save-create-stub"));

    await waitFor(() => expect(screen.getByText("detail-for-new-c1")).toBeInTheDocument());
  });
});
