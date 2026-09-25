import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CollegeTpoDirectoryPage from "./CollegeTpoDirectoryPage";

const apiFetch = vi.fn();
const share = vi.fn().mockResolvedValue(undefined);

vi.mock("../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

vi.mock("../utils/share", () => ({
  share: (...args) => share(...args),
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
    expect(screen.getByRole("button", { name: /invite your college faculty/i })).toBeInTheDocument();
  });

  it("shows the college-email verification state and profile CTA", async () => {
    apiFetch.mockRejectedValueOnce({
      status: 403,
      body: { code: "COLLEGE_EMAIL_UNVERIFIED" },
      message: "Verify your college email to view your college TPO directory.",
    });

    render(<CollegeTpoDirectoryPage />);

    expect(await screen.findByText("Verify your college email")).toBeInTheDocument();
    expect(
      screen.getByText(/verify your college email from your Profile page/i)
    ).toBeInTheDocument();

    const profileLink = screen.getByRole("link", { name: /go to profile/i });
    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(screen.queryByText("TPO directory unavailable")).not.toBeInTheDocument();
  });

  it("shows the generic API error state for failures other than college-email verification", async () => {
    apiFetch.mockRejectedValueOnce({
      status: 500,
      body: { error: "Service unavailable." },
      message: "Service unavailable.",
    });

    render(<CollegeTpoDirectoryPage />);

    expect(await screen.findByText("TPO directory unavailable")).toBeInTheDocument();
    expect(screen.getByText("Service unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("Verify your college email")).not.toBeInTheDocument();
  });

  it("shows the disabled-directory state when the backend reports the feature is not live", async () => {
    apiFetch.mockResolvedValueOnce({
      enabled: false,
      message: "College dashboard is not live yet.",
    });

    render(<CollegeTpoDirectoryPage />);

    expect(await screen.findByText("College TPO directory is not live yet")).toBeInTheDocument();
    expect(screen.getByText("College dashboard is not live yet.")).toBeInTheDocument();
    expect(screen.queryByText("No verified TPOs yet")).not.toBeInTheDocument();
  });

  it("uses the shared invite flow without changing directory state", async () => {
    apiFetch.mockResolvedValueOnce({
      college: { id: "college-1", name: "Report University" },
      tpos: [],
    });

    render(<CollegeTpoDirectoryPage />);

    const inviteButton = await screen.findByRole("button", {
      name: /invite your college faculty/i,
    });
    await inviteButton.click();

    expect(share).toHaveBeenCalledWith({
      title: "Join Code Club as a TPO",
      text: expect.stringContaining("Report University"),
      url: expect.stringContaining("/tpo/signup"),
    });
  });
});
