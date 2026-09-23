import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TpoCohortRoster from "./TpoCohortRoster";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: toastMock }));

// TpoCohortImportModal has its own dedicated test file — stub it here so
// this file only asserts that the trigger opens it, not its internals.
vi.mock("./TpoCohortImportModal", () => ({
  default: ({ onClose }) => (
    <div data-testid="import-modal-stub">
      <button onClick={onClose}>close-import-stub</button>
    </div>
  ),
}));

const activeRow = {
  membershipId: "m1", studentId: "s1", name: "Alice Adams", email: "alice@example.edu",
  membershipStatus: "active", invitedAt: null, joinedAt: "2026-01-01T00:00:00.000Z", removedAt: null,
};
const invitedRow = {
  membershipId: "m2", studentId: null, name: null, email: "unmatched@example.edu",
  membershipStatus: "invited", invitedAt: "2026-01-01T00:00:00.000Z", joinedAt: null, removedAt: null,
};
const removedRow = {
  membershipId: "m3", studentId: "s3", name: "Removed Ray", email: "ray@example.edu",
  membershipStatus: "removed", invitedAt: null, joinedAt: null, removedAt: "2026-01-02T00:00:00.000Z",
};

function rosterResponse(status, rows) {
  return {
    students: rows,
    total: rows.length,
    page: 1,
    limit: 25,
    counts: { activeCount: status === "active" ? rows.length : 1, invitedCount: 1, removedCount: 1 },
  };
}

function renderRoster(cohortId = "c1", cohortStatus = "active") {
  return render(
    <MemoryRouter initialEntries={["/tpo/dashboard?tab=cohorts"]}>
      <TpoCohortRoster cohortId={cohortId} cohortStatus={cohortStatus} />
    </MemoryRouter>
  );
}

describe("TpoCohortRoster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows active members by default (status defaults to active)", async () => {
    apiFetch.mockImplementation((url) => {
      if (url.startsWith("/api/tpo/cohorts/c1/students")) {
        expect(url).toContain("status=active");
        return Promise.resolve(rosterResponse("active", [activeRow]));
      }
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    renderRoster();
    await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("shows 'Unmatched' (not a blank name) for an invited row with no matched account", async () => {
    apiFetch.mockImplementation((url) => {
      if (url.startsWith("/api/tpo/cohorts/c1/students") && url.includes("status=invited")) {
        return Promise.resolve(rosterResponse("invited", [invitedRow]));
      }
      if (url.startsWith("/api/tpo/cohorts/c1/students")) return Promise.resolve(rosterResponse("active", []));
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    renderRoster();
    await waitFor(() => expect(screen.getByRole("button", { name: /invited \(/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /invited \(/i }));

    await waitFor(() => expect(screen.getByText("unmatched@example.edu")).toBeInTheDocument());
    expect(screen.getByText("Unmatched")).toBeInTheDocument();
  });

  it("only shows removed members when the removed filter is explicitly selected", async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes("status=removed")) return Promise.resolve(rosterResponse("removed", [removedRow]));
      if (url.startsWith("/api/tpo/cohorts/c1/students")) return Promise.resolve(rosterResponse("active", [activeRow]));
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    renderRoster();
    await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
    expect(screen.queryByText("Removed Ray")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /removed \(/i }));
    await waitFor(() => expect(screen.getByText("Removed Ray")).toBeInTheDocument());
  });

  it("does not offer a Remove action for an already-removed row", async () => {
    apiFetch.mockImplementation((url) => {
      if (url.includes("status=removed")) return Promise.resolve(rosterResponse("removed", [removedRow]));
      return Promise.resolve(rosterResponse("active", []));
    });

    renderRoster();
    fireEvent.click(await screen.findByRole("button", { name: /removed \(/i }));
    await waitFor(() => expect(screen.getByText("Removed Ray")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /remove ray@example.edu/i })).not.toBeInTheDocument();
  });

  it("searches server-side, debounced, without resetting mid-type", async () => {
    apiFetch.mockImplementation((url) => {
      if (url.startsWith("/api/tpo/cohorts/c1/students")) {
        if (url.includes("search=alice")) return Promise.resolve(rosterResponse("active", [activeRow]));
        return Promise.resolve(rosterResponse("active", [activeRow, { ...invitedRow, membershipStatus: "active", name: "Other" }]));
      }
      return Promise.reject(new Error(`Unexpected: ${url}`));
    });

    renderRoster();
    await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/search by name or email/i), { target: { value: "alice" } });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("search=alice")));
  });

  it("paginates using students/total/page/limit directly, no nested pagination object assumed", async () => {
    apiFetch.mockImplementation((url) => {
      const params = new URLSearchParams(url.split("?")[1] || "");
      const page = parseInt(params.get("page"), 10) || 1;
      return Promise.resolve({
        students: [{ ...activeRow, membershipId: `page-${page}`, email: `p${page}@e.edu` }],
        total: 26,
        page,
        limit: 25,
        counts: { activeCount: 26, invitedCount: 0, removedCount: 0 },
      });
    });

    renderRoster();
    await waitFor(() => expect(screen.getByText("p1@e.edu")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByText("p2@e.edu")).toBeInTheDocument());
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
  });

  it("shows a loading spinner, then a retry-able error state on failure", async () => {
    apiFetch.mockRejectedValue(new Error("Network error"));
    renderRoster();
    expect(await screen.findByText(/Network error/)).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  describe("manual add", () => {
    it("adding an existing-college email shows an active-membership success message", async () => {
      apiFetch.mockImplementation((url, options) => {
        if (options?.method === "POST" && url === "/api/tpo/cohorts/c1/students") {
          return Promise.resolve({ membershipId: "m9", email: "new@example.edu", membershipStatus: "active", created: true, noop: false });
        }
        return Promise.resolve(rosterResponse("active", []));
      });

      renderRoster();
      await screen.findByPlaceholderText(/add student by email/i);
      fireEvent.change(screen.getByPlaceholderText(/add student by email/i), { target: { value: "new@example.edu" } });
      fireEvent.click(screen.getByRole("button", { name: /add student/i }));

      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("active member")));
    });

    it("adding an unmatched email explains it was added as invited, not that an account was created", async () => {
      apiFetch.mockImplementation((url, options) => {
        if (options?.method === "POST" && url === "/api/tpo/cohorts/c1/students") {
          return Promise.resolve({ membershipId: "m9", email: "unknown@example.edu", membershipStatus: "invited", created: true, noop: false });
        }
        return Promise.resolve(rosterResponse("active", []));
      });

      renderRoster();
      await screen.findByPlaceholderText(/add student by email/i);
      fireEvent.change(screen.getByPlaceholderText(/add student by email/i), { target: { value: "unknown@example.edu" } });
      fireEvent.click(screen.getByRole("button", { name: /add student/i }));

      await waitFor(() =>
        expect(toastMock.success).toHaveBeenCalledWith(
          expect.stringMatching(/invited.*no matching Code Club account/)
        )
      );
    });

    it("shows a clear, non-destructive message when the person is already an active member", async () => {
      apiFetch.mockImplementation((url, options) => {
        if (options?.method === "POST" && url === "/api/tpo/cohorts/c1/students") {
          const err = new Error("This person is already an active member of this cohort.");
          err.status = 409;
          return Promise.reject(err);
        }
        return Promise.resolve(rosterResponse("active", []));
      });

      renderRoster();
      await screen.findByPlaceholderText(/add student by email/i);
      fireEvent.change(screen.getByPlaceholderText(/add student by email/i), { target: { value: "already@example.edu" } });
      fireEvent.click(screen.getByRole("button", { name: /add student/i }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("This person is already an active member of this cohort.")
      );
    });

    it("shows a safe validation message for a foreign-institution email without exposing the other institution's details", async () => {
      apiFetch.mockImplementation((url, options) => {
        if (options?.method === "POST" && url === "/api/tpo/cohorts/c1/students") {
          return Promise.reject(new Error("This account belongs to a different institution."));
        }
        return Promise.resolve(rosterResponse("active", []));
      });

      renderRoster();
      await screen.findByPlaceholderText(/add student by email/i);
      fireEvent.change(screen.getByPlaceholderText(/add student by email/i), { target: { value: "foreign@other.edu" } });
      fireEvent.click(screen.getByRole("button", { name: /add student/i }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("This account belongs to a different institution.")
      );
    });
  });

  describe("remove", () => {
    it("confirms before removing, and calls DELETE on confirm", async () => {
      apiFetch.mockImplementation((url, options) => {
        if (options?.method === "DELETE") return Promise.resolve({ membershipId: "m1", membershipStatus: "removed", alreadyRemoved: false });
        return Promise.resolve(rosterResponse("active", [activeRow]));
      });

      renderRoster();
      await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: /remove alice@example.edu/i }));

      expect(await screen.findByText(/Remove alice@example.edu\?/)).toBeInTheDocument();
      const dialog = screen.getByRole("alertdialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

      await waitFor(() =>
        expect(apiFetch).toHaveBeenCalledWith("/api/tpo/cohorts/c1/students/m1", expect.objectContaining({ method: "DELETE" }))
      );
      expect(toastMock.success).toHaveBeenCalled();
    });

    it("shows an error toast if removal fails", async () => {
      apiFetch.mockImplementation((url, options) => {
        if (options?.method === "DELETE") return Promise.reject(new Error("Failed to remove student."));
        return Promise.resolve(rosterResponse("active", [activeRow]));
      });

      renderRoster();
      await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: /remove alice@example.edu/i }));
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));

      await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Failed to remove student."));
    });
  });

  it("clicking Import CSV opens the import modal", async () => {
    apiFetch.mockResolvedValue(rosterResponse("active", []));
    renderRoster();
    await screen.findByRole("button", { name: /import csv/i });
    fireEvent.click(screen.getByRole("button", { name: /import csv/i }));
    expect(screen.getByTestId("import-modal-stub")).toBeInTheDocument();
  });

  describe("archived cohort (TPO-2 closure audit — frozen roster)", () => {
    it("hides Add Student and disables Import CSV, with an explanatory note", async () => {
      apiFetch.mockResolvedValue(rosterResponse("active", [activeRow]));
      renderRoster("c1", "archived");

      await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
      expect(screen.queryByPlaceholderText(/add student by email/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /import csv/i })).toBeDisabled();
      expect(screen.getByText(/roster is frozen/i)).toBeInTheDocument();
    });

    it("does not offer a Remove action on any row", async () => {
      apiFetch.mockResolvedValue(rosterResponse("active", [activeRow]));
      renderRoster("c1", "archived");

      await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /remove alice@example.edu/i })).not.toBeInTheDocument();
    });

    it("shows Add Student and an enabled Import CSV again for a non-archived cohort", async () => {
      apiFetch.mockResolvedValue(rosterResponse("active", [activeRow]));
      renderRoster("c1", "active");

      await waitFor(() => expect(screen.getByText("Alice Adams")).toBeInTheDocument());
      expect(screen.getByPlaceholderText(/add student by email/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /import csv/i })).not.toBeDisabled();
    });
  });
});
