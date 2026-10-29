import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { AuthContext } from "../context/AuthContextObject";
import { GuestContext } from "../context/GuestContextObject";
import { DailyQuizContext } from "../context/DailyQuizContextObject";

// ProtectedRoute now also reads GuestContext (Guest Mode) for its
// guest-bypass branch — none of these tests exercise a guest session, so
// a stable "not a guest" stub is enough, same direct-Provider pattern
// already used for AuthContext/DailyQuizContext above.
const notGuestValue = {
  isGuest: false,
  guestPortal: null,
  enterGuestMode: () => {},
  exitGuestMode: () => {},
};

// DailyQuickQuiz owns the actual question UI and is covered by its own
// tests — stub it down to a single button that calls onComplete, same
// pattern DailyQuizGate.test.jsx uses.
vi.mock("../components/onboarding/DailyQuickQuiz", () => ({
  default: ({ onComplete }) => (
    <button onClick={() => onComplete({ score: 5 })}>finish quiz</button>
  ),
}));

const unlockedQuizValue = {
  status: "unlocked",
  isBackendReady: true,
  retry: vi.fn(),
  completeQuiz: vi.fn(),
  completing: false,
  completeError: null,
};

function renderWithAuth(authValue, initialEntries = ["/protected"], quizValue = unlockedQuizValue, guestValue = notGuestValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <GuestContext.Provider value={guestValue}>
      <DailyQuizContext.Provider value={quizValue}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <div>Secret</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/club/public-contests/:id"
              element={
                <ProtectedRoute>
                  <div>Contest Detail</div>
                </ProtectedRoute>
              }
            />
            {/* Guest Mode: a route that opts in to guest browsing for the
                "student" portal, same shape App.jsx uses for /dashboard,
                /problems, /problems/:slug. */}
            <Route
              path="/guest-allowed"
              element={
                <ProtectedRoute guestPortal="student">
                  <div>Guest-Allowed Content</div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={<LoginRouteProbe />}
            />
          </Routes>
        </MemoryRouter>
      </DailyQuizContext.Provider>
      </GuestContext.Provider>
    </AuthContext.Provider>
  );
}

// Renders the current /login URL (path + search) so tests can assert on
// exactly what ProtectedRoute encoded, without needing a real LoginPage.
function LoginRouteProbe() {
  const location = useLocation();
  return <div>Login Page: {location.pathname + location.search}</div>;
}

describe("ProtectedRoute", () => {
  it("shows loading while auth is resolving", () => {
    renderWithAuth({ user: null, loading: true });

    expect(
      document.querySelector('[class*="animate-spin"]')
    ).not.toBeNull();
  });

  it("redirects to login when user is not authenticated", () => {
    renderWithAuth({ user: null, loading: false });

    expect(screen.getByText("Login Page: /login?next=%2Fprotected")).toBeInTheDocument();
  });

  it("renders children when user is authenticated and today's quiz is already unlocked", () => {
    renderWithAuth({
      user: { uid: "1" },
      loading: false,
    });

    expect(screen.getByText("Secret")).toBeInTheDocument();
  });

  it("renders protected content even when daily check-in is required (check-in is Dashboard-only)", () => {
    renderWithAuth(
      { user: { uid: "1" }, loading: false },
      ["/protected"],
      { ...unlockedQuizValue, status: "required" }
    );

    expect(screen.getByText("Secret")).toBeInTheDocument();
    expect(screen.queryByText("finish quiz")).not.toBeInTheDocument();
  });

  it("does not block protected content while daily check-in status is loading", () => {
    renderWithAuth(
      { user: { uid: "1" }, loading: false },
      ["/protected"],
      { ...unlockedQuizValue, status: "loading" }
    );

    expect(screen.getByText("Secret")).toBeInTheDocument();
    expect(screen.queryByText("finish quiz")).not.toBeInTheDocument();
  });

  // Gate 3 audit, P0-1: a logged-out visitor following a contest link must
  // be able to get back to that exact contest after signing in — the
  // redirect to /login must preserve the page they were trying to reach.
  it("preserves the intended destination as ?next= when redirecting to login", () => {
    renderWithAuth(
      { user: null, loading: false },
      ["/club/public-contests/abc123?utm_source=fest"]
    );

    expect(
      screen.getByText("Login Page: /login?next=%2Fclub%2Fpublic-contests%2Fabc123%3Futm_source%3Dfest")
    ).toBeInTheDocument();
  });
});

// Guest Mode: guest-bypass branch — a route with a matching guestPortal
// prop must be reachable by a guest with NO Firebase user, instead of
// redirecting to /login the way every other unauthenticated case does.
describe("ProtectedRoute — Guest Mode bypass", () => {
  const guestStudentValue = {
    isGuest: true,
    guestPortal: "student",
    enterGuestMode: () => {},
    exitGuestMode: () => {},
  };
  const guestRecruiterValue = {
    isGuest: true,
    guestPortal: "recruiter",
    enterGuestMode: () => {},
    exitGuestMode: () => {},
  };

  it("renders children for a guest whose portal matches the route's guestPortal prop", () => {
    renderWithAuth(
      { user: null, loading: false },
      ["/guest-allowed"],
      unlockedQuizValue,
      guestStudentValue
    );

    expect(screen.getByText("Guest-Allowed Content")).toBeInTheDocument();
  });

  it("skips DailyQuizGate entirely for a guest (no account, nothing to gate)", () => {
    renderWithAuth(
      { user: null, loading: false },
      ["/guest-allowed"],
      { ...unlockedQuizValue, status: "required" }, // would normally force the quiz screen
      guestStudentValue
    );

    expect(screen.getByText("Guest-Allowed Content")).toBeInTheDocument();
    expect(screen.queryByText("finish quiz")).not.toBeInTheDocument();
  });

  it("still redirects to login for a guest whose portal does NOT match the route's guestPortal prop", () => {
    renderWithAuth(
      { user: null, loading: false },
      ["/guest-allowed"],
      unlockedQuizValue,
      guestRecruiterValue
    );

    expect(screen.queryByText("Guest-Allowed Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page: /login?next=%2Fguest-allowed")).toBeInTheDocument();
  });

  it("still redirects a non-guest, unauthenticated visitor to login even for a guestPortal-enabled route with no guest session active", () => {
    renderWithAuth(
      { user: null, loading: false },
      ["/guest-allowed"],
      unlockedQuizValue,
      notGuestValue
    );

    expect(screen.queryByText("Guest-Allowed Content")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page: /login?next=%2Fguest-allowed")).toBeInTheDocument();
  });

  it("a route with NO guestPortal prop is never guest-bypassable, even with an active guest session", () => {
    renderWithAuth(
      { user: null, loading: false },
      ["/protected"], // no guestPortal prop on this route
      unlockedQuizValue,
      guestStudentValue
    );

    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
    expect(screen.getByText("Login Page: /login?next=%2Fprotected")).toBeInTheDocument();
  });

  it("an authenticated user always wins over any guest state on a guestPortal route", () => {
    renderWithAuth(
      { user: { uid: "1" }, loading: false },
      ["/guest-allowed"],
      unlockedQuizValue,
      guestStudentValue
    );

    expect(screen.getByText("Guest-Allowed Content")).toBeInTheDocument();
  });
});
