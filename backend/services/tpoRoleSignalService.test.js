import { describe, expect, it } from "vitest";
import {
  classifyInstitutionalEmailRole,
  isValidRolePatternRule,
  sanitizeRolePatternRules,
} from "./tpoRoleSignalService.js";

describe("tpoRoleSignalService", () => {
  const college = {
    staffEmailPatterns: [
      { type: "domain", value: "staff.example.edu" },
      { type: "local_prefix", values: ["staff.", "faculty."] },
      { type: "local_regex", value: "^(dr\\.|prof)" },
    ],
    studentEmailPatterns: [
      { type: "domain", value: "students.example.edu" },
      { type: "local_prefix", values: ["student.", "22"] },
    ],
  };

  it("classifies a configured staff domain", () => {
    expect(classifyInstitutionalEmailRole("person@staff.example.edu", college)).toBe("staff_candidate");
  });

  it("classifies a configured student domain", () => {
    expect(classifyInstitutionalEmailRole("person@students.example.edu", college)).toBe("student_candidate");
  });

  it("classifies a staff local prefix", () => {
    expect(classifyInstitutionalEmailRole("faculty.person@example.edu", college)).toBe("staff_candidate");
  });

  it("returns ambiguous when both rule groups match", () => {
    expect(classifyInstitutionalEmailRole("student.person@staff.example.edu", college)).toBe("ambiguous");
  });

  it("returns unknown for an unmatched address", () => {
    expect(classifyInstitutionalEmailRole("person@example.edu", college)).toBe("unknown");
  });

  it("rejects unsupported and malformed rules", () => {
    expect(isValidRolePatternRule({ type: "wat", value: "x" })).toBe(false);
    expect(isValidRolePatternRule({ type: "domain", value: "bad domain" })).toBe(false);
    expect(isValidRolePatternRule({ type: "local_regex", value: "[" })).toBe(false);
  });

  it("sanitizes and bounds rules", () => {
    const rules = sanitizeRolePatternRules([
      { type: "DOMAIN", value: "STAFF.EXAMPLE.EDU" },
      { type: "LOCAL_PREFIX", values: ["Faculty.", ""] },
      { type: "wat", value: "ignored" },
    ]);
    expect(rules).toEqual([
      { type: "domain", value: "staff.example.edu" },
      { type: "local_prefix", values: ["faculty."] },
    ]);
  });
});
