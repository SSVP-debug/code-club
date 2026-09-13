import { describe, it, expect } from "vitest";
import { getStudentDayKey, getPreviousStudentDayKey } from "./studentDay";

// Same IST-instant helper and same test vectors as
// backend/utils/studentDay.test.js — this file exists specifically to
// prove the frontend and backend agree on the same day boundary, per the
// audit's Phase 2 requirement ("do not rely solely on mocked frontend
// dates" / "make sure the test suite proves the frontend and backend
// agree on the same day boundary").
function istInstant(isoDateTimeIST) {
  const asUTCIfNoOffset = new Date(`${isoDateTimeIST}Z`);
  return new Date(asUTCIfNoOffset.getTime() - (5 * 60 + 30) * 60 * 1000);
}

describe("getStudentDayKey (frontend)", () => {
  it("11:59 PM IST on Sept 12 is still Sept 12", () => {
    expect(getStudentDayKey(istInstant("2026-09-12T23:59:00"))).toBe("2026-09-12");
  });

  it("12:00 AM IST on Sept 13 is Sept 13", () => {
    expect(getStudentDayKey(istInstant("2026-09-13T00:00:00"))).toBe("2026-09-13");
  });

  it("12:01 AM IST on Sept 13 is Sept 13", () => {
    expect(getStudentDayKey(istInstant("2026-09-13T00:01:00"))).toBe("2026-09-13");
  });

  it("5:29 AM IST on Sept 13 is still Sept 13, not Sept 12", () => {
    expect(getStudentDayKey(istInstant("2026-09-13T05:29:00"))).toBe("2026-09-13");
  });

  it("5:30 AM IST on Sept 13 is Sept 13", () => {
    expect(getStudentDayKey(istInstant("2026-09-13T05:30:00"))).toBe("2026-09-13");
  });

  it("agrees with the backend's day key for the same instant (cross-check vector)", () => {
    // Same instant used in backend/utils/studentDay.test.js's
    // "accepts an ISO string" case — both sides must produce "2026-09-13".
    const iso = "2026-09-12T20:00:00.000Z";
    expect(getStudentDayKey(iso)).toBe("2026-09-13");
  });
});

describe("getPreviousStudentDayKey (frontend)", () => {
  it("returns the IST calendar day before the given instant", () => {
    expect(getPreviousStudentDayKey(istInstant("2026-09-13T00:01:00"))).toBe("2026-09-12");
  });
});
