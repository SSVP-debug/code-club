import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CollegeTpoDirectoryPage from "./CollegeTpoDirectoryPage";

const apiFetch = vi.fn();

vi.mock("../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

vi.mock("../layouts/DashboardLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const directory = {
  college: { id: "college-1", name: "Report University" },
  tpos: [
    {
      id: "tpo-1",
      name: "Primary Officer",
      email: "primary@report.edu",
      collegeName: "Report University",
      isPrimary: true,
    },
    {
      id: "tpo-2",
      name: "Secondary Officer",
      email: "secondary@report.edu",
      collegeName: "Report University",
      isPrimary: false,
    },
  ],
};

describe("CollegeTpoDirectoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockResolvedValue(directory);
  });

  it("loads the verified TPO directory for the student's college", async () => {
    render(<CollegeTpoDirectoryPage />);

    expect(await screen.findByText("Find your College TPOs")).toBeInTheDocument();
    expect(screen.getAllByText("Report University").length).toBeGreaterThan(0);
    expect(screen.getByText("Primary Officer")).toBeInTheDocument();
    expect(screen.getByText("Secondary Officer")).toBeInTheDocument();
    expect(screen.getByText("primary@report.edu")).toBeInTheDocument();
    expect(screen.getByText("Primary TPO")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/api/tpo/college-directory");
  });

  it("shows a useful empty state when no verified TPOs exist", async () => {
    apiFetch.mockResolvedValueOnce({
      college: { id: "college-1", name: "Report University" },
      tpos: [],
    });

    render(<CollegeTpoDirectoryPage />);

    expect(await screen.findByText("No verified TPOs yet")).toBeInTheDocument();
    expect(screen.getByText(/does not currently have a verified TPO/i)).toBeInTheDocument();
  });

  it("shows the API error state", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Verify your college email first."));

    render(<CollegeTpoDirectoryPage />);

    expect(await screen.findByText("TPO directory unavailable")).toBeInTheDocument();
    expect(screen.getByText("Verify your college email first.")).toBeInTheDocument();
  });
});
