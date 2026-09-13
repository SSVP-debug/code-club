import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getStudentDayKey,
  getPreviousStudentDayKey,
  isNextStudentDay,
} from "./studentDay.js";

// Helper: build a UTC instant from an IST wall-clock time, so tests read as
// "11:59 PM IST on Sept 12" rather than forcing every assertion through a
// manual UTC offset calculation. IST = UTC+5:30, so an IST instant's UTC
// equivalent is (IST time) - 5:30.
function istInstant(isoDateTimeIST) {
  // isoDateTimeIST like "2026-09-12T23:59:00" — interpreted as IST wall time.
  const asUTCIfNoOffset = new Date(`${isoDateTimeIST}Z`); // treat digits as UTC first
  return new Date(asUTCIfNoOffset.getTime() - (5 * 60 + 30) * 60 * 1000);
}

describe("getStudentDayKey", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("11:59 PM IST on Sept 12 is still Sept 12", () => {
    const t = istInstant("2026-09-12T23:59:00");
    expect(getStudentDayKey(t)).toBe("2026-09-12");
  });

  it("12:00 AM IST on Sept 13 is Sept 13 (the exact rollover instant)", () => {
    const t = istInstant("2026-09-13T00:00:00");
    expect(getStudentDayKey(t)).toBe("2026-09-13");
  });

  it("12:01 AM IST on Sept 13 is Sept 13", () => {
    const t = istInstant("2026-09-13T00:01:00");
    expect(getStudentDayKey(t)).toBe("2026-09-13");
  });

  it("5:29 AM IST on Sept 13 is still Sept 13, not Sept 12 (the UTC-bug window)", () => {
    // This is exactly the window (00:00-05:29 IST) where the old
    // `new Date().toISOString().split("T")[0]` implementation silently
    // returned the *previous* UTC day. 5:29 AM IST = 23:59 UTC the
    // previous day, which is the failure case this test guards against.
    const t = istInstant("2026-09-13T05:29:00");
    expect(getStudentDayKey(t)).toBe("2026-09-13");
  });

  it("5:30 AM IST on Sept 13 is Sept 13 (UTC day and IST day now agree again)", () => {
    const t = istInstant("2026-09-13T05:30:00");
    expect(getStudentDayKey(t)).toBe("2026-09-13");
  });

  it("defaults to the current instant when called with no argument", () => {
    vi.useFakeTimers();
    // 2026-09-13T00:15:00 IST == 2026-09-12T18:45:00Z
    vi.setSystemTime(new Date("2026-09-12T18:45:00.000Z"));
    expect(getStudentDayKey()).toBe("2026-09-13");
  });

  it("accepts an ISO string or epoch number, not just a Date", () => {
    const iso = "2026-09-12T20:00:00.000Z"; // = 2026-09-13T01:30 IST
    expect(getStudentDayKey(iso)).toBe("2026-09-13");
    expect(getStudentDayKey(new Date(iso).getTime())).toBe("2026-09-13");
  });
});

describe("getPreviousStudentDayKey", () => {
  it("returns the IST calendar day before the given instant", () => {
    const t = istInstant("2026-09-13T00:01:00");
    expect(getPreviousStudentDayKey(t)).toBe("2026-09-12");
  });

  it("crosses a month boundary correctly", () => {
    const t = istInstant("2026-10-01T00:10:00");
    expect(getPreviousStudentDayKey(t)).toBe("2026-09-30");
  });
});

describe("isNextStudentDay", () => {
  it("true for two consecutive calendar days", () => {
    expect(isNextStudentDay("2026-09-12", "2026-09-13")).toBe(true);
  });

  it("false for the same day", () => {
    expect(isNextStudentDay("2026-09-12", "2026-09-12")).toBe(false);
  });

  it("false when a day is skipped", () => {
    expect(isNextStudentDay("2026-09-12", "2026-09-14")).toBe(false);
  });

  it("true across a month boundary", () => {
    expect(isNextStudentDay("2026-09-30", "2026-10-01")).toBe(true);
  });
});
