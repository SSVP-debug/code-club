import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DailyQuizGate from "./DailyQuizGate";
import { DailyQuizContext } from "../context/DailyQuizContextObject";

vi.mock("../components/onboarding/DailyQuickQuiz", () => ({
  default: ({ onComplete }) => (
    <button onClick={onComplete}>answer and continue</button>
  ),
}));

function renderGate(value) {
  return render(
    <DailyQuizContext.Provider value={value}>
      <DailyQuizGate>
        <div>dashboard content</div>
      </DailyQuizGate>
    </DailyQuizContext.Provider>
  );
}

const base = {
  status: "unlocked",
  isBackendReady: true,
  role: "student",
  retry: vi.fn(),
  completeQuiz: vi.fn(),
  completing: false,
  completeError: null,
};

describe("DailyQuizGate — dashboard-only non-blocking prompt", () => {
  it("always mounts dashboard content when check-in is unlocked", () => {
    renderGate({ ...base, status: "unlocked" });
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps dashboard content mounted behind the check-in overlay", () => {
    renderGate({ ...base, status: "required" });
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the student prompt while dashboard hydration is still running", () => {
    renderGate({ ...base, isBackendReady: false, status: "required" });
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not block dashboard while status is loading", () => {
    renderGate({ ...base, status: "loading" });
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not block dashboard when status lookup fails", () => {
    renderGate({ ...base, status: "error" });
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses immediately and starts completion persistence", () => {
    const completeQuiz = vi.fn();
    renderGate({ ...base, status: "required", completeQuiz });

    fireEvent.click(screen.getByText("answer and continue"));

    expect(completeQuiz).toHaveBeenCalledTimes(1);
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lets the user skip without blocking the dashboard", () => {
    const completeQuiz = vi.fn();
    renderGate({ ...base, status: "required", completeQuiz });

    fireEvent.click(screen.getByRole("button", { name: /skip for today/i }));

    expect(completeQuiz).toHaveBeenCalledTimes(1);
    expect(screen.getByText("dashboard content")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
