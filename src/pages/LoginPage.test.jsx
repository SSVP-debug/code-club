import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import LoginPage from "./LoginPage";

// ── Mocks ────────────────────────────────────────────────────────────────
const navigateMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsValue],
  // Split-screen redesign's left brand panel (LoginPage.jsx) links back to
  // "/" — a plain <a> stand-in is enough for these redirect-logic tests,
  // which don't assert anything about that link itself.
  Link: ({ to, children, ...rest }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

const apiFetchMock = vi.fn();
vi.mock("../services/api", () => ({
  apiFetch: (...args) => apiFetchMock(...args),
}));

vi.mock("../services/auth", () => ({
  signInWithGoogle: vi.fn(),
}));

let authValue = { user: null };
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => authValue,
}));

// Gate 3 audit, P0-1: LoginPage's redirectAfterAuth() fires from a useEffect
// when `user` is already truthy (the "already logged in" branch) — the
// simplest way to exercise it without simulating the full Google popup.
describe("LoginPage — post-login redirect (Gate 3 P0-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue = new URLSearchParams();
    authValue = { user: null };
  });

  it("navigates to the preserved ?next= destination instead of the role default", async () => {
    searchParamsValue = new URLSearchParams({ next: "/club/public-contests/abc123" });
    authValue = { user: { uid: "1" } };

    render(<LoginPage />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/club/public-contests/abc123")
    );
    // Must not have also fallen through to /api/init's role-based default.
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/init");
  });

  it("rejects an unsafe ?next= value and falls back to /dashboard without calling /api/init", async () => {
    searchParamsValue = new URLSearchParams({ next: "https://evil.example/phish" });
    authValue = { user: { uid: "1" } };

    render(<LoginPage />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/dashboard"));
    expect(navigateMock).not.toHaveBeenCalledWith("https://evil.example/phish");
    // No ?role= intent here either, so this hits the same non-blocking
    // path as the plain-login test below — nothing should be queued on
    // apiFetchMock for this scenario.
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  // Plan 002 key finding: redirectAfterAuth() used to always await
  // /api/init before navigating anywhere, which stalled the plain student
  // login path on a cold Render backend (15-30s) for no reason —
  // AppContext already fires its own independent /api/init the instant
  // `user` is set. The plain-login path (no ?next=, no ?role= intent) now
  // navigates straight to /dashboard without waiting; a returning
  // recruiter/TPO gets bounced to their real dashboard by DashboardRoleRedirect
  // once AppContext's role has hydrated, instead of being resolved here.
  it("navigates straight to /dashboard without waiting on /api/init when there is no ?next= or ?role= intent", async () => {
    authValue = { user: { uid: "1" } };

    render(<LoginPage />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/dashboard"));
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/init");
  });

  // The portal-intent path (?role=recruiter|tpo) is different: it must
  // distinguish "already has this role, go to their dashboard" from
  // "doesn't have it yet, go to the signup form", so it still needs the
  // real role and keeps awaiting /api/init here (DashboardRoleRedirect only
  // wraps /dashboard, so it can't correct a wrong signup-vs-dashboard
  // guess after the fact).
  it("still awaits /api/init on the portal-intent path, so a returning recruiter lands on their dashboard, not the signup form", async () => {
    searchParamsValue = new URLSearchParams({ role: "recruiter" });
    authValue = { user: { uid: "1" } };
    apiFetchMock.mockResolvedValueOnce({ user: { role: "recruiter" } });

    render(<LoginPage />);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/recruiter/dashboard?tab=candidates")
    );
  

  it("renders the selected role identity and Google authentication surface", async () => {
    searchParamsValue = new URLSearchParams({ role: "student" });

    render(<LoginPage />);

    expect(document.body.textContent).toContain("Authentication");
    expect(document.body.textContent).toContain("Student access");
    expect(document.body.textContent).toContain("Continue with Google");
    expect(document.body.textContent).toContain("Secure Google authentication");
  });});
});