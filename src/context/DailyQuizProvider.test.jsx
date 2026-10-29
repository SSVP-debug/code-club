import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DailyQuizProvider from "./DailyQuizProvider";
import { useDailyQuizStatus } from "../hooks/useDailyQuizStatus";

let authValue = { user: null, loading: true };
vi.mock("../hooks/useAuth", () => ({ useAuth: () => authValue }));

let appContextValue = { role: "student", isBackendReady: true };
vi.mock("../hooks/useAppContext", () => ({ useAppContext: () => appContextValue }));

const getDailyQuizStatusMock = vi.fn();
const completeDailyQuizMock = vi.fn();
vi.mock("../services/dailyQuizService", () => ({
  getDailyQuizStatus: (...args) => getDailyQuizStatusMock(...args),
  completeDailyQuiz: (...args) => completeDailyQuizMock(...args),
}));

const hasLocalDailyCheckinMock = vi.fn();
const markLocalDailyCheckinMock = vi.fn();
vi.mock("../utils/dailyQuizClientState", () => ({
  hasLocalDailyCheckin: (...args) => hasLocalDailyCheckinMock(...args),
  markLocalDailyCheckin: (...args) => markLocalDailyCheckinMock(...args),
}));

function Probe() {
  const { status, isBackendReady, completeQuiz, completing } = useDailyQuizStatus();
  return (
    <div>
      <div>status: {status}</div>
      <div>backend ready: {String(isBackendReady)}</div>
      <div>persisting: {String(completing)}</div>
      <button onClick={completeQuiz}>complete</button>
    </div>
  );
}

function renderProvider() {
  return render(<MemoryRouter><DailyQuizProvider><Probe /></DailyQuizProvider></MemoryRouter>);
}

describe("DailyQuizProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authValue = { user: null, loading: true };
    appContextValue = { role: "student", isBackendReady: true };
    hasLocalDailyCheckinMock.mockReturnValue(false);
    completeDailyQuizMock.mockResolvedValue({ completed: true, required: false });
  });

  it("does not fetch while Firebase auth is unresolved", () => {
    renderProvider();
    expect(screen.getByText("status: loading")).toBeInTheDocument();
    expect(getDailyQuizStatusMock).not.toHaveBeenCalled();
  });

  it("does not fetch for a logged-out visitor", () => {
    authValue = { user: null, loading: false };
    renderProvider();
    expect(getDailyQuizStatusMock).not.toHaveBeenCalled();
  });

  it("checks status as soon as auth resolves even while /api/init is still loading", async () => {
    authValue = { user: { uid: "u1" }, loading: false };
    appContextValue = { role: "student", isBackendReady: false };
    getDailyQuizStatusMock.mockResolvedValue({ required: true, completed: false });

    renderProvider();

    await waitFor(() => expect(getDailyQuizStatusMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("status: required")).toBeInTheDocument());
    expect(screen.getByText("backend ready: false")).toBeInTheDocument();
  });

  it("uses the server status when there is no local same-day completion", async () => {
    authValue = { user: { uid: "u1" }, loading: false };
    getDailyQuizStatusMock.mockResolvedValue({ required: true, completed: false });

    renderProvider();

    await waitFor(() => expect(screen.getByText("status: required")).toBeInTheDocument());
  });

  it("uses the local same-day cache without waiting for a status request", () => {
    authValue = { user: { uid: "u1" }, loading: false };
    hasLocalDailyCheckinMock.mockReturnValue(true);

    renderProvider();

    expect(screen.getByText("status: unlocked")).toBeInTheDocument();
    expect(getDailyQuizStatusMock).not.toHaveBeenCalled();
  });

  it("marks local state and unlocks immediately before background persistence settles", async () => {
    authValue = { user: { uid: "u1" }, loading: false };
    getDailyQuizStatusMock.mockResolvedValue({ required: true, completed: false });
    let resolveCompletion;
    completeDailyQuizMock.mockReturnValue(new Promise((resolve) => { resolveCompletion = resolve; }));

    renderProvider();

    await waitFor(() => expect(screen.getByText("status: required")).toBeInTheDocument());
    fireEvent.click(screen.getByText("complete"));

    expect(markLocalDailyCheckinMock).toHaveBeenCalledWith("u1");
    expect(screen.getByText("status: unlocked")).toBeInTheDocument();
    expect(completeDailyQuizMock).toHaveBeenCalledTimes(1);
    resolveCompletion({ completed: true, required: false });
  });

  it("does not re-lock the app if background persistence fails", async () => {
    authValue = { user: { uid: "u1" }, loading: false };
    getDailyQuizStatusMock.mockResolvedValue({ required: true, completed: false });
    completeDailyQuizMock.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    renderProvider();

    await waitFor(() => expect(screen.getByText("status: required")).toBeInTheDocument());
    fireEvent.click(screen.getByText("complete"));

    await waitFor(() => expect(screen.getByText("status: unlocked")).toBeInTheDocument());
    expect(markLocalDailyCheckinMock).toHaveBeenCalledWith("u1");
  });
});
