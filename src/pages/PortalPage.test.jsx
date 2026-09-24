import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import PortalPage from "./PortalPage";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const enterGuestModeMock = vi.fn();
vi.mock("../hooks/useGuest", () => ({
  useGuest: () => ({
    isGuest: false,
    guestPortal: null,
    enterGuestMode: enterGuestModeMock,
    exitGuestMode: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <PortalPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("PortalPage — Guest Mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a real login link and a Continue as Guest action for every role", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Enter as Student →" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter as Recruiter →" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter as TPO →" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Continue as Guest" })).toHaveLength(3);
    expect(screen.getByRole("img", { name: "Students collaborating on a college campus" })).toHaveAttribute(
      "src",
      "/images/landing/ecosystem-campus.webp"
    );
    expect(screen.getByRole("img", { name: "Recruiter interviewing a candidate" })).toHaveAttribute(
      "src",
      "/images/landing/recruiter-interview.webp"
    );
    expect(screen.getByRole("img", { name: "Training and placement discussion" })).toHaveAttribute(
      "src",
      "/images/landing/tpo-placement.webp"
    );
  });

  it("real login links point at /login?role=<id>, unaffected by Guest Mode", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Enter as Student →" }).getAttribute("href")).toBe(
      "/login?role=student"
    );
    expect(screen.getByRole("link", { name: "Enter as Recruiter →" }).getAttribute("href")).toBe(
      "/login?role=recruiter"
    );
    expect(screen.getByRole("link", { name: "Enter as TPO →" }).getAttribute("href")).toBe(
      "/login?role=tpo"
    );
  });

  it("clicking Continue as Guest on the Student card enters guest mode for 'student' and navigates to /dashboard", () => {
    renderPage();
    const [studentGuestButton] = screen.getAllByRole("button", { name: "Continue as Guest" });

    fireEvent.click(studentGuestButton);

    expect(enterGuestModeMock).toHaveBeenCalledWith("student");
    expect(navigateMock).toHaveBeenCalledWith("/dashboard");
  });

  it("clicking Continue as Guest on the Recruiter card enters guest mode for 'recruiter' and navigates to /recruiter/dashboard", () => {
    renderPage();
    const [, recruiterGuestButton] = screen.getAllByRole("button", { name: "Continue as Guest" });

    fireEvent.click(recruiterGuestButton);

    expect(enterGuestModeMock).toHaveBeenCalledWith("recruiter");
    expect(navigateMock).toHaveBeenCalledWith("/recruiter/dashboard");
  });

  it("clicking Continue as Guest on the TPO card enters guest mode for 'tpo' and navigates to /tpo/dashboard", () => {
    renderPage();
    const [, , tpoGuestButton] = screen.getAllByRole("button", { name: "Continue as Guest" });

    fireEvent.click(tpoGuestButton);

    expect(enterGuestModeMock).toHaveBeenCalledWith("tpo");
    expect(navigateMock).toHaveBeenCalledWith("/tpo/dashboard");
  });
});
