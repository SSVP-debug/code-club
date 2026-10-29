import { describe, expect, it } from "vitest";
import { selectDailyQuestions, selectDailyQuestionForDay, scoreQuizAttempt } from "./quizEngine";

describe("selectDailyQuestions", () => {
  it("returns one question by default", () => {
    const selected = selectDailyQuestions();
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBeTruthy();
  });

  it("can select different questions across repeated calls", () => {
    const results = new Set();

    for (let i = 0; i < 20; i += 1) {
      const ids = selectDailyQuestions(1)
        .map((q) => q.id)
        .sort()
        .join(",");
      results.add(ids);
    }

    expect(results.size).toBeGreaterThan(1);
  });

  it("falls back to repeating topics when count exceeds the number of distinct topics", () => {
    const smallPool = [
      { id: "a-1", topic: "A", question: "q", options: ["1", "2", "3", "4"], correctIndex: 0 },
      { id: "a-2", topic: "A", question: "q", options: ["1", "2", "3", "4"], correctIndex: 0 },
      { id: "b-1", topic: "B", question: "q", options: ["1", "2", "3", "4"], correctIndex: 0 },
    ];

    const selected = selectDailyQuestions(3, smallPool);
    expect(selected).toHaveLength(3);

    const ids = selected.map((q) => q.id).sort();
    expect(ids).toEqual(["a-1", "a-2", "b-1"]);
  });
});

describe("selectDailyQuestionForDay", () => {
  it("returns the same question for repeated renders on the same IST day", () => {
    const pool = [
      { id: "a", topic: "Arrays" },
      { id: "b", topic: "Strings" },
      { id: "c", topic: "Trees" },
    ];
    expect(selectDailyQuestionForDay("2026-10-29", pool))
      .toEqual(selectDailyQuestionForDay("2026-10-29", pool));
  });

  it("rotates deterministically when the IST day changes", () => {
    const pool = Array.from({ length: 50 }, (_, index) => ({ id: String(index) }));
    expect(selectDailyQuestionForDay("2026-10-29", pool).id)
      .not.toBe(selectDailyQuestionForDay("2026-10-30", pool).id);
  });

  it("returns undefined for an empty question pool", () => {
    expect(selectDailyQuestionForDay("2026-10-29", [])).toBeUndefined();
  });
});

describe("scoreQuizAttempt", () => {
  const questions = [
    { id: "q1", topic: "Arrays", correctIndex: 0 },
    { id: "q2", topic: "Strings", correctIndex: 1 },
    { id: "q3", topic: "Arrays", correctIndex: 2 },
    { id: "q4", topic: "DBMS", correctIndex: 3 },
    { id: "q5", topic: "Trees", correctIndex: 0 },
  ];

  it("returns correctCount: 5 for all-correct answers", () => {
    const answers = [0, 1, 2, 3, 0];
    const result = scoreQuizAttempt(questions, answers);
    expect(result.correctCount).toBe(5);
    expect(result.total).toBe(5);
  });

  it("returns improvementTopic: null when correctCount === total", () => {
    const answers = [0, 1, 2, 3, 0];
    const result = scoreQuizAttempt(questions, answers);
    expect(result.improvementTopic).toBeNull();
  });

  it("returns strongestTopic: null when correctCount === 0", () => {
    const answers = [1, 0, 0, 0, 1];
    const result = scoreQuizAttempt(questions, answers);
    expect(result.correctCount).toBe(0);
    expect(result.strongestTopic).toBeNull();
  });

  it("picks the topic with the most correct answers as strongestTopic", () => {
    // Arrays correct twice (q1, q3), Strings correct once (q2), others wrong.
    const answers = [0, 1, 2, 0, 1];
    const result = scoreQuizAttempt(questions, answers);
    expect(result.strongestTopic).toBe("Arrays");
  });

  it("treats null (unanswered) as incorrect, not a crash", () => {
    const answers = [0, null, 2, null, 0];
    expect(() => scoreQuizAttempt(questions, answers)).not.toThrow();
    const result = scoreQuizAttempt(questions, answers);
    expect(result.correctCount).toBe(3);
    expect(result.improvementTopic).toBe("Strings");
  });

  it("breaks strongestTopic ties by earliest question order, deterministically", () => {
    // Each topic correct exactly once -> tie. Earliest correct is q1 (Arrays).
    const answers = [0, 1, 0, 0, 0];
    const resultA = scoreQuizAttempt(questions, answers);
    const resultB = scoreQuizAttempt(questions, answers);
    expect(resultA.strongestTopic).toBe("Arrays");
    expect(resultA.strongestTopic).toBe(resultB.strongestTopic);
  });

  it("breaks improvementTopic ties by earliest incorrect question order, deterministically", () => {
    const answers = [1, 0, 0, 0, 1];
    const resultA = scoreQuizAttempt(questions, answers);
    const resultB = scoreQuizAttempt(questions, answers);
    expect(resultA.improvementTopic).toBe("Arrays");
    expect(resultA.improvementTopic).toBe(resultB.improvementTopic);
  });
});