import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TpoTeamPanel from "./TpoTeamPanel";

const apiFetch = vi.fn();
vi.mock("../../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: toastMock }));

const teamResponse = {
  collegeName: "Example University",
  domain: "example.edu",
  primaryTpoId: "p1",
  team: [
    { id: "p1", name: "Priya Primary", email: "priya@example.edu", isPrimary: true, verified: true },
    { id: "s1", name: "Sam Secondary", email: "sam@example.edu", isPrimary: false, verified: true },
    { id: "u1", name: "Uma Unverified", email: "uma@example.edu", isPrimary: false, verified: false },
  ],
};

function mockFetches({ team = teamResponse, me = { isPrimary: true } } = {}) {
  apiFetch.mockImplementation((path) => {
    if (path === "/api/tpo/team") return Promise.resolve(team);
    if (path === "/api/tpo/me") return Promise.resolve(me);
    return Promise.reject(new Error(`Unexpected apiFetch: ${path}`));
  });
}

describe("TpoTeamPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the team roster with a primary badge and pending badge", async () => {
    mockFetches();
    render(<TpoTeamPanel />);

    await waitFor(() => expect(screen.getByText("Priya Primary")).toBeInTheDocument());
    expect(screen.getByText("Sam Secondary")).toBeInTheDocument();
    expect(screen.getByText("Uma Unverified")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows the invite form and per-row actions for a primary TPO", async () => {
    mockFetches({ me: { isPrimary: true } });
    render(<TpoTeamPanel />);

    await waitFor(() => expect(screen.getByText("Sam Secondary")).toBeInTheDocument());
    expect(screen.getByPlaceholderText(/college.edu/)).toBeInTheDocument();
    expect(screen.getAllByText("Remove").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Make Primary").length).toBeGreaterThan(0);
  });

  it("hides the invite form and mutation actions for a secondary TPO (backend still enforces this)", async () => {
    mockFetches({ me: { isPrimary: false } });
    render(<TpoTeamPanel />);

    await waitFor(() => expect(screen.getByText("Sam Secondary")).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/college.edu/)).not.toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    expect(screen.queryByText("Make Primary")).not.toBeInTheDocument();
  });

  it("does not offer to remove or transfer the primary TPO's own row", async () => {
    mockFetches({ me: { isPrimary: true } });
    render(<TpoTeamPanel />);

    await waitFor(() => expect(screen.getByText("Priya Primary")).toBeInTheDocument());
    // Only the two non-primary rows should get action buttons: one
    // "Remove" each, and "Make Primary" only for the verified one.
    expect(screen.getAllByText("Remove")).toHaveLength(2);
    expect(screen.getAllByText("Make Primary")).toHaveLength(1); // Uma is unverified, no transfer offered
  });

  it("submits an invite and refreshes the team", async () => {
    mockFetches({ me: { isPrimary: true } });
    apiFetch.mockImplementation((path, options) => {
      if (path === "/api/tpo/team") return Promise.resolve(teamResponse);
      if (path === "/api/tpo/me") return Promise.resolve({ isPrimary: true });
      if (path === "/api/tpo/team/invite" && options?.method === "POST") {
        return Promise.resolve({ success: true });
      }
      return Promise.reject(new Error(`Unexpected apiFetch: ${path}`));
    });

    render(<TpoTeamPanel />);
    await waitFor(() => expect(screen.getByText("Sam Secondary")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/college.edu/), { target: { value: "new@example.edu" } });
    fireEvent.click(screen.getByText("Add TPO"));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/tpo/team/invite",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "new@example.edu" }) })
      )
    );
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("removing a teammate opens a confirm dialog, then calls DELETE on confirm", async () => {
    mockFetches({ me: { isPrimary: true } });
    apiFetch.mockImplementation((path, options) => {
      if (path === "/api/tpo/team") return Promise.resolve(teamResponse);
      if (path === "/api/tpo/me") return Promise.resolve({ isPrimary: true });
      if (path === "/api/tpo/team/s1" && options?.method === "DELETE") {
        return Promise.resolve({ success: true });
      }
      return Promise.reject(new Error(`Unexpected apiFetch: ${path}`));
    });

    render(<TpoTeamPanel />);
    await waitFor(() => expect(screen.getByText("Sam Secondary")).toBeInTheDocument());

    const [removeButton] = screen.getAllByText("Remove");
    fireEvent.click(removeButton);

    expect(await screen.findByText(/Remove Sam Secondary\?/)).toBeInTheDocument();

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/tpo/team/s1", expect.objectContaining({ method: "DELETE" }))
    );
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("transferring primary opens a confirm dialog, then calls the make-primary endpoint on confirm", async () => {
    mockFetches({ me: { isPrimary: true } });
    apiFetch.mockImplementation((path, options) => {
      if (path === "/api/tpo/team") return Promise.resolve(teamResponse);
      if (path === "/api/tpo/me") return Promise.resolve({ isPrimary: true });
      if (path === "/api/tpo/team/s1/make-primary" && options?.method === "POST") {
        return Promise.resolve({ success: true, primaryTpoId: "s1" });
      }
      return Promise.reject(new Error(`Unexpected apiFetch: ${path}`));
    });

    render(<TpoTeamPanel />);
    await waitFor(() => expect(screen.getByText("Sam Secondary")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Make Primary"));
    expect(await screen.findByText(/Make Sam Secondary the primary TPO\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/tpo/team/s1/make-primary",
        expect.objectContaining({ method: "POST" })
      )
    );
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("shows an empty state when the college has no TPOs", async () => {
    mockFetches({ team: { ...teamResponse, team: [] } });
    render(<TpoTeamPanel />);
    expect(await screen.findByText(/No TPOs found/)).toBeInTheDocument();
  });

  it("shows a retry-able error state when the team fetch fails", async () => {
    apiFetch.mockImplementation((path) => {
      if (path === "/api/tpo/team") return Promise.reject(new Error("Network error"));
      if (path === "/api/tpo/me") return Promise.resolve({ isPrimary: true });
      return Promise.reject(new Error("unexpected"));
    });
    render(<TpoTeamPanel />);
    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
