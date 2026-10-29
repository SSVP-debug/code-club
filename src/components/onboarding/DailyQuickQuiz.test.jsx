import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DailyQuickQuiz from "./DailyQuickQuiz";

const fixedQuestions = [
  {
    id: "q1",
    topic: "Arrays",
    question: "What is the time complexity of array index access?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
    correctIndex: 0,
  },
  {
    id: "q2",
    topic: "DBMS",
    question: "What does ACID stand for (the A)?",
    options: ["Atomicity", "Availability", "Aggregation", "Access"],
    correctIndex: 0,
  },
];

vi.mock("../../utils/quizEngine", async () => {
  const actual = await vi.importActual("../../utils/quizEngine");
  return { ...actual, selectDailyQuestions: () => fixedQuestions };
});

describe("DailyQuickQuiz", () => {
  it("renders exactly one local question and four options", () => {
    render(<DailyQuickQuiz onComplete={vi.fn()} />);

    expect(screen.getByText("What is the time complexity of array index access?")).toBeInTheDocument();
    expect(screen.getByText("O(1)")).toBeInTheDocument();
    expect(screen.getByText("O(n^2)")).toBeInTheDocument();
    expect(screen.queryByText("What does ACID stand for (the A)?")).not.toBeInTheDocument();
    expect(screen.queryByText(/question 1 of 5/i)).not.toBeInTheDocument();
  });

  it("shows correct feedback immediately and lets the user continue", () => {
    const onComplete = vi.fn();
    render(<DailyQuickQuiz onComplete={onComplete} />);

    fireEvent.click(screen.getByText("O(1)"));

    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to dashboard/i })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /continue to dashboard/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("shows the correct answer after a wrong choice", () => {
    render(<DailyQuickQuiz onComplete={vi.fn()} />);

    fireEvent.click(screen.getByText("O(n)"));

    expect(screen.getByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText("Correct answer: O(1)")).toBeInTheDocument();
  });

  it("does not allow changing the answer after feedback appears", () => {
    render(<DailyQuickQuiz onComplete={vi.fn()} />);

    fireEvent.click(screen.getByText("O(n)"));
    fireEvent.click(screen.getByText("O(1)"));

    expect(screen.getByText("Not quite")).toBeInTheDocument();
    expect(screen.getByText("Correct answer: O(1)")).toBeInTheDocument();
  });
});
