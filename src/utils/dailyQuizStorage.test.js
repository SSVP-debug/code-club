import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  hasCompletedQuizToday,
  markQuizCompletedToday,
  hasShownOnboardingThisSession,
  markOnboardingShownThisSession,
} from "./dailyQuizStorage";

describe("dailyQuizStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports not completed when nothing has been recorded yet", () => {
    expect(hasCompletedQuizToday()).toBe(false);
  });

  it("reports completed immediately after marking it done today", () => {
    markQuizCompletedToday();
    expect(hasCompletedQuizToday()).toBe(true);
  });

  it("reports not completed again once the calendar day changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T10:00:00Z"));
    markQuizCompletedToday();
    expect(hasCompletedQuizToday()).toBe(true);

    vi.setSystemTime(new Date("2026-08-04T00:05:00Z"));
    expect(hasCompletedQuizToday()).toBe(false);
  });

  describe("IST day-boundary behavior (src/utils/studentDay.js policy)", () => {
    it("completing at 11:59 PM IST and refreshing at 12:01 AM IST rolls over correctly", () => {
      vi.useFakeTimers();
      // 2026-08-03T23:59 IST == 2026-08-03T18:29:00.000Z
      vi.setSystemTime(new Date("2026-08-03T18:29:00.000Z"));
      markQuizCompletedToday();
      expect(hasCompletedQuizToday()).toBe(true);

      // 2026-08-04T00:01 IST == 2026-08-03T18:31:00.000Z — a new IST day
      vi.setSystemTime(new Date("2026-08-03T18:31:00.000Z"));
      expect(hasCompletedQuizToday()).toBe(false);
    });

    it("does not roll over yet at 5:29 AM IST (regression guard for the old UTC-day bug)", () => {
      vi.useFakeTimers();
      // 2026-08-04T00:10 IST == 2026-08-03T18:40:00.000Z
      vi.setSystemTime(new Date("2026-08-03T18:40:00.000Z"));
      markQuizCompletedToday();

      // 2026-08-04T05:29 IST == 2026-08-03T23:59:00.000Z — still "Aug 4"
      // IST, even though the raw UTC calendar date is still "Aug 3." The
      // old implementation would have disagreed with itself here.
      vi.setSystemTime(new Date("2026-08-03T23:59:00.000Z"));
      expect(hasCompletedQuizToday()).toBe(true);
    });

    it("multiple tabs (repeated reads with no time change) agree", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-03T10:00:00.000Z"));
      markQuizCompletedToday();

      // Simulate two tabs independently reading the same stored state.
      expect(hasCompletedQuizToday()).toBe(true);
      expect(hasCompletedQuizToday()).toBe(true);
    });
  });
});

describe("dailyQuizStorage — per-session onboarding tracking", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("reports not shown when nothing has been recorded yet this session", () => {
    expect(hasShownOnboardingThisSession()).toBe(false);
  });

  it("reports shown immediately after marking it for this session", () => {
    markOnboardingShownThisSession();
    expect(hasShownOnboardingThisSession()).toBe(true);
  });

  it("is independent of the quiz's own once-per-day tracking", () => {
    markOnboardingShownThisSession();
    expect(hasCompletedQuizToday()).toBe(false);

    localStorage.clear();
    sessionStorage.clear();
    markQuizCompletedToday();
    expect(hasShownOnboardingThisSession()).toBe(false);
  });
});