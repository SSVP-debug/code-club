import { describe, expect, it } from "vitest";
import { generateDriverCode } from "./generateDriverCode.js";

describe("Plan 014 — ListNode structured driver", () => {
  const javaCode = `class Solution { public boolean isPalindrome(ListNode head) { return true; } }`;
  const cppCode = `class Solution { public: bool isPalindrome(ListNode* head) { return true; } };`;
  const cCode = `bool isPalindrome(struct ListNode* head) { return true; }`;

  it("Java builds a real linked list and emits the boolean result", () => {
    const driver = generateDriverCode(
      "java",
      javaCode,
      { head: [1, 2, 2, 1] },
      "isPalindrome",
      "boolean",
      { head: "ListNode" }
    );

    expect(driver).toContain("class ListNode");
    expect(driver).toContain("ListNode head = buildList(headValues);");
    expect(driver).toContain("boolean result = solution.isPalindrome(head);");
    expect(driver).toContain('System.out.println(result ? "true" : "false");');
  });

  it("C++ builds a real linked list and emits the boolean result", () => {
    const driver = generateDriverCode(
      "cpp",
      cppCode,
      { head: [1, 2, 2, 1] },
      "isPalindrome",
      "bool",
      { head: "ListNode*" }
    );

    expect(driver).toContain("struct ListNode");
    expect(driver).toContain("ListNode* head = buildList(headValues);");
    expect(driver).toContain("bool result = solution.isPalindrome(head);");
    expect(driver).toContain('cout << (result ? "true" : "false")');
  });

  it("C builds a real linked list and emits the boolean result", () => {
    const driver = generateDriverCode(
      "c",
      cCode,
      { head: [1, 2, 2, 1] },
      "isPalindrome",
      "bool",
      { head: "ListNode*" }
    );

    expect(driver).toContain("struct ListNode");
    expect(driver).toContain("struct ListNode* head = buildList(headValues, headSize);");
    expect(driver).toContain("bool result = isPalindrome(head);");
    expect(driver).toContain('printf(result ? "true\\n" : "false\\n");');
  });

  it("handles an empty linked-list testcase without inventing a zero-length C array", () => {
    const driver = generateDriverCode(
      "c",
      cCode,
      { head: [] },
      "isPalindrome",
      "bool",
      { head: "ListNode*" }
    );

    expect(driver).toContain("int* headValues = NULL;");
    expect(driver).toContain("int headSize = 0;");
    expect(driver).toContain("buildList(headValues, headSize)");
  });
});
