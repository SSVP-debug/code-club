import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TpoCohortImportModal from "./TpoCohortImportModal";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

function csvFile(name = "roster.csv") {
  return new File(["email\na@b.com"], name, { type: "text/csv" });
}

function selectFile(file) {
  const input = document.getElementById("cohort-csv-file");
  fireEvent.change(input, { target: { files: [file] } });
}

describe("TpoCohortImportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a .csv file and shows its name", () => {
    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile("students.csv"));
    expect(screen.getByText("students.csv")).toBeInTheDocument();
  });

  it("rejects a non-.csv file with a client-side message, before any upload", () => {
    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(new File(["not a csv"], "roster.xlsx", { type: "application/vnd.ms-excel" }));

    expect(screen.getByText("Please choose a .csv file.")).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("disables Import until a valid file is chosen", () => {
    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("uploads the file via multipart/form-data with field name 'file', without collegeId", async () => {
    apiFetch.mockResolvedValueOnce({
      importBatchId: "batch-1",
      summary: { totalRows: 1, processed: 1, active: 1, invited: 0, alreadyMember: 0, duplicates: 0, errors: 0 },
      rows: [{ row: 2, email: "a@b.com", status: "active" }],
    });

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const [path, options] = apiFetch.mock.calls[0];
    expect(path).toBe("/api/tpo/cohorts/c1/import");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("file")).toBeInstanceOf(File);
    expect(options.body.get("collegeId")).toBeNull();
  });

  it("shows an 'Importing…' busy state (no fake progress bar) and disables duplicate submissions", async () => {
    let resolveUpload;
    apiFetch.mockReturnValueOnce(new Promise((resolve) => { resolveUpload = resolve; }));

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("Importing…")).toBeInTheDocument();
    // The button itself is disabled while uploading, so a second click can't fire a second request.
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();
    expect(apiFetch).toHaveBeenCalledTimes(1);

    resolveUpload({ importBatchId: "b1", summary: { totalRows: 0, processed: 0, active: 0, invited: 0, alreadyMember: 0, duplicates: 0, errors: 0 }, rows: [] });
    await waitFor(() => expect(screen.getByText("Import complete")).toBeInTheDocument());
  });

  it("renders the actual backend summary fields, not hardcoded assumptions", async () => {
    apiFetch.mockResolvedValueOnce({
      importBatchId: "batch-1",
      summary: { totalRows: 100, processed: 92, active: 75, invited: 10, alreadyMember: 7, duplicates: 4, errors: 8 },
      rows: [],
    });

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(screen.getByText("Import complete")).toBeInTheDocument());
    expect(screen.getByText("100 rows processed")).toBeInTheDocument();
    expect(screen.getByText("75 active")).toBeInTheDocument();
    expect(screen.getByText("10 invited")).toBeInTheDocument();
    expect(screen.getByText("7 already members")).toBeInTheDocument();
    expect(screen.getByText("4 duplicates")).toBeInTheDocument();
    expect(screen.getByText("8 errors")).toBeInTheDocument();
  });

  it("shows row-level results, including the reason for an error row, using the backend's own status names", async () => {
    apiFetch.mockResolvedValueOnce({
      importBatchId: "batch-1",
      summary: { totalRows: 2, processed: 1, active: 1, invited: 0, alreadyMember: 0, duplicates: 0, errors: 1 },
      rows: [
        { row: 2, email: "good@example.edu", status: "active" },
        { row: 3, email: "bad-email", status: "error", reason: "invalid_email" },
      ],
    });

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(screen.getByText("good@example.edu")).toBeInTheDocument());
    expect(screen.getByText("bad-email")).toBeInTheDocument();
    expect(screen.getByText("error · invalid_email")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("calls onImported after a successful upload so the roster refreshes", async () => {
    const onImported = vi.fn();
    apiFetch.mockResolvedValueOnce({
      importBatchId: "batch-1",
      summary: { totalRows: 1, processed: 1, active: 1, invited: 0, alreadyMember: 0, duplicates: 0, errors: 0 },
      rows: [],
    });

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={onImported} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(onImported).toHaveBeenCalled());
  });

  it("shows a clean server error message without exposing a stack trace, and allows retry", async () => {
    apiFetch.mockRejectedValueOnce(new Error("The CSV must include an 'email' column."));

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("The CSV must include an 'email' column.")).toBeInTheDocument();
    // Still on the picker view (no result), so the person can pick a corrected file and retry.
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  it("handles a network failure without crashing", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });

  it("'Import Another' resets back to the file picker", async () => {
    apiFetch.mockResolvedValueOnce({
      importBatchId: "batch-1",
      summary: { totalRows: 1, processed: 1, active: 1, invited: 0, alreadyMember: 0, duplicates: 0, errors: 0 },
      rows: [],
    });

    render(<TpoCohortImportModal cohortId="c1" onClose={vi.fn()} onImported={vi.fn()} />);
    selectFile(csvFile());
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => expect(screen.getByText("Import complete")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Import Another" }));

    expect(screen.getByText("Choose a CSV file")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked before uploading", () => {
    const onClose = vi.fn();
    render(<TpoCohortImportModal cohortId="c1" onClose={onClose} onImported={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
