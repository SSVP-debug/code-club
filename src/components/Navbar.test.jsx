import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthContext } from "../context/AuthContextObject";
import { GuestContext } from "../context/GuestContextObject";
import { AppContext } from "../context/AppContextObject";
import Navbar from "./Navbar";

// Firebase test environment: this file never tests Firebase itself (the
// AuthContext value below is provided directly), but Navbar's import chain
// pulls in services/api.js / services/auth.js, both of which import
// src/firebase/firebase.js — and that module throws at import time if its
// required env vars aren't set, which they deliberately aren't in the test
// environment (see src/firebase/firebase.test.js for why: no real Firebase
// project should ever be reachable from a test run). Mocking at this
// boundary — same convention src/services/api.test.js already uses — lets
// the import graph resolve without ever touching real Firebase.
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../firebase/firebase", () => ({
  auth: { currentUser: null },
  default: {},
}));

// Navbar transformation, Phase A. Prior to this file, Navbar had no direct
// test coverage — only exercised indirectly (and stubbed out) by layout
// tests like AdminLayout.test.jsx. This covers what actually changed: the
// role-aware workspace label in the brand block, and that the
// WorkspaceSwitcher only appears for admin (the one role with a real
// concept of "other workspaces" — see src/config/workspaces.js).
//
// AvatarDropdown/NotificationBell/StreakBadge are stubbed: they pull in
// apiFetch/PremiumContext/achievement metadata unrelated to what's under
// test here, same reasoning AdminLayout.test.jsx gives for stubbing
// Navbar itself.
vi.mock("./AvatarDropdown", () => ({
  default: () => <div data-testid="avatar-stub" />,
}));
vi.mock("./notifications/NotificationBell", () => ({
  default: () => <div data-testid="notification-bell-stub" />,
}));
vi.mock("./common/StreakBadge", () => ({
  default: () => <div data-testid="streak-badge-stub" />,
}));

function renderNavbar({ role, user = { displayName: "Test User", email: "test@example.com" }, path = "/dashboard", isBackendReady = true }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
    <ThemeProvider>
      <AuthContext.Provider value={{ user, loading: false }}>
        {/* Navbar now also reads GuestContext (Guest Mode) for its
            Logout/guest-exit branch — none of these tests exercise a
            guest session, so a stable "not a guest" stub is enough. */}
        <GuestContext.Provider value={{ isGuest: false, guestPortal: null, enterGuestMode: () => {}, exitGuestMode: () => {} }}>
        <AppContext.Provider value={{ role, currentStreak: 0, isBackendReady }}>
          <Navbar />
        </AppContext.Provider>
        </GuestContext.Provider>
      </AuthContext.Provider>
    </ThemeProvider>
  </MemoryRouter>
  );
}

describe("Navbar", () => {
  it("always shows the Code Club brand", () => {
    renderNavbar({ role: "student" });
    expect(screen.getByText("Code Club")).toBeInTheDocument();
  });

  it("shows the active theme name for a student, not a plain workspace label", () => {
    renderNavbar({ role: "student" });
    expect(screen.queryByText("Student")).not.toBeInTheDocument();
  });

  it("does not render the Black & White Mode control inside the product navbar", () => {
    renderNavbar({ role: "student" });
    expect(screen.queryByRole("switch", { name: /black & white mode/i })).not.toBeInTheDocument();
  });

  it("shows a plain Recruiter workspace label with no switcher", () => {
    renderNavbar({ role: "recruiter" });
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch workspace/i })).not.toBeInTheDocument();
  });

  it("shows a plain TPO workspace label with no switcher", () => {
    renderNavbar({ role: "tpo" });
    expect(screen.getByText("TPO")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch workspace/i })).not.toBeInTheDocument();
  });

  it("shows the WorkspaceSwitcher for admin, defaulting to Command Center at /admin", () => {
    renderNavbar({ role: "admin", path: "/admin" });
    expect(screen.getByRole("button", { name: /switch workspace/i })).toBeInTheDocument();
    expect(screen.getByText("Command Center")).toBeInTheDocument();
  });

  // Admin UX audit (Phase UI-3, continued — the "3 redundant switchers"
  // screenshot finding): WorkspaceSwitcher's currentId used to be
  // hardcoded to "admin" in Navbar.jsx regardless of the actual route, so
  // it kept reading "Command Center" even while an admin was actively
  // previewing another workspace. This locks in the fix — the label now
  // tracks wherever the admin actually is.
  it("shows the current workspace label based on the actual route, not a hardcoded default", () => {
    renderNavbar({ role: "admin", path: "/dashboard" });
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.queryByText("Command Center")).not.toBeInTheDocument();
  });

  it("opens the workspace menu and lists all four workspaces", () => {
    renderNavbar({ role: "admin", path: "/admin" });
    fireEvent.click(screen.getByRole("button", { name: /switch workspace/i }));
    expect(screen.getByRole("menu", { name: /workspaces/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /command center/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemradio", { name: /^student/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /^recruiter/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /^tpo/i })).toBeInTheDocument();
  });

  it("closes the workspace menu on Escape", () => {
    renderNavbar({ role: "admin" });
    fireEvent.click(screen.getByRole("button", { name: /switch workspace/i }));
    expect(screen.getByRole("menu", { name: /workspaces/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu", { name: /workspaces/i })).not.toBeInTheDocument();
  });

  it("falls back to the student nav for an unrecognized role", () => {
    renderNavbar({ role: "unknown-role" });
    expect(screen.getByText("Code Club")).toBeInTheDocument();
  });

  // Admin UX audit (Phase UI-3, continued — the "3 redundant switchers"
  // screenshot finding): admin's nav.primary/secondary used to render a
  // flat "Admin Console | Student | Recruiter | TPO" link row here, a
  // pure duplicate of both AdminPreviewBanner (mounted globally) and
  // WorkspaceSwitcher (the dropdown right next to it). Locks in that it's
  // gone — WorkspaceSwitcher's menu (tested above) is now the only
  // Navbar-level switcher.
  it("no longer renders a duplicate flat Student/Recruiter/TPO link row for admin", () => {
    renderNavbar({ role: "admin", path: "/admin" });
    expect(screen.queryByRole("link", { name: "Admin Console" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Student" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recruiter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "TPO" })).not.toBeInTheDocument();
  });

  it("shows a search trigger for student/recruiter/tpo but not admin", () => {
    renderNavbar({ role: "student" });
    expect(screen.getAllByRole("button", { name: /search/i }).length).toBeGreaterThan(0);

    renderNavbar({ role: "admin" });
    expect(screen.queryByRole("button", { name: /^search$/i })).not.toBeInTheDocument();
  });

  it("opens the command palette from the search trigger for a student", async () => {
    renderNavbar({ role: "student" });
    fireEvent.click(screen.getAllByRole("button", { name: /search/i })[0]);
    expect(await screen.findByRole("dialog", { name: /command palette/i })).toBeInTheDocument();
  });

  it("lists role-appropriate destinations in the command palette for a recruiter", async () => {
    renderNavbar({ role: "recruiter" });
    fireEvent.click(screen.getAllByRole("button", { name: /search/i })[0]);
    expect(await screen.findByRole("button", { name: /candidates/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^problems$/i })).not.toBeInTheDocument();
  });

  it("hides the student-facing NotificationBell for admin (AttentionCenter covers it)", () => {
    renderNavbar({ role: "admin" });
    expect(screen.queryByTestId("notification-bell-stub")).not.toBeInTheDocument();
  });

  it("shows NotificationBell for student and recruiter", () => {
    renderNavbar({ role: "student" });
    expect(screen.getAllByTestId("notification-bell-stub").length).toBeGreaterThan(0);

    renderNavbar({ role: "recruiter" });
    expect(screen.getAllByTestId("notification-bell-stub").length).toBeGreaterThan(0);
  });

  it("keeps the brand block shrinkable so it never forces the mobile controls off-screen", () => {
    const { container } = renderNavbar({ role: "admin" });
    const brand = screen.getByText("Code Club").closest("div");
    expect(brand.className).toContain("min-w-0");
    expect(screen.getByText("Code Club").className).toContain("truncate");
    // The mobile controls row is the one non-brand direct sibling and must
    // stay shrink-0 so it's never the side that gets squeezed.
    const mobileControls = container.querySelector(".flex.lg\\:hidden");
    expect(mobileControls.className).toContain("shrink-0");
  });

  // DailyQuizGate (src/routes/DailyQuizGate.jsx, reached via
  // ProtectedRoute) waits for isBackendReady before ever mounting a
  // protected page's Navbar. This test covers Navbar's own
  // belt-and-suspenders isBackendReady gate directly, independent of that
  // upstream guarantee.
  it("disables nav links and the search trigger while the backend isn't ready", () => {
    renderNavbar({ role: "student", isBackendReady: false });
    expect(screen.queryByRole("link", { name: "Problems" })).not.toBeInTheDocument();
    expect(screen.getByText("Problems")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByRole("button", { name: /search/i })[0]).toBeDisabled();
  });

  it("re-enables nav links and search once the backend becomes ready", () => {
    renderNavbar({ role: "student", isBackendReady: true });
    expect(screen.getByRole("link", { name: "Problems" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /search/i })[0]).not.toBeDisabled();
  });
});