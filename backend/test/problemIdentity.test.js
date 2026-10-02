import mongoose from "mongoose";
import Problem from "../models/Problem.js";
import {
  buildProblemIdentityPayload,
  computeProblemIdentityFingerprint,
  validateProblemIdentity,
} from "../utils/problemIdentity.js";

describe("problem identity", () => {
  const baseProblem = {
    description: "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.",
    returnType: { java: "int" },
    paramTypes: { java: { value: "int" } },
    comparisonMode: "exact",
    operationSequence: { enabled: true, resultMode: "returningOnly" },
  };

  it("produces the same fingerprint when object key order changes", () => {
    const a = computeProblemIdentityFingerprint(baseProblem);
    const b = computeProblemIdentityFingerprint({
      ...baseProblem,
      returnType: { java: "int" },
      paramTypes: { java: { value: "int" } },
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores presentation metadata that is not part of identity", () => {
    const a = computeProblemIdentityFingerprint(baseProblem);
    const b = computeProblemIdentityFingerprint({
      ...baseProblem,
      title: "Minimum Stack — renamed",
      slug: "minimum-stack-renamed",
      topic: "Stack",
      companies: ["Example Corp"],
    });
    expect(a).toBe(b);
  });

  it("changes when the execution contract changes", () => {
    const a = computeProblemIdentityFingerprint(baseProblem);
    const b = computeProblemIdentityFingerprint({
      ...baseProblem,
      operationSequence: { enabled: true, resultMode: "all" },
    });
    expect(a).not.toBe(b);
  });

  it("canonicalizes text whitespace and case", () => {
    const a = computeProblemIdentityFingerprint(baseProblem);
    const b = computeProblemIdentityFingerprint({
      ...baseProblem,
      description: "  DESIGN a stack that supports push, pop, top, and retrieving the minimum element in constant time.  ",
    });
    expect(a).toBe(b);
  });

  it("exposes the P1 identity fields on the Problem model", () => {
    expect(Problem.schema.path("problemKey")).toBeTruthy();
    expect(Problem.schema.path("familyKey")).toBeTruthy();
    expect(Problem.schema.path("variantOf")).toBeTruthy();
    expect(Problem.schema.path("identityFingerprint")).toBeTruthy();
    expect(Problem.schema.path("problemKey").options.immutable).toBe(true);
    expect(Problem.schema.path("problemKey").options.unique).toBe(true);
  });

  it("rejects self-referential variants and malformed identity values", () => {
    expect(() => validateProblemIdentity({
      problemKey: "550e8400-e29b-41d4-a716-446655440000",
      familyKey: "550e8400-e29b-41d4-a716-446655440001",
      variantOf: "550e8400-e29b-41d4-a716-446655440000",
      identityFingerprint: "a".repeat(64),
    })).toThrow(/variantOf cannot reference/);
  });
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});
