import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TpoReportsPanel from "./TpoReportsPanel";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const report = {
  college: "Report University",
  collegeId: "college-1",
  range: {
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-09-30T23:59:59.999Z",
  },
  students: { total: 120, optedOut: 3, active: 72, activePercent: 60 },
  problems: {
    totalSolved: 840,
    averageSolved: 7,
    difficulty: { easy: 420, medium: 300, hard: 120 },
  },
  cohorts: { total: 4, active: 3, archived: 1, activeMemberships: 118 },
  assignments: {
    total: 6,
    active: 5,
    archived: 1,
    assignedStudents: 480,
    completedAssignments: 360,
    completionPercent: 75,
  },
};

describe("TpoReportsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue(report);
  });

  it("loads and renders the canonical institution report", async () => {
    render(<TpoReportsPanel />);

    expect(await screen.findByText("Institution Report")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === "Placement-preparation activity for Report University."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("120")).toHaveLength(2);
    expect(screen.getByText("840")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText(/3 students opted out of TPO visibility/i)).toBeInTheDocument();
  });

  it("uses the selected date range when Apply is clicked", async () => {
    render(<TpoReportsPanel />);
    await screen.findByText("Institution Report");

    fireEvent.change(screen.getByLabelText("Report start date"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Report end date"), { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenLastCalledWith(
        "/api/tpo/report/overview?from=2026-09-01T00%3A00%3A00.000Z&to=2026-09-30T23%3A59%3A59.999Z"
      );
    });
  });

  it("rejects an incomplete date range before making another request", async () => {
    render(<TpoReportsPanel />);
    await screen.findByText("Institution Report");
    const callsBefore = apiFetch.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Report start date"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByText("Choose a valid start and end date.")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(callsBefore);
  });

  it("shows a retry state when the initial report request fails", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Failed to load report."));
    render(<TpoReportsPanel />);

    expect(await screen.findByText("Failed to load report.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
