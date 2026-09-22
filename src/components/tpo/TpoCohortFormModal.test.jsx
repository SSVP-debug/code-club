import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TpoCohortFormModal from "./TpoCohortFormModal";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: toastMock }));

function fillCreateForm({
  name = "CSE 2027",
  academicYear = "2024-2025",
  graduatingYear = "2027",
  branch = "Computer Science",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText(/Name \(e\.g\./), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText(/Academic Year/), { target: { value: academicYear } });
  fireEvent.change(screen.getByPlaceholderText("Graduating Year"), { target: { value: graduatingYear } });
  fireEvent.change(screen.getByPlaceholderText(/Branch/), { target: { value: branch } });
}

describe("TpoCohortFormModal — create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty required fields and a Create button", () => {
    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Create Cohort")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("blocks submission and shows an error when required fields are empty", async () => {
    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid graduating year", async () => {
    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fillCreateForm({ graduatingYear: "abcd" });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Enter a valid four-digit year.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("rejects a negative expected headcount", async () => {
    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    fillCreateForm();
    fireEvent.change(screen.getByPlaceholderText("Expected Headcount"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Enter a non-negative whole number.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("submits only the editable fields on POST /api/tpo/cohorts and calls onSaved", async () => {
    const onSaved = vi.fn();
    const created = { id: "c1", name: "CSE 2027", status: "active" };
    apiFetch.mockResolvedValueOnce(created);

    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={onSaved} />);
    fillCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/tpo/cohorts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "CSE 2027",
            academicYear: "2024-2025",
            graduatingYear: 2027,
            branch: "Computer Science",
            section: "",
            expectedHeadcount: null,
          }),
        })
      )
    );
    expect(onSaved).toHaveBeenCalledWith(created);
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("shows a toast and does not call onSaved when the backend rejects the submission", async () => {
    const onSaved = vi.fn();
    apiFetch.mockRejectedValueOnce(new Error("graduatingYear must be a four-digit year."));

    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={onSaved} />);
    fillCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("graduatingYear must be a four-digit year."));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("never sends collegeId/createdBy/status/archivedAt/archivedBy — the form has no such fields", () => {
    render(<TpoCohortFormModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/collegeId/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/createdBy/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/status/i)).not.toBeInTheDocument();
  });
});

describe("TpoCohortFormModal — edit", () => {
  const existingCohort = {
    id: "c1",
    name: "CSE 2027",
    academicYear: "2024-2025",
    graduatingYear: 2027,
    branch: "Computer Science",
    section: "A",
    expectedHeadcount: 60,
    status: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pre-populates fields from the given cohort", () => {
    render(<TpoCohortFormModal cohort={existingCohort} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Edit Cohort")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CSE 2027")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2024-2025")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2027")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Computer Science")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("60")).toBeInTheDocument();
  });

  it("submits a PATCH to the cohort's own id on save", async () => {
    const onSaved = vi.fn();
    const updated = { ...existingCohort, name: "CSE 2027 (Updated)" };
    apiFetch.mockResolvedValueOnce(updated);

    render(<TpoCohortFormModal cohort={existingCohort} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByDisplayValue("CSE 2027"), { target: { value: "CSE 2027 (Updated)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/tpo/cohorts/c1",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("shows an error toast on a failed update without calling onSaved", async () => {
    const onSaved = vi.fn();
    apiFetch.mockRejectedValueOnce(new Error("Update failed."));

    render(<TpoCohortFormModal cohort={existingCohort} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Update failed."));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
