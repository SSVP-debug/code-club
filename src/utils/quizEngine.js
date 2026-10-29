/**
 * quizEngine.js
 *
 * Pure logic for the Daily Quick Quiz — no React, no DOM, no localStorage.
 * "Once per day" gating and persistence-free scoring UI live in the onboarding
 * flow (Plan 002); this module only selects questions and scores an attempt.
 */

import quizQuestions, { QUIZ_TOPICS } from "../data/quizQuestions.js";

/**
 * Selects `count` random questions, at most one per topic where possible, so a
 * single draw doesn't ask two Arrays questions and skip DBMS entirely.
 * Falls back to allowing repeats of a topic only if `count` exceeds the number of
 * distinct topics available in the bank.
 *
 * @param {number} count - how many questions to select
 * @param {Array} questions - question pool to select from (defaults to the full bank)
 * @returns {Array} the selected questions, in randomized order
 */
export function selectDailyQuestions(count = 1, questions = quizQuestions) {
  const byTopic = new Map();

  for (const question of questions) {
    if (!byTopic.has(question.topic)) {
      byTopic.set(question.topic, []);
    }
    byTopic.get(question.topic).push(question);
  }

  const topics = shuffle(Array.from(byTopic.keys()));
  const selected = [];

  // Pass 1: at most one question per topic, in random topic order.
  for (const topic of topics) {
    if (selected.length >= count) break;
    const topicQuestions = byTopic.get(topic);
    const pick = topicQuestions[Math.floor(Math.random() * topicQuestions.length)];
    selected.push(pick);
  }

  // Pass 2: if there aren't enough distinct topics to reach `count`, fill the
  // remainder from the full pool, allowing topic repeats but not question repeats.
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const remainingPool = shuffle(questions.filter((q) => !selectedIds.has(q.id)));

    for (const question of remainingPool) {
      if (selected.length >= count) break;
      selected.push(question);
    }
  }

  return shuffle(selected).slice(0, count);
}

/**
 * Scores a completed quiz attempt.
 * @param {Array<{id: string, topic: string, correctIndex: number}>} questions - the
 *   questions that were shown, in order
 * @param {Array<number|null>} answers - the option index the user picked for each
 *   question, same order/length as `questions`; null = unanswered
 * @returns {{
 *   correctCount: number,
 *   total: number,
 *   strongestTopic: string | null,
 *   improvementTopic: string | null,
 * }}
 */
export function scoreQuizAttempt(questions, answers) {
  const total = questions.length;
  let correctCount = 0;

  const correctTopicsInOrder = [];
  const incorrectTopicsInOrder = [];

  questions.forEach((question, index) => {
    const answer = answers[index] ?? null;
    const isCorrect = answer !== null && answer === question.correctIndex;

    if (isCorrect) {
      correctCount += 1;
      correctTopicsInOrder.push(question.topic);
    } else {
      incorrectTopicsInOrder.push(question.topic);
    }
  });

  const strongestTopic = correctCount === 0 ? null : mostFrequentByFirstOccurrence(correctTopicsInOrder);
  const improvementTopic = correctCount === total ? null : incorrectTopicsInOrder[0] ?? null;

  return {
    correctCount,
    total,
    strongestTopic,
    improvementTopic,
  };
}

/**
 * Returns the value that occurs most often in `list`. Ties are broken by
 * whichever tied value appeared first in `list` (deterministic, no Math.random()).
 */
function mostFrequentByFirstOccurrence(list) {
  const counts = new Map();

  for (const value of list) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best = null;
  let bestCount = 0;

  for (const value of list) {
    const count = counts.get(value);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  return best;
}

/** Fisher-Yates shuffle — returns a new array, does not mutate the input. */
function shuffle(array) {
  const result = array.slice();

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

export { QUIZ_TOPICS };