import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateStreak } from "./calculateStreak.js";

describe("calculateStreak", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("no activity → zero streaks", () => {
    expect(calculateStreak([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("a single day of activity today → currentStreak 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z")); // mid-afternoon IST
    const today = "2026-09-12";
    expect(calculateStreak([today])).toEqual({ currentStreak: 1, longestStreak: 1 });
  });

  it("consecutive days including today → currentStreak grows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    const dates = ["2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 5, longestStreak: 5 });
  });

  it("a missed day breaks the current streak but preserves the longest", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    // Sept 1-5 is a 5-day run, then a gap, then just today (Sept 12) alone.
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-12"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 1, longestStreak: 5 });
  });

  it("last activity was yesterday → streak still counts as current (grace of one day)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    const dates = ["2026-09-10", "2026-09-11"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 2, longestStreak: 2 });
  });

  it("last activity was two days ago → current streak is 0, longest preserved", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    const dates = ["2026-09-08", "2026-09-09", "2026-09-10"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 0, longestStreak: 3 });
  });

  it("duplicate entries for the same day don't inflate the streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00.000Z"));
    const dates = ["2026-09-11", "2026-09-11", "2026-09-12", "2026-09-12"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 2, longestStreak: 2 });
  });

  it("activity right at 12:01 AM IST still counts as the new day for the streak", () => {
    // 2026-09-13T00:01 IST == 2026-09-12T18:31:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T18:31:00.000Z"));
    const dates = ["2026-09-11", "2026-09-12", "2026-09-13"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it("activity at 5:29 AM IST is NOT mistaken for the previous day (regression guard for the UTC bug)", () => {
    // 2026-09-13T05:29 IST == 2026-09-12T23:59:00.000Z (still "Sept 12" in
    // raw UTC terms — this is exactly the window the old implementation
    // got wrong).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T23:59:00.000Z"));
    const dates = ["2026-09-12", "2026-09-13"];
    expect(calculateStreak(dates)).toEqual({ currentStreak: 2, longestStreak: 2 });
  });
});
