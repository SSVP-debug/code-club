import { describe, expect, it } from "vitest";
import TpoVerificationReview from "./TpoVerificationReview.js";

describe("TpoVerificationReview", () => {
  it("requires the reviewer decision fields", () => {
    const doc = new TpoVerificationReview({});
    const error = doc.validateSync();
    expect(error?.errors?.userId).toBeTruthy();
    expect(error?.errors?.collegeId).toBeTruthy();
    expect(error?.errors?.requestedEmail).toBeTruthy();
    expect(error?.errors?.emailRoleSignal).toBeTruthy();
    expect(error?.errors?.decision).toBeTruthy();
    expect(error?.errors?.reviewedBy).toBeTruthy();
  });

  it("accepts the four advisory email classifications", () => {
    for (const signal of ["staff_candidate", "student_candidate", "ambiguous", "unknown"]) {
      const doc = new TpoVerificationReview({
        userId: "507f1f77bcf86cd799439011",
        collegeId: "507f1f77bcf86cd799439012",
        requestedEmail: "person@example.edu",
        emailRoleSignal: signal,
        decision: "approved",
        reviewedBy: "507f1f77bcf86cd799439013",
      });
      expect(doc.validateSync()).toBeUndefined();
    }
  });
});
