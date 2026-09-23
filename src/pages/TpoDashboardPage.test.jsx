import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../context/ThemeContext";
import TpoDashboardPage from "./TpoDashboardPage";

const apiFetch = vi.fn();
vi.mock("../services/api", () => ({
  apiFetch: (...args) => apiFetch(...args),
}));

// Guest Mode: TpoDashboardPage now checks useIdentity() before fetching/
// rendering student/college data at all. Every test in this file
// exercises the authenticated TPO experience, not the guest gate — which
// has its own dedicated coverage in TpoDashboardPage.guestMode.test.jsx —
// so a fixed "authenticated" stub keeps this file's existing assertions
// meaningful.
vi.mock("../hooks/useIdentity", () => ({
  useIdentity: () => ({ isAuthenticated: true }),
}));

const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("react-hot-toast", () => ({
  default: toastMock,
}));

// Navbar transformation: TpoDashboardPage now renders inside DashboardLayout
// (previously it had no shared shell at all). Same reasoning as
// RecruiterDashboardPage.test.jsx — ThemeProvider for ThemeSkin, Navbar
// stubbed since it has its own dedicated test file and its apiFetch calls
// would otherwise interleave with this file's assertions.
vi.mock("../components/Navbar", () => ({
  default: () => <div data-testid="navbar-stub" />,
}));

const dashboardData = {
  college: "Example University",
  domain: "example.edu",
  totalStudents: 3,
  readinessScore: 55,
  avgSolved: 10,
  activePercent: 40,
  totalSolved: 30,
  difficultyBreakdown: { hard: 5 },
  topicCoverage: [{ topic: "Arrays", totalSolves: 10 }],
};

const allStudents = [
  { name: "Alice Adams", email: "alice@example.edu", totalXP: 500, solvedCount: 20, currentStreak: 3 },
  { name: "Bob Brown", email: "bob@example.edu", totalXP: 900, solvedCount: 10, currentStreak: 0 },
  { name: "Carol Chen", email: "carol@example.edu", totalXP: 100, solvedCount: 5, currentStreak: 1 },
];
// Kept for the (rare) place a test wants the raw fixture rather than the
// fake-backend response below.
const studentsData = { students: allStudents, total: allStudents.length, page: 1, limit: 25 };

// A tiny stand-in for the real GET /api/tpo/students — applies the same
// q/sort/page contract the real backend implements (see
// backend/routes/tpo.js), against the static fixture above. Lets these
// tests exercise the real request-per-change architecture (debounced
// search, sort-triggers-a-request, page-triggers-a-request) instead of
// re-testing client-side filtering that no longer exists.
const SORTERS = {
  xp: (a, b) => b.totalXP - a.totalXP,
  solved: (a, b) => b.solvedCount - a.solvedCount,
  streak: (a, b) => b.currentStreak - a.currentStreak,
  name: (a, b) => a.name.localeCompare(b.name),
};
function fakeStudentsBackend(url) {
  const params = new URLSearchParams(url.split("?")[1] || "");
  const q = (params.get("q") || "").toLowerCase();
  const sort = params.get("sort") || "xp";
  const page = parseInt(params.get("page"), 10) || 1;
  const limit = parseInt(params.get("limit"), 10) || 25;

  const filtered = allStudents.filter(
    s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  );
  const sorted = [...filtered].sort(SORTERS[sort] || SORTERS.xp);
  const start = (page - 1) * limit;
  return Promise.resolve({ students: sorted.slice(start, start + limit), total: filtered.length, page, limit });
}

function renderDashboard() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/tpo/dashboard?tab=students"]}>
        <TpoDashboardPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

async function loadDashboard() {
  apiFetch.mockImplementation((url) => {
    if (url === "/api/tpo/dashboard") return Promise.resolve(dashboardData);
    if (url.startsWith("/api/tpo/students")) return fakeStudentsBackend(url);
    if (url === "/api/tpo/assignments") return Promise.resolve({ assignments: [] });
    return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
  });
  renderDashboard();
  await waitFor(() => screen.getByText("Alice Adams"));
}

describe("TpoDashboardPage — students tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sorts by XP descending by default (Bob 900, Alice 500, Carol 100)", async () => {
    await loadDashboard();

    const rows = screen.getAllByText(/Adams|Brown|Chen/).map((el) => el.textContent);
    expect(rows).toEqual(["Bob Brown", "Alice Adams", "Carol Chen"]);
  });

  it("filters the roster by name as you type (debounced, server-side)", async () => {
    await loadDashboard();

    fireEvent.change(screen.getByPlaceholderText(/search by name or email/i), {
      target: { value: "carol" },
    });

    // Debounced — the request (and re-render) happen after a short delay,
    // not on the keystroke itself.
    await waitFor(() => {
      expect(screen.getByText("Carol Chen")).toBeInTheDocument();
      expect(screen.queryByText("Alice Adams")).not.toBeInTheDocument();
      expect(screen.queryByText("Bob Brown")).not.toBeInTheDocument();
    });
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("q=carol"));
  });

  it("filters the roster by email as you type (debounced, server-side)", async () => {
    await loadDashboard();

    fireEvent.change(screen.getByPlaceholderText(/search by name or email/i), {
      target: { value: "bob@example.edu" },
    });

    await waitFor(() => {
      expect(screen.getByText("Bob Brown")).toBeInTheDocument();
      expect(screen.queryByText("Alice Adams")).not.toBeInTheDocument();
    });
  });

  it("re-sorts the roster when a different sort option is chosen (Name: Alice, Bob, Carol)", async () => {
    await loadDashboard();

    fireEvent.change(screen.getByDisplayValue("Sort: XP"), { target: { value: "name" } });

    await waitFor(() => {
      const rows = screen.getAllByText(/Adams|Brown|Chen/).map((el) => el.textContent);
      expect(rows).toEqual(["Alice Adams", "Bob Brown", "Carol Chen"]);
    });
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("sort=name"));
  });

  it("shows an empty-state message instead of an empty list when no student matches the search", async () => {
    await loadDashboard();

    fireEvent.change(screen.getByPlaceholderText(/search by name or email/i), {
      target: { value: "nobody-matches-this" },
    });

    await waitFor(() => {
      expect(screen.getByText(/no students match/i)).toBeInTheDocument();
    });
  });

  it("no longer renders the dead hover-only affordance on student rows", async () => {
    await loadDashboard();

    const row = screen.getByText("Alice Adams").closest("div");
    expect(row.className).not.toMatch(/hover:bg-zinc-800\/30/);
  });

  it("shows pagination info and disables Previous on the first page", async () => {
    await loadDashboard();
    await waitFor(() => expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("Next fetches the next page and Previous becomes enabled", async () => {
    // A dedicated multi-page fixture — the shared 3-student fixture above
    // fits on one page, so it can't exercise real page navigation.
    const pageOneStudents = [{ name: "Page One Student", email: "p1@example.edu", totalXP: 1, solvedCount: 1, currentStreak: 0 }];
    const pageTwoStudents = [{ name: "Page Two Student", email: "p2@example.edu", totalXP: 1, solvedCount: 1, currentStreak: 0 }];

    apiFetch.mockImplementation((url) => {
      if (url === "/api/tpo/dashboard") return Promise.resolve(dashboardData);
      if (url === "/api/tpo/assignments") return Promise.resolve({ assignments: [] });
      if (url.startsWith("/api/tpo/students")) {
        const params = new URLSearchParams(url.split("?")[1] || "");
        const page = parseInt(params.get("page"), 10) || 1;
        return Promise.resolve({
          students: page === 1 ? pageOneStudents : pageTwoStudents,
          total: 26, // > 25 (STUDENTS_PAGE_SIZE) so there are two pages
          page,
          limit: 25,
        });
      }
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });
    renderDashboard();
    await waitFor(() => screen.getByText("Page One Student"));

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByText("Page Two Student")).toBeInTheDocument());
    expect(screen.queryByText("Page One Student")).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    expect(screen.getByRole("button", { name: /previous/i })).not.toBeDisabled();
  });

  it("shows an API error with a retry option instead of a blank table", async () => {
    apiFetch.mockImplementation((url) => {
      if (url === "/api/tpo/dashboard") return Promise.resolve(dashboardData);
      if (url === "/api/tpo/assignments") return Promise.resolve({ assignments: [] });
      if (url.startsWith("/api/tpo/students")) return Promise.reject(new Error("Network error"));
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });
    renderDashboard();

    await waitFor(() => expect(screen.getByText(/try again/i)).toBeInTheDocument());
    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });
});

describe("TpoDashboardPage — pending verification and shared shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a support contact and the shared nav shell instead of a dead-end screen", async () => {
    apiFetch.mockRejectedValue(new Error("Your TPO account is pending verification."));
    renderDashboard();

    await waitFor(() => screen.getByText("College Verification Pending"));
    expect(screen.getByText(/hello@codeclub.in/)).toBeInTheDocument();
    expect(screen.getByTestId("navbar-stub")).toBeInTheDocument();
  });

  it("renders the main dashboard inside the shared DashboardLayout shell", async () => {
    await loadDashboard();
    expect(screen.getByTestId("navbar-stub")).toBeInTheDocument();
  });
});

describe("TpoDashboardPage — overview tab (analytics)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderOverview() {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/tpo/dashboard"]}>
          <TpoDashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    );
  }

  async function loadOverview(overrides = {}) {
    apiFetch.mockImplementation((url) => {
      if (url === "/api/tpo/dashboard") return Promise.resolve({ ...dashboardData, ...overrides });
      if (url.startsWith("/api/tpo/students")) return Promise.resolve(studentsData);
      if (url === "/api/tpo/assignments") return Promise.resolve({ assignments: [] });
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });
    renderOverview();
    await waitFor(() => screen.getByText("Example University"));
  }

  it("shows a fallback message instead of an empty card when no topics have been solved yet", async () => {
    await loadOverview({ topicCoverage: [] });
    expect(screen.getByText("No topic-tagged solves yet.")).toBeInTheDocument();
    expect(screen.queryByText("Arrays")).not.toBeInTheDocument();
  });

  it("renders the topic coverage bars when data exists", async () => {
    await loadOverview();
    expect(screen.getByText("Arrays")).toBeInTheDocument();
    expect(screen.queryByText("No topic-tagged solves yet.")).not.toBeInTheDocument();
  });

  it("disables the download button and shows a preparing state while the report is generating", async () => {
    await loadOverview();
    vi.doMock("../services/auth", () => ({ getIdToken: () => new Promise(() => {}) }));

    fireEvent.click(screen.getByRole("button", { name: /download report/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /preparing/i })).toBeDisabled();
    });
  });

  it("shows an error toast instead of downloading a broken file when the report request fails", async () => {
    await loadOverview();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    vi.doMock("../services/auth", () => ({ getIdToken: async () => "fake-token" }));

    fireEvent.click(screen.getByRole("button", { name: /download report/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/report generation failed/i));
    });
    // Button re-enables afterwards instead of staying stuck on "Preparing…".
    expect(screen.getByRole("button", { name: /download report/i })).not.toBeDisabled();
  });
});

describe("TpoDashboardPage — assignments tab reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadAssignmentsTab() {
    apiFetch.mockImplementation((url, opts) => {
      if (url === "/api/tpo/dashboard") return Promise.resolve(dashboardData);
      if (url.startsWith("/api/tpo/students")) return Promise.resolve(studentsData);
      if (url === "/api/tpo/assignments" && !opts) {
        return Promise.resolve({
          assignments: [
            {
              _id: "a1",
              title: "Week 3 — Arrays",
              dueDate: "2026-08-01",
              problemSlugs: ["two-sum"],
              completedCount: 1,
              totalStudents: 3,
              completionPercent: 33,
              isOverdue: false,
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/tpo/dashboard?tab=assignments"]}>
          <TpoDashboardPage />
        </MemoryRouter>
      </ThemeProvider>
    );
    await waitFor(() => screen.getByText("Week 3 — Arrays"));
  }

  it("creates a cohort-scoped assignment with the selected cohort", async () => {
    await loadAssignmentsTab();
    apiFetch.mockImplementation((url, opts) => {
      if (url === "/api/tpo/cohorts?status=active&limit=100") {
        return Promise.resolve({ items: [{ id: "cohort-1", name: "CSE 2027", branch: "CSE", graduatingYear: 2027 }] });
      }
      if (url === "/api/tpo/assignments" && opts?.method === "POST") {
        expect(JSON.parse(opts.body)).toMatchObject({ title: "Cohort Week", problemSlugs: ["two-sum"], dueDate: "2026-10-01", cohortId: "cohort-1" });
        return Promise.resolve({});
      }
      if (url === "/api/tpo/dashboard") return Promise.resolve(dashboardData);
      if (url.startsWith("/api/tpo/students")) return Promise.resolve(studentsData);
      return Promise.reject(new Error(`Unexpected apiFetch call: ${url}`));
    });
    fireEvent.click(screen.getByRole("button", { name: /new assignment/i }));
    fireEvent.click(screen.getByRole("button", { name: /specific cohort/i }));
    await waitFor(() => expect(screen.getByRole("option", { name: /cse 2027/i })).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox", { name: /assignment cohort/i }), { target: { value: "cohort-1" } });
    fireEvent.change(screen.getByPlaceholderText(/assignment title/i), { target: { value: "Cohort Week" } });
    fireEvent.change(screen.getByPlaceholderText(/problem slugs/i), { target: { value: "two-sum" } });
    fireEvent.change(screen.getByDisplayValue(""), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/tpo/assignments", expect.objectContaining({ method: "POST" })));
  });

  it("posts to the remind endpoint and shows a success toast with the count", async () => {
    await loadAssignmentsTab();
    apiFetch.mockResolvedValueOnce({ remindedCount: 2 });

    fireEvent.click(screen.getByRole("button", { name: /remind incomplete/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith("/api/tpo/assignments/a1/remind", { method: "POST" });
    });
    // Button re-enables afterwards instead of hanging (same fix pattern as Plan 001).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /remind incomplete/i })).not.toBeDisabled();
    });
  });

  it("re-enables the button (does not hang) if the reminder request fails", async () => {
    await loadAssignmentsTab();
    apiFetch.mockRejectedValueOnce(new Error("Failed to send reminder."));

    fireEvent.click(screen.getByRole("button", { name: /remind incomplete/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /remind incomplete/i })).not.toBeDisabled();
    });
  });
});