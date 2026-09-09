import { describe, expect, it } from "vitest";
import { generateDriverCode, formatJsArg } from "./generateDriverCode.js";
import { validateProblems } from "../scripts/validateProblemContracts.js";

describe("generateDriverCode — Java return type", () => {
  it("declared int (unchanged behavior)", () => {
    const code = `class Solution {\n  public int solve(int[] nums) {\n    return 0;\n  }\n}`;
    const driver = generateDriverCode("java", code, { nums: [1, 2, 3] }, "solve", "int");

    expect(driver).toContain("int result = solution.solve(nums);");
  });

  it("declared long — the direct regression test for the Count Pairs bug", () => {
    const code = `class Solution {\n  public long countPairs(int[] nums, int target) {\n    return 0;\n  }\n}`;
    const driver = generateDriverCode(
      "java",
      code,
      { nums: [1, 1], target: 2 },
      "countPairs",
      "long"
    );

    expect(driver).toContain("long result = solution.countPairs(nums, target);");
    expect(driver).not.toContain("int result = solution.countPairs");
  });

  it("no declared type, long in source — the widened regex fallback also catches it", () => {
    const code = `class Solution {\n  public long countPairs(int[] nums, int target) {\n    return 0;\n  }\n}`;
    // No 5th argument — forces the regex-inference fallback path.
    const driver = generateDriverCode("java", code, { nums: [1, 1], target: 2 }, "countPairs");

    expect(driver).toContain("long result = solution.countPairs(nums, target);");
  });

  it("int[] special case still takes the Arrays.toString() branch", () => {
    const code = `class Solution {\n  public int[] solve(int[] nums) {\n    return nums;\n  }\n}`;
    const driver = generateDriverCode("java", code, { nums: [1, 2] }, "solve", "int[]");

    expect(driver).toContain("Arrays.toString(result)");
  });
});

describe("generateDriverCode — C++ return type", () => {
  it("declared int emits a normal solve() call through printResult", () => {
    const code = `class Solution {\npublic:\n  int solve(vector<int>& nums) {\n    return 0;\n  }\n};`;
    const driver = generateDriverCode("cpp", code, { nums: [1, 2, 3] }, "solve", "int");

    expect(driver).toContain("auto result = solution.solve(nums);");
    expect(driver).toContain("printResult(result);");
  });

  it("declared long long — auto + overloaded printResult already handles it without a cast", () => {
    const code = `class Solution {\npublic:\n  long long countPairs(vector<int>& nums, int target) {\n    return 0;\n  }\n};`;
    const driver = generateDriverCode(
      "cpp",
      code,
      { nums: [1, 1], target: 2 },
      "countPairs",
      "long long"
    );

    // The C++ branch dispatches through `auto` + overload resolution, not a
    // hardcoded declared-type cast — confirm no int-typed declaration was
    // introduced for this call.
    expect(driver).toContain("auto result = solution.countPairs(nums, target);");
    expect(driver).not.toContain("int result");
    expect(driver).toContain("void printResult(long long x)");
  });
});

describe("generateDriverCode — C (structural addition, not yet backfilled — see languages.js's `c` entry)", () => {
  it("declares a companion Size variable for an array argument and threads it into the call", () => {
    const code = `int twoSum(int* nums, int numsSize, int target, int* returnSize) {\n  *returnSize = 0;\n  return NULL;\n}`;
    const driver = generateDriverCode("c", code, { nums: [2, 7, 11, 15], target: 9 }, "twoSum", "int*");

    expect(driver).toContain("int nums[] = {2, 7, 11, 15};");
    expect(driver).toContain("int numsSize = 4;");
    expect(driver).toContain("twoSum(nums, numsSize, target, &returnSize)");
  });

  it("declared bool return prints true/false, not 1/0", () => {
    const code = `bool isPalindrome(int x) {\n  return true;\n}`;
    const driver = generateDriverCode("c", code, { x: 121 }, "isPalindrome", "bool");

    expect(driver).toContain("bool result = isPalindrome(x);");
    expect(driver).toContain('printf(result ? "true" : "false");');
  });

  it("declared char* return quotes the string and does not attempt to free it", () => {
    const code = `char* reverseString(char* s) {\n  return s;\n}`;
    const driver = generateDriverCode("c", code, { s: "hi" }, "reverseString", "char*");

    expect(driver).toContain('char* s = "hi";');
    expect(driver).toContain('printf("\\"%s\\"\\n", result);');
  });

  it("falls back to inferReturnType's short regex whitelist when no returnType is declared", () => {
    const code = `long long countPairs(int* nums, int numsSize, int target) {\n  return 0;\n}`;
    const driver = generateDriverCode("c", code, { nums: [1, 1], target: 2 }, "countPairs");

    expect(driver).toContain('printf("%lld\\n", result);');
  });
});

describe("generateDriverCode — Python", () => {
  it("large integer results round-trip through json.dumps without truncation", () => {
    const code = `class Solution:\n    def countPairs(self, nums, target):\n        return 4999950000`;
    const driver = generateDriverCode("python", code, { nums: [1], target: 2 }, "countPairs");

    expect(driver).toContain("print(json.dumps(_result))");
    // Python ints are arbitrary precision — no special-casing needed, this
    // just locks in that the generated driver doesn't introduce any.
    expect(driver).not.toMatch(/int32|struct\.pack/);
  });
});

describe("generateDriverCode — JavaScript", () => {
  it("large numeric results within Number.MAX_SAFE_INTEGER round-trip via JSON.stringify", () => {
    const code = `function countPairs(nums, target) {\n  return 4999950000;\n}`;
    const driver = generateDriverCode("javascript", code, { nums: [1], target: 2 }, "countPairs");

    expect(driver).toContain("console.log(JSON.stringify(_result));");
    // 4,999,950,000 is well within Number.MAX_SAFE_INTEGER (2^53 - 1 =
    // 9,007,199,254,740,991), so no special serialization is needed for
    // this problem. A future problem whose result could exceed 2^53 would
    // need a documented string-serialization contract, which does not
    // exist today — that's a separate, currently out-of-scope concern.
    expect(4999950000).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});

describe("generateDriverCode — TypeScript (plan 010)", () => {
  it("reuses the same call-and-print shape as JavaScript", () => {
    const code = `function twoSum(nums: number[], target: number) {\n  return [];\n}`;
    const driver = generateDriverCode("typescript", code, { nums: [2, 7], target: 9 }, "twoSum");

    expect(driver).toContain(code);
    expect(driver).toContain("twoSum(");
    expect(driver).toContain("console.log(JSON.stringify(_result));");
  });

  it("formats call arguments the same way formatJsArg does (reused, not duplicated)", () => {
    const code = `function greet(name: string) {\n  return name;\n}`;
    const driver = generateDriverCode("typescript", code, { name: "hi\"there" }, "greet");

    expect(driver).toContain(formatJsArg("hi\"there"));
  });

  it("catch block reports RUNTIME_ERROR using the thrown error's message", () => {
    const code = `function boom() {\n  throw new Error("bad input");\n}`;
    const driver = generateDriverCode("typescript", code, {}, "boom");

    expect(driver).toContain('console.log("RUNTIME_ERROR:" + (e instanceof Error ? e.message : String(e)));');
  });

  it("throws Unsupported language for anything not registered, same as before this phase", () => {
    expect(() => generateDriverCode("rust", "fn solve() {}", {}, "solve")).toThrow(
      "Unsupported language: rust"
    );
  });
});

describe("generateDriverCode — Two Sum Count Pairs overflow regression", () => {
  it("Java driver for the maximum-n case declares a long, not an int", () => {
    const n = 100000;
    const code = `class Solution {\n  public long countPairs(int[] nums, int target) {\n    return 0;\n  }\n}`;
    const driver = generateDriverCode(
      "java",
      code,
      { nums: Array(n).fill(1), target: 2 },
      "countPairs",
      "long"
    );

    // 100000 * 99999 / 2 = 4,999,950,000 > Integer.MAX_VALUE (2,147,483,647).
    expect(n * (n - 1)) // sanity: the combinatorial count this problem exercises
      .toBeGreaterThan(2 * 2147483647);
    expect(driver).toContain("long result = solution.countPairs(nums, target);");
  });
});

describe("generateDriverCode — Java argument types (audit P0-1)", () => {
  it("a String argument declares as String, not Object — the valid-parentheses reproduction", () => {
    const code = `class Solution {\n    public boolean isValid(String s) {\n        return true;\n    }\n}`;
    const driver = generateDriverCode("java", code, { s: "()[]{}" }, "isValid", "boolean");

    expect(driver).toContain('String s = "()[]{}";');
    expect(driver).not.toContain("Object s");
  });

  it("a String[] argument declares as String[] with a valid brace literal — the group-anagrams reproduction", () => {
    const code = `class Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {\n        return null;\n    }\n}`;
    const driver = generateDriverCode("java", code, { strs: ["eat", "tea", "tan"] }, "groupAnagrams", "List<List<String>>");

    expect(driver).toContain('String[] strs = {"eat", "tea", "tan"};');
    expect(driver).not.toContain("int[] strs");
    expect(driver).not.toMatch(/strs\s*=\s*\[/); // no invalid bracket literal
  });

  it("a numeric matrix argument declares as int[][] with nested braces — the course-schedule/clone-graph reproduction", () => {
    const code = `class Solution {\n    public boolean canFinish(int numCourses, int[][] prerequisites) {\n        return true;\n    }\n}`;
    const driver = generateDriverCode(
      "java", code, { numCourses: 2, prerequisites: [[1, 0]] }, "canFinish", "boolean"
    );

    expect(driver).toContain("int[][] prerequisites = {{1, 0}};");
    expect(driver).not.toMatch(/prerequisites\s*=\s*\[/);
  });

  it("real confirmed-broken problems from src/data/problems.js now generate clean Java for every declared/first testcase", async () => {
    const { default: problems } = await import("../../src/data/problems.js");
    const targets = [
      "valid-parentheses", "group-anagrams", "course-schedule",
      "clone-graph", "pacific-atlantic-water-flow", "word-break",
      "longest-common-prefix", "encode-and-decode-strings",
    ];

    for (const slug of targets) {
      const problem = problems.find((p) => p.slug === slug);
      expect(problem, `expected to find problem "${slug}" in src/data/problems.js`).toBeTruthy();

      const testcase = problem.testcases?.[0] || problem.hiddentestcases?.[0];
      const driver = generateDriverCode(
        "java",
        problem.starterCode.java,
        testcase.input,
        problem.functionName,
        problem.returnType?.java,
        problem.paramTypes?.java
      );

      expect(driver, `${slug}: should not declare any argument as Object`).not.toMatch(/\bObject\s+\w+\s*=/);
      expect(driver, `${slug}: should not use an invalid [ bracket array literal`).not.toMatch(/\]\s*\w+\s*=\s*\[/);
    }
  });
});

describe("generateDriverCode — paramTypes contract overrides structural inference", () => {
  it("an explicit paramTypes.java entry wins over the structural guess", () => {
    const code = `class Solution {\n    public long solve(long n) {\n        return n;\n    }\n}`;
    // A bare JS number like 5000000000 IS structurally distinguishable
    // from an int (Number.isInteger is still true for it, so the
    // structural fallback alone would call it "int" and silently
    // truncate/fail to compile as a long literal) — this is exactly the
    // case an explicit paramTypes declaration exists to cover.
    const driver = generateDriverCode(
      "java", code, { n: 5000000000 }, "solve", "long", { n: "long" }
    );

    expect(driver).toContain("long n = 5000000000L;");
  });
});

describe("generateDriverCode — Python boolean arguments (audit P1-3)", () => {
  it("formats a boolean argument as True/False, not the invalid lowercase true/false", () => {
    const code = `class Solution:\n    def hasCycle(self, flag):\n        return flag`;
    const driver = generateDriverCode("python", code, { flag: true }, "hasCycle");

    expect(driver).toContain("hasCycle(True)");
    expect(driver).not.toContain("hasCycle(true)");
  });

  it("formats a nested boolean (inside an array) correctly too", () => {
    const code = `class Solution:\n    def solve(self, flags):\n        return flags`;
    const driver = generateDriverCode("python", code, { flags: [true, false] }, "solve");

    expect(driver).toContain("solve([True, False])");
  });
});

describe("validateProblemContracts — argument generation check (audit P0-1)", () => {
  it("every real problem (except tracked design-pattern problems) generates argument-safe Java and C++", async () => {
    const { default: problems } = await import("../../src/data/problems.js");
    const errors = validateProblems(problems);
    expect(errors).toHaveLength(0);
  });
});

describe("validateProblemContracts — mismatch detection", () => {
  it("flags a problem whose starter code disagrees with its declared returnType", () => {
    const mismatched = {
      slug: "fake-problem",
      functionName: "countPairs",
      returnType: { java: "long", cpp: "long long" },
      starterCode: {
        java: `class Solution {\n  public int countPairs(int[] nums, int target) {\n    return 0;\n  }\n}`,
        cpp: `class Solution {\npublic:\n  int countPairs(vector<int>& nums, int target) {\n    return 0;\n  }\n};`,
      },
    };

    const errors = validateProblems([mismatched]);

    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/Java starter code declares return type "int"/);
    expect(errors[1]).toMatch(/C\+\+ starter code declares return type "int"/);
  });

  it("passes a consistent problem definition", () => {
    const consistent = {
      slug: "fake-problem-ok",
      functionName: "countPairs",
      returnType: { java: "long", cpp: "long long" },
      starterCode: {
        java: `class Solution {\n  public long countPairs(int[] nums, int target) {\n    return 0;\n  }\n}`,
        cpp: `class Solution {\npublic:\n  long long countPairs(vector<int>& nums, int target) {\n    return 0;\n  }\n};`,
      },
    };

    expect(validateProblems([consistent])).toHaveLength(0);
  });

  it("real problem data (src/data/problems.js) has no contract mismatches", async () => {
    const { default: problems } = await import("../../src/data/problems.js");
    expect(validateProblems(problems)).toHaveLength(0);
  });

  it("real Code Club Edition mission data has no contract mismatches", async () => {
    // Shares the same Problem schema and generateDriverCode runner as the
    // standard catalog (see backend/scripts/seedCodeClubEdition.js) — must
    // be checked too, not just src/data/problems.js.
    const { default: missions } = await import(
      "../../src/data/code-club-edition/index.js"
    );
    expect(validateProblems(missions)).toHaveLength(0);
  });
});

// Plan 012 (C language onboarding), Batch 1 — validateProblemContracts.js's
// new C-specific checks. No java/cpp equivalent exists for the "unsupported
// return type" and "unsafe array param" checks below because both bug
// classes are specific to languageDrivers/c.js's narrower, non-generic
// fallback behavior — see that file and validateProblemContracts.js's own
// comments on checkCReturnTypeSupported/checkCArrayParamTypeSafety.
describe("validateProblemContracts — C contract checks (Plan 012)", () => {
  it("flags a problem whose C starter code disagrees with its declared returnType.c", () => {
    const mismatched = {
      slug: "fake-c-mismatch",
      functionName: "countPairs",
      returnType: { c: "long long" },
      starterCode: {
        c: `int countPairs(int* nums, int numsSize, int target) {\n  return 0;\n}`,
      },
    };

    const errors = validateProblems([mismatched]);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/C starter code declares return type "int" but returnType\.c says "long long"/);
  });

  it("passes a consistent C problem definition", () => {
    const consistent = {
      slug: "fake-c-ok",
      functionName: "countPairs",
      returnType: { c: "long long" },
      starterCode: {
        c: `long long countPairs(int* nums, int numsSize, int target) {\n  return 0;\n}`,
      },
      testcases: [{ input: { nums: [1, 1], target: 2 }, expectedOutput: 1 }],
    };

    expect(validateProblems([consistent])).toHaveLength(0);
  });

  it("flags an inferred C return type that generate() does not actually support (silent-fallthrough bug class)", () => {
    // No `class Solution` idea applies to C, so an unsupported shape like
    // a 2D-array return can't be spelled with a real return-type token
    // the driver recognizes — this is exactly the case that used to slip
    // through to generate()'s scalar-else branch undetected.
    const unsupported = {
      slug: "fake-c-unsupported-return",
      functionName: "solve",
      starterCode: {
        c: `int** solve(int* nums, int numsSize, int* returnSize) {\n  return NULL;\n}`,
      },
      testcases: [{ input: { nums: [1, 2] }, expectedOutput: [[1], [2]] }],
    };

    const errors = validateProblems([unsupported]);
    const returnTypeError = errors.find((e) => e.includes("not one of languageDrivers/c.js's"));
    expect(returnTypeError).toBeDefined();
    // The signature-line regex reads the real "int**" token directly off
    // the function definition rather than trusting inferReturnType()'s
    // own lossy whitelist-with-default-to-"int" fallback — see
    // checkCReturnTypeSupported's comment for why that distinction
    // matters here.
    expect(returnTypeError).toMatch(/C return type "int\*\*" is not one of/);
  });

  it("an explicitly declared but unsupported returnType.c is caught too, not just a bad inference", () => {
    const declaredUnsupported = {
      slug: "fake-c-declared-unsupported",
      functionName: "solve",
      returnType: { c: "int**" },
      starterCode: {
        c: `int** solve(int* nums, int numsSize, int* returnSize) {\n  return NULL;\n}`,
      },
    };

    const errors = validateProblems([declaredUnsupported]);
    expect(errors.some((e) => e.includes('C return type "int**" is not one of'))).toBe(true);
  });

  it("flags a numeric array parameter containing non-integer values with no explicit paramTypes.c override", () => {
    const unsafeDoubleArray = {
      slug: "fake-c-double-array",
      functionName: "average",
      starterCode: {
        c: `double average(double* nums, int numsSize) {\n  return 0.0;\n}`,
      },
      testcases: [{ input: { nums: [1.5, 2.5, 3.0] }, expectedOutput: 2.33 }],
    };

    const errors = validateProblems([unsafeDoubleArray]);
    expect(errors.some((e) => e.includes('paramTypes.c.nums = "double[]"'))).toBe(true);
  });

  it("an explicit paramTypes.c override silences the non-integer-array warning", () => {
    const declaredDoubleArray = {
      slug: "fake-c-double-array-declared",
      functionName: "average",
      paramTypes: { c: { nums: "double[]" } },
      returnType: { c: "double" },
      starterCode: {
        c: `double average(double* nums, int numsSize) {\n  return 0.0;\n}`,
      },
      testcases: [{ input: { nums: [1.5, 2.5, 3.0] }, expectedOutput: 2.33 }],
    };

    expect(validateProblems([declaredDoubleArray])).toHaveLength(0);
  });

  it("checkArgumentGeneration's C branch runs generateDriverCode without throwing for an ordinary problem (regression guard, not a positive throw test — see languageDrivers/c.js's header: generate() has no exception path of its own, so this only guards against a future generation-time crash, not today's permissive-but-silent behavior)", () => {
    const ordinary = {
      slug: "fake-c-ordinary",
      functionName: "twoSum",
      returnType: { c: "int*" },
      starterCode: {
        c: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n  *returnSize = 0;\n  return NULL;\n}`,
      },
      testcases: [{ input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1] }],
    };

    expect(validateProblems([ordinary])).toHaveLength(0);
  });

  it("Plan 012 Batch 2: a single-array-param int*-return problem (arr1d->arr1d) validates cleanly", () => {
    const arrayToArray = {
      slug: "fake-c-move-zeroes",
      functionName: "moveZeroes",
      returnType: { c: "int*" },
      starterCode: {
        c: `int* moveZeroes(int* nums, int numsSize, int* returnSize) {\n  *returnSize = 0;\n  return NULL;\n}`,
      },
      testcases: [{ input: { nums: [0, 1, 0, 3, 12] }, expectedOutput: [1, 3, 12, 0, 0] }],
    };

    expect(validateProblems([arrayToArray])).toHaveLength(0);
  });

  it("Plan 012 Batch 2: a plain string-param int-return problem (str->int) validates cleanly", () => {
    const strToInt = {
      slug: "fake-c-decode-ways",
      functionName: "numDecodings",
      starterCode: {
        c: `int numDecodings(char* s) {\n  return 0;\n}`,
      },
      testcases: [{ input: { s: "226" }, expectedOutput: 2 }],
    };

    expect(validateProblems([strToInt])).toHaveLength(0);
  });

  it("Plan 012 Batch 3: a char* return (string output) problem validates cleanly", () => {
    const strReturn = {
      slug: "fake-c-reverse-string",
      functionName: "reverseString",
      starterCode: {
        c: `char* reverseString(char* s) {\n  return "";\n}`,
      },
      testcases: [{ input: { s: "hello" }, expectedOutput: "olleh" }],
    };

    expect(validateProblems([strReturn])).toHaveLength(0);
  });

  it("Plan 012 Batch 3: a char** param (array-of-strings input) problem validates cleanly", () => {
    const strArrayParam = {
      slug: "fake-c-longest-common-prefix",
      functionName: "longestCommonPrefix",
      starterCode: {
        c: `char* longestCommonPrefix(char** strs, int strsSize) {\n  return "";\n}`,
      },
      testcases: [{ input: { strs: ["flower", "flow", "flight"] }, expectedOutput: "fl" }],
    };

    expect(validateProblems([strArrayParam])).toHaveLength(0);
  });

  it("Plan 012 Batch 4: flags an operation-sequence C starter for a class with a void-returning method (compile-error class)", () => {
    const voidMethodDesign = {
      slug: "fake-c-void-design",
      functionName: "LRUCache",
      operationSequence: { enabled: true, resultMode: "all" },
      starterCode: {
        cpp: `class LRUCache {\npublic:\n    LRUCache(int capacity) {}\n    int get(int key) { return -1; }\n    void put(int key, int value) {}\n};`,
        c: `typedef struct { int _unused; } LRUCache;\nLRUCache* LRUCache_create(int capacity) { return NULL; }\nint LRUCache_get(LRUCache* self, int key) { return -1; }\nvoid LRUCache_put(LRUCache* self, int key, int value) {}`,
      },
    };

    const errors = validateProblems([voidMethodDesign]);
    expect(errors.some((e) => e.includes("put() returns void — casting to long is a compile error"))).toBe(true);
  });

  it("Plan 012 Batch 4: flags an operation-sequence C starter for a class with a bool-returning method (grading-mismatch class)", () => {
    const boolMethodDesign = {
      slug: "fake-c-bool-design",
      functionName: "MyCalendarTwo",
      operationSequence: { enabled: true, resultMode: "all" },
      starterCode: {
        cpp: `class MyCalendarTwo {\npublic:\n    MyCalendarTwo() {}\n    bool book(int start, int end) { return false; }\n};`,
        c: `typedef struct { int _unused; } MyCalendarTwo;\nMyCalendarTwo* MyCalendarTwo_create() { return NULL; }\nbool MyCalendarTwo_book(MyCalendarTwo* self, int start, int end) { return false; }`,
      },
    };

    const errors = validateProblems([boolMethodDesign]);
    expect(errors.some((e) => e.includes("book() returns bool — prints as 1/0"))).toBe(true);
  });

  it("Plan 012 Batch 4: an operation-sequence C starter where every method returns int validates cleanly", () => {
    const allIntDesign = {
      slug: "fake-c-int-design",
      functionName: "StockSpanner",
      operationSequence: { enabled: true, resultMode: "all" },
      starterCode: {
        cpp: `class StockSpanner {\npublic:\n    StockSpanner() {}\n    int next(int price) { return 0; }\n};`,
        c: `typedef struct { int _unused; } StockSpanner;\nStockSpanner* StockSpanner_create() { return NULL; }\nint StockSpanner_next(StockSpanner* self, int price) { return 0; }`,
      },
    };

    expect(validateProblems([allIntDesign])).toHaveLength(0);
  });
});