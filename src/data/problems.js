/**
 * problems.js — Code Club problem catalog
 *
 * This file is the single source of truth for all problems.
 * It is imported by:
 *   - backend/scripts/seedProblems.js  (seeds MongoDB)
 *   - src/hooks/useProblems.js         (fallback if API unreachable)
 *
 * Fields:
 *   testcases        — visible to client, used in Run mode
 *   hiddentestcases  — server-only, used in Submit mode (never sent to client)
 *   estimatedTime    — rough time budget for a prepared candidate
 *   companies        — companies known to ask this in interviews
 *   relatedProblems  — slugs of thematically linked problems on this platform
 *   hints            — progressive hints, ordered from vague → specific
 */

import problemMetadata from "./problemMetadata.js";

const rawProblems = [

  // ── ARRAYS ────────────────────────────────────────────────────────────────

  {
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    functionName: "twoSum",
    difficulty: "Easy",
    topic: "Arrays",
    pattern: "hash map complement",
    sourceType: "core",
    description:
      "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input has exactly one solution, and you may not use the same element twice.",
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] = 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists."],
    starterCode: {
      python: `class Solution:\n    def twoSum(self, nums, target):\n        pass`,
      javascript: `function twoSum(nums, target) {\n\n}`,
      typescript: `function twoSum(nums: number[], target: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return {};\n    }\n};`,
      c: `int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1] },
      { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2] },
      { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1] },
    ],
    hiddentestcases: [
      { input: { nums: [1, 5, 3, 7], target: 8 }, expectedOutput: [1, 3] },
      { input: { nums: [0, 4, 3, 0], target: 0 }, expectedOutput: [0, 3] },
    ],
  },

  {
    id: 2,
    title: "Contains Duplicate",
    slug: "contains-duplicate",
    functionName: "containsDuplicate",
    difficulty: "Easy",
    topic: "Arrays",
    pattern: "hash set",
    sourceType: "core",
    description:
      "Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "true" },
      { input: "nums = [1,2,3,4]", output: "false" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    starterCode: {
      python: `class Solution:\n    def containsDuplicate(self, nums):\n        pass`,
      javascript: `function containsDuplicate(nums) {\n\n}`,
      typescript: `function containsDuplicate(nums: number[]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean containsDuplicate(int[] nums) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool containsDuplicate(vector<int>& nums) {\n        return false;\n    }\n};`,
      c: `bool containsDuplicate(int* nums, int numsSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { nums: [1, 2, 3, 1] }, expectedOutput: true },
      { input: { nums: [1, 2, 3, 4] }, expectedOutput: false },
      { input: { nums: [1, 1, 1, 3, 3, 4, 3, 2, 4, 2] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { nums: [1] }, expectedOutput: false },
      { input: { nums: [2, 2] }, expectedOutput: true },
    ],
  },

  {
    id: 3,
    title: "Best Time to Buy and Sell Stock",
    slug: "best-time-to-buy-and-sell-stock",
    functionName: "maxProfit",
    difficulty: "Easy",
    topic: "Arrays",
    pattern: "sliding window / greedy",
    sourceType: "core",
    description:
      "You are given an array prices where prices[i] is the price of a stock on day i. Maximize your profit by choosing a single day to buy and a different future day to sell. Return the maximum profit, or 0 if no profit is possible.",
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "5", explanation: "Buy day 2 (price=1), sell day 5 (price=6). Profit = 5." },
      { input: "prices = [7,6,4,3,1]", output: "0" },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def maxProfit(self, prices):\n        pass`,
      javascript: `function maxProfit(prices) {\n\n}`,
      typescript: `function maxProfit(prices: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxProfit(int[] prices) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        return 0;\n    }\n};`,
      c: `int maxProfit(int* prices, int pricesSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { prices: [7, 1, 5, 3, 6, 4] }, expectedOutput: 5 },
      { input: { prices: [7, 6, 4, 3, 1] }, expectedOutput: 0 },
      { input: { prices: [1, 2] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { prices: [2, 4, 1] }, expectedOutput: 2 },
      { input: { prices: [1, 1, 1] }, expectedOutput: 0 },
    ],
  },

  {
    id: 5,
    title: "Maximum Subarray",
    slug: "maximum-subarray",
    functionName: "maxSubArray",
    difficulty: "Easy",
    topic: "Arrays",
    pattern: "kadane's algorithm",
    sourceType: "core",
    description:
      "Given an integer array nums, find the contiguous subarray with the largest sum and return its sum. Hint: Kadane's algorithm solves this in O(n).",
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "[4,-1,2,1] has the largest sum." },
      { input: "nums = [1]", output: "1" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def maxSubArray(self, nums):\n        pass`,
      javascript: `function maxSubArray(nums) {\n\n}`,
      typescript: `function maxSubArray(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxSubArray(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxSubArray(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int maxSubArray(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] }, expectedOutput: 6 },
      { input: { nums: [1] }, expectedOutput: 1 },
      { input: { nums: [5, 4, -1, 7, 8] }, expectedOutput: 23 },
    ],
    hiddentestcases: [
      { input: { nums: [-1, -2, -3] }, expectedOutput: -1 },
      { input: { nums: [1, 2, 3, 4, 5] }, expectedOutput: 15 },
    ],
  },

  {
    id: 15,
    title: "Majority Element",
    slug: "majority-element",
    functionName: "majorityElement",
    difficulty: "Easy",
    topic: "Arrays",
    pattern: "boyer-moore voting",
    sourceType: "core",
    description:
      "Given an array nums of size n, return the majority element — the element that appears more than n/2 times. The majority element always exists. Try solving it in O(n) time and O(1) space using Boyer-Moore Voting Algorithm.",
    examples: [
      { input: "nums = [3,2,3]", output: "3" },
      { input: "nums = [2,2,1,1,1,2,2]", output: "2" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 5 * 10^4", "The majority element always exists."],
    starterCode: {
      python: `class Solution:\n    def majorityElement(self, nums):\n        pass`,
      javascript: `function majorityElement(nums) {\n\n}`,
      typescript: `function majorityElement(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int majorityElement(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int majorityElement(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int majorityElement(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [3, 2, 3] }, expectedOutput: 3 },
      { input: { nums: [2, 2, 1, 1, 1, 2, 2] }, expectedOutput: 2 },
      { input: { nums: [1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums: [6, 6, 6, 7, 5] }, expectedOutput: 6 },
      { input: { nums: [1, 1, 2, 1, 3, 1, 1] }, expectedOutput: 1 },
    ],
  },

  {
    id: 32,
    title: "Move Zeroes",
    slug: "move-zeroes",
    functionName: "moveZeroes",
    difficulty: "Easy",
    topic: "Arrays",
    pattern: "two pointers",
    sourceType: "core",
    description:
      "Given an integer array nums, move all 0s to the end while maintaining the relative order of the non-zero elements. Do this in-place and return the modified array.\n\nUse a slow pointer that tracks the next position for a non-zero element. Iterate with a fast pointer — whenever you find a non-zero, place it at the slow pointer position.",
    examples: [
      { input: "nums = [0,1,0,3,12]", output: "[1,3,12,0,0]" },
      { input: "nums = [0]", output: "[0]" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "-2^31 <= nums[i] <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def moveZeroes(self, nums):\n        pass`,
      javascript: `function moveZeroes(nums) {\n\n}`,
      typescript: `function moveZeroes(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] moveZeroes(int[] nums) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> moveZeroes(vector<int>& nums) {\n        return {};\n    }\n};`,
      c: `int* moveZeroes(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { nums: [0, 1, 0, 3, 12] }, expectedOutput: [1, 3, 12, 0, 0] },
      { input: { nums: [0] }, expectedOutput: [0] },
      { input: { nums: [1, 2, 3] }, expectedOutput: [1, 2, 3] },
    ],
    hiddentestcases: [
      { input: { nums: [0, 0, 1] }, expectedOutput: [1, 0, 0] },
      { input: { nums: [4, 2, 0, 1, 0, 5] }, expectedOutput: [4, 2, 1, 5, 0, 0] },
    ],
  },

  // ── STACKS ────────────────────────────────────────────────────────────────

  {
    id: 4,
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    functionName: "isValid",
    difficulty: "Easy",
    topic: "Stacks",
    pattern: "stack matching",
    sourceType: "core",
    description:
      "Given a string s containing only '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Open brackets must be closed by the same type of brackets in the correct order.",
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
    starterCode: {
      python: `class Solution:\n    def isValid(self, s):\n        pass`,
      javascript: `function isValid(s) {\n\n}`,
      typescript: `function isValid(s: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isValid(String s) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isValid(string s) {\n        return false;\n    }\n};`,
      c: `bool isValid(char* s) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "()" }, expectedOutput: true },
      { input: { s: "()[]{}" }, expectedOutput: true },
      { input: { s: "(]" }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { s: "([)]" }, expectedOutput: false },
      { input: { s: "{[]}" }, expectedOutput: true },
    ],
  },

  {
    id: 36,
    title: "Min Stack",
    slug: "min-stack",
    functionName: "minStack",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "auxiliary stack",
    sourceType: "core",
    description:
      "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.\n\nMaintain a second 'min stack' alongside the main stack. Every time you push a value, also push the current minimum. When you pop, pop both.\n\nYou'll receive an array of operations: ['push', val], ['pop'], ['top'], ['getMin']. Return an array of results for top and getMin calls.",
    examples: [
      { input: 'ops = [["push",5],["push",3],["push",7],["getMin"],["pop"],["getMin"]]', output: "[3,3]" },
      { input: 'ops = [["push",2],["push",0],["getMin"],["pop"],["getMin"]]', output: "[0,2]" },
    ],
    constraints: ["-2^31 <= val <= 2^31 - 1", "top and getMin are only called on non-empty stacks.", "At most 3 * 10^4 calls total."],
    starterCode: {
      python: `class Solution:\n    def minStack(self, ops):\n        # ops: list of ["push", val], ["pop"], ["top"], ["getMin"]\n        # return list of results for "top" and "getMin" calls\n        pass`,
      javascript: `function minStack(ops) {\n  // ops: array of ["push", val], ["pop"], ["top"], ["getMin"]\n  // return array of results for "top" and "getMin" calls\n}`,
      typescript: `function minStack(ops: string[][]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] minStack(String[][] ops) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> minStack(vector<vector<string>>& ops) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { ops: [["push", 5], ["push", 3], ["push", 7], ["getMin"], ["pop"], ["getMin"]] }, expectedOutput: [3, 3] },
      { input: { ops: [["push", 2], ["push", 0], ["getMin"], ["pop"], ["getMin"]] }, expectedOutput: [0, 2] },
      { input: { ops: [["push", 1], ["top"]] }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { ops: [["push", 10], ["push", 5], ["push", 15], ["getMin"], ["pop"], ["getMin"], ["top"]] }, expectedOutput: [5, 5, 10] },
    ],
  },

  {
    id: 37,
    title: "Daily Temperatures",
    slug: "daily-temperatures",
    functionName: "dailyTemperatures",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "monotonic stack",
    sourceType: "core",
    description:
      "Given an array of daily temperatures, return an array where each element is the number of days you have to wait until a warmer temperature. If no future warmer day exists, put 0.\n\nUse a monotonic decreasing stack of indices. When you find a temperature warmer than the stack top, pop and record the difference in indices.",
    examples: [
      { input: "temperatures = [73,74,75,71,69,72,76,73]", output: "[1,1,4,2,1,1,0,0]" },
      { input: "temperatures = [30,40,50,60]", output: "[1,1,1,0]" },
    ],
    constraints: ["1 <= temperatures.length <= 10^5", "30 <= temperatures[i] <= 100"],
    starterCode: {
      python: `class Solution:\n    def dailyTemperatures(self, temperatures):\n        pass`,
      javascript: `function dailyTemperatures(temperatures) {\n\n}`,
      typescript: `function dailyTemperatures(temperatures: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] dailyTemperatures(int[] temperatures) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> dailyTemperatures(vector<int>& temperatures) {\n        return {};\n    }\n};`,
      c: `int* dailyTemperatures(int* temperatures, int temperaturesSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { temperatures: [73, 74, 75, 71, 69, 72, 76, 73] }, expectedOutput: [1, 1, 4, 2, 1, 1, 0, 0] },
      { input: { temperatures: [30, 40, 50, 60] }, expectedOutput: [1, 1, 1, 0] },
      { input: { temperatures: [30, 60, 90] }, expectedOutput: [1, 1, 0] },
    ],
    hiddentestcases: [
      { input: { temperatures: [89, 62, 70, 58, 47, 47, 46, 76, 100, 70] }, expectedOutput: [8, 1, 5, 4, 3, 2, 1, 1, 0, 0] },
    ],
  },

  // ── LINKED LIST ───────────────────────────────────────────────────────────

  {
    id: 22,
    title: "Reverse Linked List",
    slug: "reverse-linked-list",
    functionName: "reverseList",
    difficulty: "Easy",
    topic: "Linked List",
    pattern: "iteration / recursion",
    sourceType: "core",
    description:
      "Given the head of a singly linked list represented as an array, reverse the list and return the reversed array.\n\nFocus on the pointer-reversal logic: maintain prev, curr, and next pointers. At each step, reverse the direction of the pointer, then advance all three.",
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]" },
      { input: "head = [1,2]", output: "[2,1]" },
      { input: "head = []", output: "[]" },
    ],
    constraints: ["0 <= number of nodes <= 5000", "-5000 <= Node.val <= 5000"],
    starterCode: {
      python: `class Solution:\n    def reverseList(self, head):\n        pass`,
      javascript: `function reverseList(head) {\n\n}`,
      typescript: `function reverseList(head: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] reverseList(int[] head) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> reverseList(vector<int>& head) {\n        return {};\n    }\n};`,
      c: `int* reverseList(int* head, int headSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { head: [1, 2, 3, 4, 5] }, expectedOutput: [5, 4, 3, 2, 1] },
      { input: { head: [1, 2] }, expectedOutput: [2, 1] },
      { input: { head: [] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { head: [1] }, expectedOutput: [1] },
      { input: { head: [3, 1, 4, 1, 5, 9, 2, 6] }, expectedOutput: [6, 2, 9, 5, 1, 4, 1, 3] },
    ],
  },

  {
    id: 23,
    title: "Merge Two Sorted Lists",
    slug: "merge-two-sorted-lists",
    functionName: "mergeTwoLists",
    difficulty: "Easy",
    topic: "Linked List",
    pattern: "two pointers",
    sourceType: "core",
    description:
      "You are given the heads of two sorted linked lists as sorted arrays list1 and list2. Merge the two lists into one sorted list and return it.\n\nThis is the classic merge step of merge sort. Use two pointers and always pick the smaller value.",
    examples: [
      { input: "list1 = [1,2,4], list2 = [1,3,4]", output: "[1,1,2,3,4,4]" },
      { input: "list1 = [], list2 = []", output: "[]" },
      { input: "list1 = [], list2 = [0]", output: "[0]" },
    ],
    constraints: ["0 <= number of nodes in each list <= 50", "-100 <= Node.val <= 100", "Both lists are sorted in non-decreasing order."],
    starterCode: {
      python: `class Solution:\n    def mergeTwoLists(self, list1, list2):\n        pass`,
      javascript: `function mergeTwoLists(list1, list2) {\n\n}`,
      typescript: `function mergeTwoLists(list1: number[], list2: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] mergeTwoLists(int[] list1, int[] list2) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> mergeTwoLists(vector<int>& list1, vector<int>& list2) {\n        return {};\n    }\n};`,
      c: `int* mergeTwoLists(int* list1, int list1Size, int* list2, int list2Size, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { list1: [1, 2, 4], list2: [1, 3, 4] }, expectedOutput: [1, 1, 2, 3, 4, 4] },
      { input: { list1: [], list2: [] }, expectedOutput: [] },
      { input: { list1: [], list2: [0] }, expectedOutput: [0] },
    ],
    hiddentestcases: [
      { input: { list1: [1], list2: [2] }, expectedOutput: [1, 2] },
      { input: { list1: [1, 3, 5, 7], list2: [2, 4, 6, 8] }, expectedOutput: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
  },

  {
    id: 24,
    title: "Middle of the Linked List",
    slug: "middle-of-the-linked-list",
    functionName: "middleNode",
    difficulty: "Easy",
    topic: "Linked List",
    pattern: "fast / slow pointer",
    sourceType: "core",
    description:
      "Given an array representing a linked list, return the value at the middle node. If there are two middle nodes, return the second middle.\n\nThe classic approach: fast pointer moves 2 steps, slow pointer moves 1 step. When fast reaches the end, slow is at the middle.",
    examples: [
      { input: "head = [1,2,3,4,5]", output: "3", explanation: "Middle of [1,2,3,4,5] is 3." },
      { input: "head = [1,2,3,4,5,6]", output: "4", explanation: "Two middles are 3 and 4 — return the second." },
    ],
    constraints: ["1 <= number of nodes <= 100", "1 <= Node.val <= 100"],
    starterCode: {
      python: `class Solution:\n    def middleNode(self, head):\n        pass`,
      javascript: `function middleNode(head) {\n\n}`,
      typescript: `function middleNode(head: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int middleNode(int[] head) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int middleNode(vector<int>& head) {\n        return 0;\n    }\n};`,
      c: `int middleNode(int* head, int headSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { head: [1, 2, 3, 4, 5] }, expectedOutput: 3 },
      { input: { head: [1, 2, 3, 4, 5, 6] }, expectedOutput: 4 },
      { input: { head: [1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { head: [1, 2] }, expectedOutput: 2 },
      { input: { head: [10, 20, 30, 40] }, expectedOutput: 30 },
    ],
  },

  {
    id: 25,
    title: "Remove Nth Node From End",
    slug: "remove-nth-node-from-end",
    functionName: "removeNthFromEnd",
    difficulty: "Medium",
    topic: "Linked List",
    pattern: "fast / slow pointer",
    sourceType: "core",
    description:
      "Given an array representing a linked list and an integer n, remove the nth node from the end of the list and return the modified list.\n\nAdvance one pointer n steps ahead, then move both pointers together. When the fast pointer hits the end, the slow pointer is right before the node to remove.",
    examples: [
      { input: "head = [1,2,3,4,5], n = 2", output: "[1,2,3,5]" },
      { input: "head = [1], n = 1", output: "[]" },
      { input: "head = [1,2], n = 1", output: "[1]" },
    ],
    constraints: ["1 <= number of nodes <= 30", "0 <= Node.val <= 100", "1 <= n <= number of nodes"],
    starterCode: {
      python: `class Solution:\n    def removeNthFromEnd(self, head, n):\n        pass`,
      javascript: `function removeNthFromEnd(head, n) {\n\n}`,
      typescript: `function removeNthFromEnd(head: number[], n: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] removeNthFromEnd(int[] head, int n) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> removeNthFromEnd(vector<int>& head, int n) {\n        return {};\n    }\n};`,
      c: `int* removeNthFromEnd(int* head, int headSize, int n, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { head: [1, 2, 3, 4, 5], n: 2 }, expectedOutput: [1, 2, 3, 5] },
      { input: { head: [1], n: 1 }, expectedOutput: [] },
      { input: { head: [1, 2], n: 1 }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { head: [1, 2], n: 2 }, expectedOutput: [2] },
      { input: { head: [1, 2, 3, 4, 5], n: 5 }, expectedOutput: [2, 3, 4, 5] },
    ],
  },

  // ── TWO POINTERS ──────────────────────────────────────────────────────────

  {
    id: 11,
    title: "Container With Most Water",
    slug: "container-with-most-water",
    functionName: "maxArea",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "two pointers",
    sourceType: "core",
    description:
      "Given an integer array height of length n, find two lines that together with the x-axis form a container holding the most water. Return the maximum water volume. The two-pointer approach gives O(n) time.",
    examples: [
      { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49" },
      { input: "height = [1,1]", output: "1" },
    ],
    constraints: ["n == height.length", "2 <= n <= 10^5", "0 <= height[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def maxArea(self, height):\n        pass`,
      javascript: `function maxArea(height) {\n\n}`,
      typescript: `function maxArea(height: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxArea(int[] height) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxArea(vector<int>& height) {\n        return 0;\n    }\n};`,
      c: `int maxArea(int* height, int heightSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] }, expectedOutput: 49 },
      { input: { height: [1, 1] }, expectedOutput: 1 },
      { input: { height: [4, 3, 2, 1, 4] }, expectedOutput: 16 },
    ],
    hiddentestcases: [
      { input: { height: [1, 2, 1] }, expectedOutput: 2 },
      { input: { height: [2, 3, 4, 5, 18, 17, 6] }, expectedOutput: 17 },
    ],
  },

  {
    id: 17,
    title: "Trapping Rain Water",
    slug: "trapping-rain-water",
    functionName: "trap",
    difficulty: "Hard",
    topic: "Two Pointers",
    pattern: "two pointers",
    sourceType: "core",
    description:
      "Given n non-negative integers representing an elevation map where each bar has width 1, compute how much water it can trap after raining. Classic two-pointer or stack problem.",
    examples: [
      { input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", output: "6" },
      { input: "height = [4,2,0,3,2,5]", output: "9" },
    ],
    constraints: ["n == height.length", "1 <= n <= 2 * 10^4", "0 <= height[i] <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def trap(self, height):\n        pass`,
      javascript: `function trap(height) {\n\n}`,
      typescript: `function trap(height: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int trap(int[] height) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int trap(vector<int>& height) {\n        return 0;\n    }\n};`,
      c: `int trap(int* height, int heightSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1] }, expectedOutput: 6 },
      { input: { height: [4, 2, 0, 3, 2, 5] }, expectedOutput: 9 },
      { input: { height: [3, 0, 2, 0, 4] }, expectedOutput: 7 },
    ],
    hiddentestcases: [
      { input: { height: [1, 0, 1] }, expectedOutput: 1 },
      { input: { height: [5, 4, 1, 2] }, expectedOutput: 1 },
    ],
  },

  {
    id: 31,
    title: "Two Sum II — Input Array Is Sorted",
    slug: "two-sum-ii-sorted",
    functionName: "twoSumSorted",
    difficulty: "Easy",
    topic: "Two Pointers",
    pattern: "two pointers",
    sourceType: "variant",
    description:
      "Given a 1-indexed sorted array of integers and a target, return the 1-indexed positions [index1, index2] of the two numbers that add up to target.\n\nBecause the array is sorted, use two pointers from both ends. If the sum is too large, move right pointer left. If too small, move left pointer right.",
    examples: [
      { input: "numbers = [2,7,11,15], target = 9", output: "[1,2]" },
      { input: "numbers = [2,3,4], target = 6", output: "[1,3]" },
      { input: "numbers = [-1,0], target = -1", output: "[1,2]" },
    ],
    constraints: ["2 <= numbers.length <= 3 * 10^4", "-1000 <= numbers[i] <= 1000", "numbers is sorted in non-decreasing order.", "Exactly one solution exists.", "Use O(1) extra space."],
    starterCode: {
      python: `class Solution:\n    def twoSumSorted(self, numbers, target):\n        pass`,
      javascript: `function twoSumSorted(numbers, target) {\n\n}`,
      typescript: `function twoSumSorted(numbers: number[], target: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] twoSumSorted(int[] numbers, int target) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> twoSumSorted(vector<int>& numbers, int target) {\n        return {};\n    }\n};`,
      c: `int* twoSumSorted(int* numbers, int numbersSize, int target, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { numbers: [2, 7, 11, 15], target: 9 }, expectedOutput: [1, 2] },
      { input: { numbers: [2, 3, 4], target: 6 }, expectedOutput: [1, 3] },
      { input: { numbers: [-1, 0], target: -1 }, expectedOutput: [1, 2] },
    ],
    hiddentestcases: [
      { input: { numbers: [1, 2, 3, 4, 5], target: 9 }, expectedOutput: [4, 5] },
      { input: { numbers: [5, 25, 75], target: 100 }, expectedOutput: [2, 3] },
    ],
  },

  {
    id: 33,
    title: "3Sum",
    slug: "three-sum",
    functionName: "threeSum",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "sort + two pointers",
    sourceType: "core",
    description:
      "Given an integer array nums, return the count of unique triplets that sum to zero.\n\nSort the array first. For each element nums[i], use two pointers on the remaining subarray. Skip duplicates to avoid counting the same triplet twice.",
    examples: [
      { input: "nums = [-1,0,1,2,-1,-4]", output: "2", explanation: "Triplets [-1,-1,2] and [-1,0,1] sum to zero." },
      { input: "nums = [0,1,1]", output: "0" },
      { input: "nums = [0,0,0]", output: "1" },
    ],
    constraints: ["3 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def threeSum(self, nums):\n        # return the count of unique triplets summing to 0\n        pass`,
      javascript: `function threeSum(nums) {\n  // return the count of unique triplets summing to 0\n}`,
      typescript: `function threeSum(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int threeSum(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int threeSum(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int threeSum(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [-1, 0, 1, 2, -1, -4] }, expectedOutput: 2 },
      { input: { nums: [0, 1, 1] }, expectedOutput: 0 },
      { input: { nums: [0, 0, 0] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums: [-2, 0, 1, 1, 2] }, expectedOutput: 2 },
      { input: { nums: [1, 2, -2, -1] }, expectedOutput: 0 },
    ],
  },

  // ── SLIDING WINDOW ────────────────────────────────────────────────────────

  {
    id: 9,
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    functionName: "lengthOfLongestSubstring",
    difficulty: "Medium",
    topic: "Sliding Window",
    pattern: "sliding window",
    sourceType: "core",
    description:
      "Given a string s, find the length of the longest substring without repeating characters. Use the sliding window technique for an O(n) solution.",
    examples: [
      { input: 's = "abcabcbb"', output: "3", explanation: 'Longest substring is "abc".' },
      { input: 's = "bbbbb"', output: "1" },
      { input: 's = "pwwkew"', output: "3", explanation: '"wke" has length 3.' },
    ],
    constraints: ["0 <= s.length <= 5 * 10^4"],
    starterCode: {
      python: `class Solution:\n    def lengthOfLongestSubstring(self, s):\n        pass`,
      javascript: `function lengthOfLongestSubstring(s) {\n\n}`,
      typescript: `function lengthOfLongestSubstring(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        return 0;\n    }\n};`,
      c: `int lengthOfLongestSubstring(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "abcabcbb" }, expectedOutput: 3 },
      { input: { s: "bbbbb" }, expectedOutput: 1 },
      { input: { s: "pwwkew" }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { s: "" }, expectedOutput: 0 },
      { input: { s: "dvdf" }, expectedOutput: 3 },
    ],
  },

  {
    id: 34,
    title: "Minimum Size Subarray Sum",
    slug: "minimum-size-subarray-sum",
    functionName: "minSubArrayLen",
    difficulty: "Medium",
    topic: "Sliding Window",
    pattern: "sliding window",
    sourceType: "core",
    description:
      "Given a target integer and an array of positive integers nums, return the minimal length of a contiguous subarray whose sum is >= target. If no such subarray exists, return 0.\n\nExpand the window by moving right. When the window sum meets the target, shrink from the left and record the minimum length.",
    examples: [
      { input: "target = 7, nums = [2,3,1,2,4,3]", output: "2", explanation: "Subarray [4,3] has sum >= 7." },
      { input: "target = 4, nums = [1,4,4]", output: "1" },
      { input: "target = 11, nums = [1,1,1,1,1,1,1,1]", output: "0" },
    ],
    constraints: ["1 <= target <= 10^9", "1 <= nums.length <= 10^5", "1 <= nums[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def minSubArrayLen(self, target, nums):\n        pass`,
      javascript: `function minSubArrayLen(target, nums) {\n\n}`,
      typescript: `function minSubArrayLen(target: number, nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int minSubArrayLen(int target, int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int minSubArrayLen(int target, vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int minSubArrayLen(int target, int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { target: 7, nums: [2, 3, 1, 2, 4, 3] }, expectedOutput: 2 },
      { input: { target: 4, nums: [1, 4, 4] }, expectedOutput: 1 },
      { input: { target: 11, nums: [1, 1, 1, 1, 1, 1, 1, 1] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { target: 15, nums: [1, 2, 3, 4, 5] }, expectedOutput: 5 },
      { input: { target: 6, nums: [10, 2, 3] }, expectedOutput: 1 },
    ],
  },

  {
    id: 35,
    title: "Maximum Average Subarray",
    slug: "maximum-average-subarray",
    functionName: "findMaxAverage",
    difficulty: "Easy",
    topic: "Sliding Window",
    pattern: "fixed-size sliding window",
    sourceType: "variant",
    description:
      "Given an integer array nums and an integer k, find the contiguous subarray of length k with the maximum average value and return that maximum average.\n\nCompute the sum of the first k elements, then slide the window by adding the next element and removing the first.",
    examples: [
      { input: "nums = [1,12,-5,-6,50,3], k = 4", output: "12.75", explanation: "Max average subarray is [12,-5,-6,50] = 51/4 = 12.75." },
      { input: "nums = [5], k = 1", output: "5.0" },
    ],
    constraints: ["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def findMaxAverage(self, nums, k):\n        pass`,
      javascript: `function findMaxAverage(nums, k) {\n\n}`,
      typescript: `function findMaxAverage(nums: number[], k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public double findMaxAverage(int[] nums, int k) {\n        return 0.0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    double findMaxAverage(vector<int>& nums, int k) {\n        return 0.0;\n    }\n};`,
      c: `double findMaxAverage(int* nums, int numsSize, int k) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1, 12, -5, -6, 50, 3], k: 4 }, expectedOutput: 12.75 },
      { input: { nums: [5], k: 1 }, expectedOutput: 5.0 },
      { input: { nums: [0, 1, 1, 3, 3], k: 4 }, expectedOutput: 2.0 },
    ],
    hiddentestcases: [
      { input: { nums: [3, 3, 3, 3, 3], k: 3 }, expectedOutput: 3.0 },
      { input: { nums: [-1, -12, -5], k: 2 }, expectedOutput: -6.5 },
    ],
  },

  // ── BINARY SEARCH ─────────────────────────────────────────────────────────

  {
    id: 38,
    title: "Binary Search",
    slug: "binary-search",
    functionName: "search",
    difficulty: "Easy",
    topic: "Binary Search",
    pattern: "binary search",
    sourceType: "core",
    description:
      "Given a sorted array of integers and a target value, return the index of the target. If not found, return -1. Your algorithm must run in O(log n) time.\n\nMaintain left and right pointers. Check the midpoint each step — if it equals the target, return mid. If target is less, search left half. Otherwise search right half.",
    examples: [
      { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
      { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "-10^4 < nums[i], target < 10^4", "All integers in nums are unique.", "nums is sorted in ascending order."],
    starterCode: {
      python: `class Solution:\n    def search(self, nums, target):\n        pass`,
      javascript: `function search(nums, target) {\n\n}`,
      typescript: `function search(nums: number[], target: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int search(int[] nums, int target) {\n        return -1;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        return -1;\n    }\n};`,
      c: `int search(int* nums, int numsSize, int target) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [-1, 0, 3, 5, 9, 12], target: 9 }, expectedOutput: 4 },
      { input: { nums: [-1, 0, 3, 5, 9, 12], target: 2 }, expectedOutput: -1 },
      { input: { nums: [5], target: 5 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [1, 3, 5, 7, 9, 11], target: 7 }, expectedOutput: 3 },
      { input: { nums: [2, 4, 6, 8, 10], target: 1 }, expectedOutput: -1 },
    ],
  },

  {
    id: 14,
    title: "Find Minimum in Rotated Sorted Array",
    slug: "find-minimum-in-rotated-sorted-array",
    functionName: "findMin",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search",
    sourceType: "core",
    description:
      "A sorted array of unique integers was rotated between 1 and n times. Given the rotated array nums, return the minimum element. Your solution must run in O(log n) time.",
    examples: [
      { input: "nums = [3,4,5,1,2]", output: "1" },
      { input: "nums = [4,5,6,7,0,1,2]", output: "0" },
      { input: "nums = [11,13,15,17]", output: "11" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 5000", "All integers are unique."],
    starterCode: {
      python: `class Solution:\n    def findMin(self, nums):\n        pass`,
      javascript: `function findMin(nums) {\n\n}`,
      typescript: `function findMin(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findMin(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findMin(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int findMin(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [3, 4, 5, 1, 2] }, expectedOutput: 1 },
      { input: { nums: [4, 5, 6, 7, 0, 1, 2] }, expectedOutput: 0 },
      { input: { nums: [11, 13, 15, 17] }, expectedOutput: 11 },
    ],
    hiddentestcases: [
      { input: { nums: [2, 1] }, expectedOutput: 1 },
      { input: { nums: [3, 1, 2] }, expectedOutput: 1 },
    ],
  },

  {
    id: 39,
    title: "Search in Rotated Sorted Array",
    slug: "search-in-rotated-sorted-array",
    functionName: "searchRotated",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search",
    sourceType: "core",
    description:
      "A sorted array was rotated at an unknown pivot. Given the rotated array and a target, return the index of the target or -1 if not found. Must run in O(log n).\n\nAt each binary search step, one half is always sorted. Determine which half the target falls in.",
    examples: [
      { input: "nums = [4,5,6,7,0,1,2], target = 0", output: "4" },
      { input: "nums = [4,5,6,7,0,1,2], target = 3", output: "-1" },
      { input: "nums = [1], target = 0", output: "-1" },
    ],
    constraints: ["1 <= nums.length <= 5000", "-10^4 <= nums[i] <= 10^4", "All values are unique.", "nums is sorted and rotated between 1 and n times."],
    starterCode: {
      python: `class Solution:\n    def searchRotated(self, nums, target):\n        pass`,
      javascript: `function searchRotated(nums, target) {\n\n}`,
      typescript: `function searchRotated(nums: number[], target: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int searchRotated(int[] nums, int target) {\n        return -1;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int searchRotated(vector<int>& nums, int target) {\n        return -1;\n    }\n};`,
      c: `int searchRotated(int* nums, int numsSize, int target) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [4, 5, 6, 7, 0, 1, 2], target: 0 }, expectedOutput: 4 },
      { input: { nums: [4, 5, 6, 7, 0, 1, 2], target: 3 }, expectedOutput: -1 },
      { input: { nums: [1], target: 0 }, expectedOutput: -1 },
    ],
    hiddentestcases: [
      { input: { nums: [3, 1], target: 1 }, expectedOutput: 1 },
      { input: { nums: [5, 1, 3], target: 5 }, expectedOutput: 0 },
    ],
  },

  // ── HASH MAPS ─────────────────────────────────────────────────────────────

  {
    id: 10,
    title: "Valid Anagram",
    slug: "valid-anagram",
    functionName: "isAnagram",
    difficulty: "Easy",
    topic: "Hash Maps",
    pattern: "frequency count",
    sourceType: "core",
    description:
      "Given two strings s and t, return true if t is an anagram of s, and false otherwise. An anagram uses all original letters exactly once in a different arrangement.",
    examples: [
      { input: 's = "anagram", t = "nagaram"', output: "true" },
      { input: 's = "rat", t = "car"', output: "false" },
    ],
    constraints: ["1 <= s.length, t.length <= 5 * 10^4", "s and t consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def isAnagram(self, s, t):\n        pass`,
      javascript: `function isAnagram(s, t) {\n\n}`,
      typescript: `function isAnagram(s: string, t: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isAnagram(String s, String t) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isAnagram(string s, string t) {\n        return false;\n    }\n};`,
      c: `bool isAnagram(char* s, char* t) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "anagram", t: "nagaram" }, expectedOutput: true },
      { input: { s: "rat", t: "car" }, expectedOutput: false },
      { input: { s: "ab", t: "a" }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { s: "listen", t: "silent" }, expectedOutput: true },
      { input: { s: "hello", t: "world" }, expectedOutput: false },
    ],
  },

  {
    id: 21,
    title: "Group Anagrams",
    slug: "group-anagrams",
    functionName: "groupAnagrams",
    difficulty: "Medium",
    topic: "Hash Maps",
    pattern: "frequency count",
    sourceType: "core",
    description:
      "Given an array of strings strs, group the anagrams together and return the number of groups.\n\nTwo strings are anagrams if they contain the same characters in the same frequency. Use a sorted version of each string (or a frequency tuple) as a hash map key. Each unique key is one anagram group.",
    examples: [
      { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', output: "3", explanation: 'Three groups: ["eat","tea","ate"], ["tan","nat"], ["bat"].' },
      { input: 'strs = [""]', output: "1" },
      { input: 'strs = ["a"]', output: "1" },
    ],
    constraints: ["1 <= strs.length <= 10^4", "0 <= strs[i].length <= 100", "strs[i] consists of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def groupAnagrams(self, strs):\n        # return the number of anagram groups\n        pass`,
      javascript: `function groupAnagrams(strs) {\n  // return the number of anagram groups\n}`,
      typescript: `function groupAnagrams(strs: string[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int groupAnagrams(String[] strs) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int groupAnagrams(vector<string>& strs) {\n        return 0;\n    }\n};`,
      c: `int groupAnagrams(char** strs, int strsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] }, expectedOutput: 3 },
      { input: { strs: [""] }, expectedOutput: 1 },
      { input: { strs: ["a"] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { strs: ["abc", "bca", "cab", "xyz"] }, expectedOutput: 2 },
      { input: { strs: ["a", "b", "c"] }, expectedOutput: 3 },
    ],
  },

  // ── HASHING ───────────────────────────────────────────────────────────────

  {
    id: 49,
    title: "Longest Consecutive Sequence",
    slug: "longest-consecutive-sequence",
    functionName: "longestConsecutive",
    difficulty: "Medium",
    topic: "Hashing",
    pattern: "hash set",
    sourceType: "core",
    description:
      "Given an unsorted array of integers, return the length of the longest consecutive elements sequence. Must run in O(n) time.\n\nAdd all numbers to a hash set. For each number, only start counting if it's the beginning of a sequence (num - 1 is NOT in the set). Then count upward.",
    examples: [
      { input: "nums = [100,4,200,1,3,2]", output: "4", explanation: "Longest consecutive sequence is [1,2,3,4]." },
      { input: "nums = [0,3,7,2,5,8,4,6,0,1]", output: "9" },
    ],
    constraints: ["0 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
    starterCode: {
      python: `class Solution:\n    def longestConsecutive(self, nums):\n        pass`,
      javascript: `function longestConsecutive(nums) {\n\n}`,
      typescript: `function longestConsecutive(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int longestConsecutive(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int longestConsecutive(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int longestConsecutive(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [100, 4, 200, 1, 3, 2] }, expectedOutput: 4 },
      { input: { nums: [0, 3, 7, 2, 5, 8, 4, 6, 0, 1] }, expectedOutput: 9 },
      { input: { nums: [] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [1, 2, 3, 4, 5] }, expectedOutput: 5 },
      { input: { nums: [9, 1, 4, 7, 3, -1, 0, 5, 8, -1, 6] }, expectedOutput: 7 },
    ],
  },

  {
    id: 50,
    title: "Two Sum — Count Pairs",
    slug: "two-sum-count-pairs",
    functionName: "countPairs",
    difficulty: "Easy",
    topic: "Hashing",
    pattern: "hash map complement",
    sourceType: "original",
    description:
      "Given an array of integers nums and a target, return the number of unique index pairs (i, j) where i < j and nums[i] + nums[j] == target.\n\nThis is a Code Club original. Instead of returning the first pair, count all of them. Use a hash map tracking counts of seen values — for each number, check if (target - number) has been seen and add its count to the result.",
    examples: [
      { input: "nums = [1,5,3,3,3], target = 6", output: "4", explanation: "Pairs at indices (0,1), (2,3), (2,4), (3,4)." },
      { input: "nums = [1,2,3,4,5], target = 6", output: "2" },
      { input: "nums = [1,1,1], target = 2", output: "3" },
    ],
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
    ],
    // The pair count can reach 100000 * 99999 / 2 = 4,999,950,000, which
    // overflows a 32-bit int — the statically-typed languages must return a
    // 64-bit type. See backend/utils/generateDriverCode.js, which reads this
    // field instead of guessing the type from the user's submitted code.
    returnType: { java: "long", cpp: "long long", c: "long long" },
    starterCode: {
      python: `class Solution:\n    def countPairs(self, nums, target):\n        pass`,
      javascript: `function countPairs(nums, target) {\n\n}`,
      typescript: `function countPairs(nums: number[], target: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public long countPairs(int[] nums, int target) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    long long countPairs(vector<int>& nums, int target) {\n        return 0;\n    }\n};`,
      c: `long long countPairs(int* nums, int numsSize, int target) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1, 5, 3, 3, 3], target: 6 }, expectedOutput: 4 },
      { input: { nums: [1, 2, 3, 4, 5], target: 6 }, expectedOutput: 2 },
      { input: { nums: [1, 1, 1], target: 2 }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { nums: [0, 0, 0, 0], target: 0 }, expectedOutput: 6 },
      { input: { nums: [5, 5, 5, 5, 5], target: 10 }, expectedOutput: 10 },
      // Overflow regression: 100000 choose 2 pairs, all summing to target.
      // 100000 * 99999 / 2 = 4,999,950,000 > Integer.MAX_VALUE (2,147,483,647).
      { input: { nums: Array(100000).fill(1), target: 2 }, expectedOutput: 4999950000 },
    ],
  },

  // ── STRINGS ───────────────────────────────────────────────────────────────

  {
    id: 16,
    title: "Longest Common Prefix",
    slug: "longest-common-prefix",
    functionName: "longestCommonPrefix",
    difficulty: "Easy",
    topic: "Strings",
    pattern: "vertical scanning",
    sourceType: "core",
    description:
      "Write a function to find the longest common prefix string amongst an array of strings. If there is no common prefix, return an empty string.",
    examples: [
      { input: 'strs = ["flower","flow","flight"]', output: '"fl"' },
      { input: 'strs = ["dog","racecar","car"]', output: '""', explanation: "No common prefix." },
    ],
    constraints: ["1 <= strs.length <= 200", "0 <= strs[i].length <= 200"],
    starterCode: {
      python: `class Solution:\n    def longestCommonPrefix(self, strs):\n        pass`,
      javascript: `function longestCommonPrefix(strs) {\n\n}`,
      typescript: `function longestCommonPrefix(strs: string[]): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String longestCommonPrefix(String[] strs) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string longestCommonPrefix(vector<string>& strs) {\n        return "";\n    }\n};`,
      c: `char* longestCommonPrefix(char** strs, int strsSize) {\n    return "";\n}`,
    },
    testcases: [
      { input: { strs: ["flower", "flow", "flight"] }, expectedOutput: "fl" },
      { input: { strs: ["dog", "racecar", "car"] }, expectedOutput: "" },
      { input: { strs: ["interview", "inter", "interest"] }, expectedOutput: "inter" },
    ],
    hiddentestcases: [
      { input: { strs: ["a"] }, expectedOutput: "a" },
      { input: { strs: ["abc", "abc", "abc"] }, expectedOutput: "abc" },
    ],
  },

  {
    id: 47,
    title: "Reverse String",
    slug: "reverse-string",
    functionName: "reverseString",
    difficulty: "Easy",
    topic: "Strings",
    pattern: "two pointers",
    sourceType: "core",
    description:
      "Given a string s, reverse it and return the reversed string. Do it with O(1) extra memory — use two pointers, one from each end, and swap until they meet.",
    examples: [
      { input: 's = "hello"', output: '"olleh"' },
      { input: 's = "Hannah"', output: '"hannaH"' },
    ],
    constraints: ["1 <= s.length <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def reverseString(self, s):\n        pass`,
      javascript: `function reverseString(s) {\n\n}`,
      typescript: `function reverseString(s: string): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String reverseString(String s) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string reverseString(string s) {\n        return "";\n    }\n};`,
      c: `char* reverseString(char* s) {\n    return "";\n}`,
    },
    testcases: [
      { input: { s: "hello" }, expectedOutput: "olleh" },
      { input: { s: "Hannah" }, expectedOutput: "hannaH" },
      { input: { s: "a" }, expectedOutput: "a" },
    ],
    hiddentestcases: [
      { input: { s: "abcde" }, expectedOutput: "edcba" },
      { input: { s: "racecar" }, expectedOutput: "racecar" },
    ],
  },

  {
    id: 48,
    title: "Is Palindrome",
    slug: "is-palindrome",
    functionName: "isPalindrome",
    difficulty: "Easy",
    topic: "Strings",
    pattern: "two pointers",
    sourceType: "original",
    description:
      "A phrase is a palindrome if, after converting all uppercase letters to lowercase and removing all non-alphanumeric characters, it reads the same forward and backward.\n\nGiven a string s, return true if it is a palindrome. Use two pointers — skip non-alphanumeric characters and compare from both ends.",
    examples: [
      { input: 's = "A man, a plan, a canal: Panama"', output: "true" },
      { input: 's = "race a car"', output: "false" },
      { input: 's = " "', output: "true" },
    ],
    constraints: ["1 <= s.length <= 2 * 10^5"],
    starterCode: {
      python: `class Solution:\n    def isPalindrome(self, s):\n        pass`,
      javascript: `function isPalindrome(s) {\n\n}`,
      typescript: `function isPalindrome(s: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isPalindrome(String s) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isPalindrome(string s) {\n        return false;\n    }\n};`,
      c: `bool isPalindrome(char* s) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "A man, a plan, a canal: Panama" }, expectedOutput: true },
      { input: { s: "race a car" }, expectedOutput: false },
      { input: { s: " " }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { s: "Was it a car or a cat I saw?" }, expectedOutput: true },
      { input: { s: "hello" }, expectedOutput: false },
    ],
  },

  // ── DYNAMIC PROGRAMMING ───────────────────────────────────────────────────

  {
    id: 6,
    title: "Climbing Stairs",
    slug: "climbing-stairs",
    functionName: "climbStairs",
    difficulty: "Easy",
    topic: "Dynamic Programming",
    pattern: "1d dp / fibonacci",
    sourceType: "core",
    description:
      "You are climbing a staircase that takes n steps to reach the top. Each time you can climb 1 or 2 steps. In how many distinct ways can you reach the top?",
    examples: [
      { input: "n = 2", output: "2", explanation: "Two ways: (1+1) or (2)." },
      { input: "n = 3", output: "3", explanation: "Three ways: (1+1+1), (1+2), (2+1)." },
    ],
    constraints: ["1 <= n <= 45"],
    starterCode: {
      python: `class Solution:\n    def climbStairs(self, n):\n        pass`,
      javascript: `function climbStairs(n) {\n\n}`,
      typescript: `function climbStairs(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int climbStairs(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int climbStairs(int n) {\n        return 0;\n    }\n};`,
      c: `int climbStairs(int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { n: 2 }, expectedOutput: 2 },
      { input: { n: 3 }, expectedOutput: 3 },
      { input: { n: 5 }, expectedOutput: 8 },
    ],
    hiddentestcases: [
      { input: { n: 1 }, expectedOutput: 1 },
      { input: { n: 10 }, expectedOutput: 89 },
    ],
  },

  {
    id: 8,
    title: "Fibonacci Number",
    slug: "fibonacci-number",
    functionName: "fib",
    difficulty: "Easy",
    topic: "Dynamic Programming",
    pattern: "1d dp / memoization",
    sourceType: "core",
    description:
      "The Fibonacci sequence: F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2). Given n, calculate F(n). Try both recursive and iterative approaches.",
    examples: [
      { input: "n = 2", output: "1", explanation: "F(2) = F(1) + F(0) = 1." },
      { input: "n = 3", output: "2" },
      { input: "n = 4", output: "3" },
    ],
    constraints: ["0 <= n <= 30"],
    starterCode: {
      python: `class Solution:\n    def fib(self, n):\n        pass`,
      javascript: `function fib(n) {\n\n}`,
      typescript: `function fib(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int fib(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int fib(int n) {\n        return 0;\n    }\n};`,
      c: `int fib(int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { n: 2 }, expectedOutput: 1 },
      { input: { n: 3 }, expectedOutput: 2 },
      { input: { n: 4 }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { n: 0 }, expectedOutput: 0 },
      { input: { n: 10 }, expectedOutput: 55 },
    ],
  },

  {
    id: 12,
    title: "House Robber",
    slug: "house-robber",
    functionName: "rob",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "1d dp",
    sourceType: "core",
    description:
      "You are a robber planning to rob houses along a street. Adjacent houses have connected alarms. Given an integer array nums representing money in each house, return the maximum amount you can rob without alerting police.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "4", explanation: "Rob houses 1 and 3. Total = 4." },
      { input: "nums = [2,7,9,3,1]", output: "12" },
    ],
    constraints: ["1 <= nums.length <= 100", "0 <= nums[i] <= 400"],
    starterCode: {
      python: `class Solution:\n    def rob(self, nums):\n        pass`,
      javascript: `function rob(nums) {\n\n}`,
      typescript: `function rob(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int rob(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int rob(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int rob(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1, 2, 3, 1] }, expectedOutput: 4 },
      { input: { nums: [2, 7, 9, 3, 1] }, expectedOutput: 12 },
      { input: { nums: [1, 2] }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { nums: [2, 1, 1, 2] }, expectedOutput: 4 },
      { input: { nums: [10] }, expectedOutput: 10 },
    ],
  },

  {
    id: 13,
    title: "Coin Change",
    slug: "coin-change",
    functionName: "coinChange",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "unbounded knapsack",
    sourceType: "core",
    description:
      "You are given coins of different denominations and a total amount. Return the fewest coins needed to make the amount. If it cannot be made, return -1. You have an infinite number of each coin denomination.",
    examples: [
      { input: "coins = [1,5,11], amount = 15", output: "3" },
      { input: "coins = [2], amount = 3", output: "-1" },
      { input: "coins = [1], amount = 0", output: "0" },
    ],
    constraints: ["1 <= coins.length <= 12", "1 <= coins[i] <= 2^31 - 1", "0 <= amount <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def coinChange(self, coins, amount):\n        pass`,
      javascript: `function coinChange(coins, amount) {\n\n}`,
      typescript: `function coinChange(coins: number[], amount: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int coinChange(int[] coins, int amount) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int coinChange(vector<int>& coins, int amount) {\n        return 0;\n    }\n};`,
      c: `int coinChange(int* coins, int coinsSize, int amount) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { coins: [1, 5, 11], amount: 15 }, expectedOutput: 3 },
      { input: { coins: [2], amount: 3 }, expectedOutput: -1 },
      { input: { coins: [1, 2, 5], amount: 11 }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { coins: [1], amount: 2 }, expectedOutput: 2 },
      { input: { coins: [2, 5, 10], amount: 27 }, expectedOutput: 4 },
    ],
  },

  {
    id: 18,
    title: "Word Break",
    slug: "word-break",
    functionName: "wordBreak",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "1d dp / memoization",
    sourceType: "core",
    description:
      "Given a string s and a dictionary wordDict, return true if s can be segmented into space-separated dictionary words. The same word may be reused multiple times.",
    examples: [
      { input: 's = "leetcode", wordDict = ["leet","code"]', output: "true" },
      { input: 's = "applepenapple", wordDict = ["apple","pen"]', output: "true" },
      { input: 's = "catsandog", wordDict = ["cats","dog","sand","and","cat"]', output: "false" },
    ],
    constraints: ["1 <= s.length <= 300", "s and wordDict[i] consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def wordBreak(self, s, wordDict):\n        pass`,
      javascript: `function wordBreak(s, wordDict) {\n\n}`,
      typescript: `function wordBreak(s: string, wordDict: string[]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean wordBreak(String s, java.util.List<String> wordDict) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool wordBreak(string s, vector<string>& wordDict) {\n        return false;\n    }\n};`,
      c: `bool wordBreak(char* s, char** wordDict, int wordDictSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "leetcode", wordDict: ["leet", "code"] }, expectedOutput: true },
      { input: { s: "applepenapple", wordDict: ["apple", "pen"] }, expectedOutput: true },
      { input: { s: "catsandog", wordDict: ["cats", "dog", "sand", "and", "cat"] }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { s: "ab", wordDict: ["a", "b"] }, expectedOutput: true },
      { input: { s: "aaaaaaa", wordDict: ["aaaa", "aaa"] }, expectedOutput: true },
    ],
  },

  {
    id: 19,
    title: "Decode Ways",
    slug: "decode-ways",
    functionName: "numDecodings",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "1d dp",
    sourceType: "core",
    description:
      'A message can be encoded: "A"→"1", "B"→"2", ..., "Z"→"26". Given a string s of digits, return the number of ways to decode it. Note that "06" is invalid.',
    examples: [
      { input: 's = "12"', output: "2", explanation: '"AB" (1,2) or "L" (12).' },
      { input: 's = "226"', output: "3" },
      { input: 's = "06"', output: "0" },
    ],
    constraints: ["1 <= s.length <= 100", "s contains only digits."],
    starterCode: {
      python: `class Solution:\n    def numDecodings(self, s):\n        pass`,
      javascript: `function numDecodings(s) {\n\n}`,
      typescript: `function numDecodings(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int numDecodings(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int numDecodings(string s) {\n        return 0;\n    }\n};`,
      c: `int numDecodings(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "12" }, expectedOutput: 2 },
      { input: { s: "226" }, expectedOutput: 3 },
      { input: { s: "06" }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { s: "1" }, expectedOutput: 1 },
      { input: { s: "11106" }, expectedOutput: 2 },
    ],
  },

  // ── GREEDY ────────────────────────────────────────────────────────────────

  {
    id: 20,
    title: "Jump Game II",
    slug: "jump-game-ii",
    functionName: "jump",
    difficulty: "Hard",
    topic: "Greedy",
    pattern: "greedy bfs",
    sourceType: "core",
    description:
      "You are at index 0 of an integer array nums. nums[i] is the maximum forward jump length from index i. Return the minimum number of jumps to reach the last index. A greedy BFS approach gives O(n) time.",
    examples: [
      { input: "nums = [2,3,1,1,4]", output: "2" },
      { input: "nums = [2,3,0,1,4]", output: "2" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "0 <= nums[i] <= 1000", "The answer always exists."],
    starterCode: {
      python: `class Solution:\n    def jump(self, nums):\n        pass`,
      javascript: `function jump(nums) {\n\n}`,
      typescript: `function jump(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int jump(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int jump(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int jump(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [2, 3, 1, 1, 4] }, expectedOutput: 2 },
      { input: { nums: [2, 3, 0, 1, 4] }, expectedOutput: 2 },
      { input: { nums: [1, 2, 3] }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { nums: [1] }, expectedOutput: 0 },
      { input: { nums: [1, 1, 1, 1] }, expectedOutput: 3 },
    ],
  },

  // ── HEAP ──────────────────────────────────────────────────────────────────

  {
    id: 40,
    title: "Kth Largest Element in Array",
    slug: "kth-largest-element",
    functionName: "findKthLargest",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "min-heap of size k",
    sourceType: "core",
    description:
      "Given an integer array nums and an integer k, return the kth largest element. Maintain a min-heap of size k — for each element, push it in, and if the heap exceeds k, pop the smallest. The heap top is the answer.",
    examples: [
      { input: "nums = [3,2,1,5,6,4], k = 2", output: "5" },
      { input: "nums = [3,2,3,1,2,4,5,5,6], k = 4", output: "4" },
    ],
    constraints: ["1 <= k <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def findKthLargest(self, nums, k):\n        pass`,
      javascript: `function findKthLargest(nums, k) {\n\n}`,
      typescript: `function findKthLargest(nums: number[], k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findKthLargest(int[] nums, int k) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findKthLargest(vector<int>& nums, int k) {\n        return 0;\n    }\n};`,
      c: `int findKthLargest(int* nums, int numsSize, int k) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [3, 2, 1, 5, 6, 4], k: 2 }, expectedOutput: 5 },
      { input: { nums: [3, 2, 3, 1, 2, 4, 5, 5, 6], k: 4 }, expectedOutput: 4 },
      { input: { nums: [1], k: 1 }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums: [5, 2, 4, 1, 3, 6, 0], k: 3 }, expectedOutput: 4 },
      { input: { nums: [7, 6, 5, 4, 3, 2, 1], k: 5 }, expectedOutput: 3 },
    ],
  },

  {
    id: 41,
    title: "Last Stone Weight",
    slug: "last-stone-weight",
    functionName: "lastStoneWeight",
    difficulty: "Easy",
    topic: "Heap",
    pattern: "max-heap",
    sourceType: "variant",
    description:
      "Each turn, smash the two heaviest stones. If equal, both destroyed. If not, the smaller is destroyed and the larger becomes (larger - smaller). Return the weight of the last stone, or 0 if none remain.\n\nA max-heap efficiently gives you the two heaviest stones each turn.",
    examples: [
      { input: "stones = [2,7,4,1,8,1]", output: "1" },
      { input: "stones = [1]", output: "1" },
    ],
    constraints: ["1 <= stones.length <= 30", "1 <= stones[i] <= 1000"],
    starterCode: {
      python: `class Solution:\n    def lastStoneWeight(self, stones):\n        pass`,
      javascript: `function lastStoneWeight(stones) {\n\n}`,
      typescript: `function lastStoneWeight(stones: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int lastStoneWeight(int[] stones) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int lastStoneWeight(vector<int>& stones) {\n        return 0;\n    }\n};`,
      c: `int lastStoneWeight(int* stones, int stonesSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { stones: [2, 7, 4, 1, 8, 1] }, expectedOutput: 1 },
      { input: { stones: [1] }, expectedOutput: 1 },
      { input: { stones: [3, 3] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { stones: [10, 4, 2, 10] }, expectedOutput: 2 },
      { input: { stones: [1, 1, 1, 1] }, expectedOutput: 0 },
    ],
  },

  // ── BACKTRACKING ──────────────────────────────────────────────────────────

  {
    id: 42,
    title: "Subsets",
    slug: "subsets",
    functionName: "subsets",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "backtracking",
    sourceType: "core",
    description:
      "Given an integer array nums of unique elements, return the total number of subsets (the power set). The power set of n elements has 2^n subsets.\n\nAt each step, decide to include or exclude the current element. You can also solve this with bit manipulation: iterate from 0 to 2^n - 1.",
    examples: [
      { input: "nums = [1,2,3]", output: "8", explanation: "Subsets: [], [1], [2], [3], [1,2], [1,3], [2,3], [1,2,3]." },
      { input: "nums = [0]", output: "2" },
    ],
    constraints: ["1 <= nums.length <= 10", "-10 <= nums[i] <= 10", "All elements are unique."],
    starterCode: {
      python: `class Solution:\n    def subsets(self, nums):\n        # return the count of all subsets\n        pass`,
      javascript: `function subsets(nums) {\n  // return the count of all subsets\n}`,
      typescript: `function subsets(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int subsets(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int subsets(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int subsets(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1, 2, 3] }, expectedOutput: 8 },
      { input: { nums: [0] }, expectedOutput: 2 },
      { input: { nums: [1, 2] }, expectedOutput: 4 },
    ],
    hiddentestcases: [
      { input: { nums: [1, 2, 3, 4] }, expectedOutput: 16 },
      { input: { nums: [5] }, expectedOutput: 2 },
    ],
  },

  {
    id: 43,
    title: "Combination Sum",
    slug: "combination-sum",
    functionName: "combinationSum",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "backtracking",
    sourceType: "core",
    description:
      "Given an array of distinct positive integers candidates and a target, return the number of unique combinations where chosen numbers sum to target. The same number may be chosen unlimited times.\n\nBacktrack: include the current candidate (reusable) or move to the next. Stop when remaining target is 0 (count it) or goes negative (prune).",
    examples: [
      { input: "candidates = [2,3,6,7], target = 7", output: "2", explanation: "[2,2,3] and [7]." },
      { input: "candidates = [2,3,5], target = 8", output: "3" },
      { input: "candidates = [2], target = 1", output: "0" },
    ],
    constraints: ["1 <= candidates.length <= 30", "1 <= candidates[i] <= 200", "All elements are distinct.", "1 <= target <= 500"],
    starterCode: {
      python: `class Solution:\n    def combinationSum(self, candidates, target):\n        # return the count of unique combinations\n        pass`,
      javascript: `function combinationSum(candidates, target) {\n  // return the count of unique combinations\n}`,
      typescript: `function combinationSum(candidates: number[], target: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int combinationSum(int[] candidates, int target) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int combinationSum(vector<int>& candidates, int target) {\n        return 0;\n    }\n};`,
      c: `int combinationSum(int* candidates, int candidatesSize, int target) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { candidates: [2, 3, 6, 7], target: 7 }, expectedOutput: 2 },
      { input: { candidates: [2, 3, 5], target: 8 }, expectedOutput: 3 },
      { input: { candidates: [2], target: 1 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { candidates: [3, 5, 7], target: 12 }, expectedOutput: 2 },
      { input: { candidates: [1, 2], target: 4 }, expectedOutput: 3 },
    ],
  },

  {
    id: 44,
    title: "Letter Case Permutations",
    slug: "letter-case-permutations",
    functionName: "letterCasePermutation",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "backtracking",
    sourceType: "original",
    description:
      "Given a string s, return the total number of unique strings you can generate by transforming every letter to be lowercase or uppercase. Digits stay as-is.\n\nThis is a Code Club original. The total count is 2 raised to the power of the number of letters in the string.",
    examples: [
      { input: 's = "a1b2"', output: "4", explanation: '"a1b2", "a1B2", "A1b2", "A1B2".' },
      { input: 's = "3z4"', output: "2" },
      { input: 's = "12345"', output: "1" },
    ],
    constraints: ["1 <= s.length <= 12"],
    starterCode: {
      python: `class Solution:\n    def letterCasePermutation(self, s):\n        # return the count of unique case permutations\n        pass`,
      javascript: `function letterCasePermutation(s) {\n  // return the count of unique case permutations\n}`,
      typescript: `function letterCasePermutation(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int letterCasePermutation(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int letterCasePermutation(string s) {\n        return 0;\n    }\n};`,
      c: `int letterCasePermutation(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "a1b2" }, expectedOutput: 4 },
      { input: { s: "3z4" }, expectedOutput: 2 },
      { input: { s: "12345" }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { s: "abc" }, expectedOutput: 8 },
      { input: { s: "C" }, expectedOutput: 2 },
    ],
  },

  // ── TREES ─────────────────────────────────────────────────────────────────

  {
    id: 26,
    title: "Maximum Depth of Binary Tree",
    slug: "maximum-depth-of-binary-tree",
    functionName: "maxDepth",
    difficulty: "Easy",
    topic: "Trees",
    pattern: "dfs",
    sourceType: "core",
    description:
      "Given a binary tree as a level-order array (where -1 means null), return its maximum depth — the number of nodes along the longest path from root to leaf.\n\nExample: [3,9,20,-1,-1,15,7] has root 3, left child 9, right child 20, and 20's children are 15 and 7.",
    examples: [
      { input: "root = [3,9,20,-1,-1,15,7]", output: "3" },
      { input: "root = [1,-1,2]", output: "2" },
      { input: "root = []", output: "0" },
    ],
    constraints: ["0 <= number of nodes <= 10^4", "-100 <= Node.val <= 100"],
    starterCode: {
      python: `class Solution:\n    def maxDepth(self, root):\n        # root is a level-order list, -1 = null node\n        pass`,
      javascript: `function maxDepth(root) {\n  // root is a level-order array, -1 = null node\n}`,
      typescript: `function maxDepth(root: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxDepth(int[] root) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxDepth(vector<int>& root) {\n        return 0;\n    }\n};`,
      c: `int maxDepth(int* root, int rootSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { root: [3, 9, 20, -1, -1, 15, 7] }, expectedOutput: 3 },
      { input: { root: [1, -1, 2] }, expectedOutput: 2 },
      { input: { root: [] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { root: [1] }, expectedOutput: 1 },
      { input: { root: [1, 2, 3, 4, 5] }, expectedOutput: 3 },
    ],
  },

  {
    id: 27,
    title: "Invert Binary Tree",
    slug: "invert-binary-tree",
    functionName: "invertTree",
    difficulty: "Easy",
    topic: "Trees",
    pattern: "dfs",
    sourceType: "core",
    description:
      "Given a binary tree as a level-order array, invert the tree (mirror it left-to-right) and return the level-order array of the inverted tree. Recursively swap left and right children at every node.",
    examples: [
      { input: "root = [4,2,7,1,3,6,9]", output: "[4,7,2,9,6,3,1]" },
      { input: "root = [2,1,3]", output: "[2,3,1]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: ["0 <= number of nodes <= 100", "-100 <= Node.val <= 100"],
    starterCode: {
      python: `class Solution:\n    def invertTree(self, root):\n        # root is a level-order list, -1 = null\n        # return the inverted level-order list\n        pass`,
      javascript: `function invertTree(root) {\n  // root is a level-order array, -1 = null\n  // return the inverted level-order array\n}`,
      typescript: `function invertTree(root: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] invertTree(int[] root) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> invertTree(vector<int>& root) {\n        return {};\n    }\n};`,
      c: `int* invertTree(int* root, int rootSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { root: [4, 2, 7, 1, 3, 6, 9] }, expectedOutput: [4, 7, 2, 9, 6, 3, 1] },
      { input: { root: [2, 1, 3] }, expectedOutput: [2, 3, 1] },
      { input: { root: [] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { root: [1] }, expectedOutput: [1] },
      { input: { root: [1, 2, -1] }, expectedOutput: [1, -1, 2] },
    ],
  },

  {
    id: 28,
    title: "Diameter of Binary Tree",
    slug: "diameter-of-binary-tree",
    functionName: "diameterOfBinaryTree",
    difficulty: "Easy",
    topic: "Trees",
    pattern: "dfs",
    sourceType: "core",
    description:
      "Given a binary tree as a level-order array, return the length of the tree's diameter — the longest path between any two nodes.\n\nAt each node, the longest path through it = left depth + right depth. Track the maximum as you recurse.",
    examples: [
      { input: "root = [1,2,3,4,5]", output: "3", explanation: "Longest path is [4,2,1,3] — length 3." },
      { input: "root = [1,2]", output: "1" },
    ],
    constraints: ["1 <= number of nodes <= 10^4", "-100 <= Node.val <= 100"],
    starterCode: {
      python: `class Solution:\n    def diameterOfBinaryTree(self, root):\n        # root is a level-order list, -1 = null\n        pass`,
      javascript: `function diameterOfBinaryTree(root) {\n  // root is a level-order array, -1 = null\n}`,
      typescript: `function diameterOfBinaryTree(root: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int diameterOfBinaryTree(int[] root) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int diameterOfBinaryTree(vector<int>& root) {\n        return 0;\n    }\n};`,
      c: `int diameterOfBinaryTree(int* root, int rootSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { root: [1, 2, 3, 4, 5] }, expectedOutput: 3 },
      { input: { root: [1, 2] }, expectedOutput: 1 },
      { input: { root: [1] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { root: [1, 2, 3, 4, 5, -1, -1, 6] }, expectedOutput: 4 },
      { input: { root: [1, -1, 2, -1, -1, -1, 3] }, expectedOutput: 2 },
    ],
  },

  {
    id: 29,
    title: "Validate Binary Search Tree",
    slug: "validate-binary-search-tree",
    functionName: "isValidBST",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "dfs with bounds",
    sourceType: "core",
    description:
      "Given a binary tree as a level-order array, determine if it is a valid BST.\n\nKey insight: pass min/max bounds down the recursion — don't just compare parent and child. Every node in the left subtree must be less than all ancestors, not just its parent.",
    examples: [
      { input: "root = [2,1,3]", output: "true" },
      { input: "root = [5,1,4,-1,-1,3,6]", output: "false" },
    ],
    constraints: ["1 <= number of nodes <= 10^4", "-2^31 <= Node.val <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def isValidBST(self, root):\n        # root is a level-order list, -1 = null\n        pass`,
      javascript: `function isValidBST(root) {\n  // root is a level-order array, -1 = null\n}`,
      typescript: `function isValidBST(root: number[]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isValidBST(int[] root) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isValidBST(vector<int>& root) {\n        return false;\n    }\n};`,
      c: `bool isValidBST(int* root, int rootSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { root: [2, 1, 3] }, expectedOutput: true },
      { input: { root: [5, 1, 4, -1, -1, 3, 6] }, expectedOutput: false },
      { input: { root: [1] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { root: [5, 4, 6, -1, -1, 3, 7] }, expectedOutput: false },
      { input: { root: [10, 5, 15, -1, -1, 12, 20] }, expectedOutput: true },
    ],
  },

  {
    id: 30,
    title: "Same Tree",
    slug: "same-tree",
    functionName: "isSameTree",
    difficulty: "Easy",
    topic: "Trees",
    pattern: "dfs",
    sourceType: "variant",
    description:
      "Given two binary trees as level-order arrays p and q, check whether they are structurally identical with the same node values.\n\nRecurse through both simultaneously: if both null — equal. If one null — not equal. If values differ — not equal.",
    examples: [
      { input: "p = [1,2,3], q = [1,2,3]", output: "true" },
      { input: "p = [1,2], q = [1,-1,2]", output: "false" },
      { input: "p = [1,2,1], q = [1,1,2]", output: "false" },
    ],
    constraints: ["0 <= number of nodes <= 100", "-10^4 <= Node.val <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def isSameTree(self, p, q):\n        # p and q are level-order lists, -1 = null\n        pass`,
      javascript: `function isSameTree(p, q) {\n  // p and q are level-order arrays, -1 = null\n}`,
      typescript: `function isSameTree(p: number[], q: number[]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isSameTree(int[] p, int[] q) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isSameTree(vector<int>& p, vector<int>& q) {\n        return false;\n    }\n};`,
      c: `bool isSameTree(int* p, int pSize, int* q, int qSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { p: [1, 2, 3], q: [1, 2, 3] }, expectedOutput: true },
      { input: { p: [1, 2], q: [1, -1, 2] }, expectedOutput: false },
      { input: { p: [1, 2, 1], q: [1, 1, 2] }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { p: [], q: [] }, expectedOutput: true },
      { input: { p: [1], q: [1] }, expectedOutput: true },
    ],
  },

  // ── GRAPHS ────────────────────────────────────────────────────────────────

  {
    id: 45,
    title: "Flood Fill",
    slug: "flood-fill",
    functionName: "floodFill",
    difficulty: "Easy",
    topic: "Graphs",
    pattern: "dfs on grid",
    sourceType: "core",
    description:
      "An image is a 2D grid of integers flattened to a 1D array with numCols columns. Given a starting pixel (sr, sc) and a new color, flood fill the image — replace the starting pixel and all connected same-color pixels with the new color. Connectivity is 4-directional.",
    examples: [
      { input: "image = [1,1,1,1,0,0,1,0,0], numCols = 3, sr = 0, sc = 0, color = 2", output: "[2,2,2,2,0,0,2,0,0]" },
      { input: "image = [0,0,0,0,0,0,0,0,0], numCols = 3, sr = 0, sc = 0, color = 0", output: "[0,0,0,0,0,0,0,0,0]" },
    ],
    constraints: ["1 <= image.length <= 2500", "numCols divides image.length evenly", "0 <= sr < rows, 0 <= sc < numCols"],
    starterCode: {
      python: `class Solution:\n    def floodFill(self, image, numCols, sr, sc, color):\n        # image is a flat list; reconstruct grid with numCols\n        pass`,
      javascript: `function floodFill(image, numCols, sr, sc, color) {\n  // image is a flat array; reconstruct grid with numCols\n}`,
      typescript: `function floodFill(image: number[], numCols: number, sr: number, sc: number, color: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] floodFill(int[] image, int numCols, int sr, int sc, int color) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> floodFill(vector<int>& image, int numCols, int sr, int sc, int color) {\n        return {};\n    }\n};`,
      c: `int* floodFill(int* image, int imageSize, int numCols, int sr, int sc, int color, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { image: [1,1,1,1,0,0,1,0,0], numCols: 3, sr: 0, sc: 0, color: 2 }, expectedOutput: [2,2,2,2,0,0,2,0,0] },
      { input: { image: [0,0,0,0,0,0,0,0,0], numCols: 3, sr: 0, sc: 0, color: 0 }, expectedOutput: [0,0,0,0,0,0,0,0,0] },
      { input: { image: [1,1,1,1,1,0,1,0,1], numCols: 3, sr: 1, sc: 1, color: 3 }, expectedOutput: [3,3,3,3,3,0,3,0,1] },
    ],
    hiddentestcases: [
      { input: { image: [0,0,0,0,1,1,0,1,1], numCols: 3, sr: 1, sc: 1, color: 5 }, expectedOutput: [0,0,0,0,5,5,0,5,5] },
    ],
  },

  {
    id: 46,
    title: "Number of Islands",
    slug: "number-of-islands",
    functionName: "numIslands",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "dfs / bfs on grid",
    sourceType: "core",
    description:
      "Given a 2D binary grid flattened to a 1D array of 0s and 1s with numCols columns, count the number of islands. An island is formed by connecting adjacent 1s horizontally or vertically.\n\nFor each unvisited land cell, run a DFS/BFS to mark the entire island as visited, then increment the count.",
    examples: [
      { input: "grid = [1,1,1,1,0,1,1,0,1,0,1,1,0,0,0,0,0,0,0,0], numCols = 5", output: "1" },
      { input: "grid = [1,1,0,0,0,1,1,0,0,0,0,0,1,0,0,0,0,0,1,1], numCols = 5", output: "3" },
    ],
    constraints: ["1 <= grid.length <= 90000", "numCols divides grid.length evenly", "grid[i] is 0 or 1"],
    starterCode: {
      python: `class Solution:\n    def numIslands(self, grid, numCols):\n        # grid is a flat list of 0s and 1s\n        pass`,
      javascript: `function numIslands(grid, numCols) {\n  // grid is a flat array of 0s and 1s\n}`,
      typescript: `function numIslands(grid: number[], numCols: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int numIslands(int[] grid, int numCols) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int numIslands(vector<int>& grid, int numCols) {\n        return 0;\n    }\n};`,
      c: `int numIslands(int* grid, int gridSize, int numCols) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { grid: [1,1,1,1,0,1,1,0,1,0,1,1,0,0,0,0,0,0,0,0], numCols: 5 }, expectedOutput: 1 },
      { input: { grid: [1,1,0,0,0,1,1,0,0,0,0,0,1,0,0,0,0,0,1,1], numCols: 5 }, expectedOutput: 3 },
      { input: { grid: [1,1,0,1,0], numCols: 5 }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { grid: [0,0,0,0,0], numCols: 5 }, expectedOutput: 0 },
      { input: { grid: [1,0,1,0,1], numCols: 5 }, expectedOutput: 3 },
    ],
  },

  // ── BIT MANIPULATION ─────────────────────────────────────────────────────

  {
    id: 7,
    title: "Single Number",
    slug: "single-number",
    functionName: "singleNumber",
    difficulty: "Easy",
    topic: "Bit Manipulation",
    pattern: "xor",
    sourceType: "core",
    description:
      "Given a non-empty array of integers where every element appears twice except for one, find that single one. You must use O(n) time and O(1) space. Hint: XOR of a number with itself is 0.",
    examples: [
      { input: "nums = [2,2,1]", output: "1" },
      { input: "nums = [4,1,2,1,2]", output: "4" },
    ],
    constraints: ["1 <= nums.length <= 3 * 10^4", "Each element appears twice except for one."],
    starterCode: {
      python: `class Solution:\n    def singleNumber(self, nums):\n        pass`,
      javascript: `function singleNumber(nums) {\n\n}`,
      typescript: `function singleNumber(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int singleNumber(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int singleNumber(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int singleNumber(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [2, 2, 1] }, expectedOutput: 1 },
      { input: { nums: [4, 1, 2, 1, 2] }, expectedOutput: 4 },
      { input: { nums: [1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums: [0, 1, 0] }, expectedOutput: 1 },
      { input: { nums: [17, 17, 42] }, expectedOutput: 42 },
    ],
  },

  // ── BATCH 036: Arrays II (IDs 51-60) ──────────────────────────────────────

  {
    id: 51,
    title: "Product of Array Except Self",
    slug: "product-of-array-except-self",
    functionName: "productExceptSelf",
    difficulty: "Medium",
    topic: "Arrays",
    pattern: "prefix product",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook", "Google"],
    description: "Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i]. You must solve it in O(n) time without using the division operation.",
    examples: [
      { input: "nums = [1,2,3,4]", output: "[24,12,8,6]" },
      { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]" },
    ],
    constraints: ["2 <= nums.length <= 10^5", "-30 <= nums[i] <= 30", "The product of any prefix or suffix fits in a 32-bit integer."],
    starterCode: {
      python: `class Solution:\n    def productExceptSelf(self, nums):\n        pass`,
      javascript: `function productExceptSelf(nums) {\n\n}`,
      typescript: `function productExceptSelf(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] productExceptSelf(int[] nums) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> productExceptSelf(vector<int>& nums) {\n        return {};\n    }\n};`,
      c: `int* productExceptSelf(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { nums: [1,2,3,4] }, expectedOutput: [24,12,8,6] },
      { input: { nums: [-1,1,0,-3,3] }, expectedOutput: [0,0,9,0,0] },
      { input: { nums: [2,3] }, expectedOutput: [3,2] },
    ],
    hiddentestcases: [
      { input: { nums: [1,1,1,1] }, expectedOutput: [1,1,1,1] },
      { input: { nums: [0,0] }, expectedOutput: [0,0] },
      { input: { nums: [-1,-2,-3] }, expectedOutput: [6,3,2] },
    ],
  },

  {
    id: 52,
    title: "Find All Duplicates in an Array",
    slug: "find-all-duplicates-in-array",
    functionName: "findDuplicates",
    difficulty: "Medium",
    topic: "Arrays",
    pattern: "index marking",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given an integer array nums of length n where all integers are in the range [1, n] and each integer appears once or twice, return an array of all integers that appear twice. You must solve this in O(n) time and use only O(1) extra space.",
    examples: [
      { input: "nums = [4,3,2,7,8,2,3,1]", output: "[2,3]" },
      { input: "nums = [1,1,2]", output: "[1]" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 10^5", "1 <= nums[i] <= n"],
    starterCode: {
      python: `class Solution:\n    def findDuplicates(self, nums):\n        pass`,
      javascript: `function findDuplicates(nums) {\n\n}`,
      typescript: `function findDuplicates(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<Integer> findDuplicates(int[] nums) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> findDuplicates(vector<int>& nums) {\n        return {};\n    }\n};`,
      c: `int* findDuplicates(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { nums: [4,3,2,7,8,2,3,1] }, expectedOutput: [2,3] },
      { input: { nums: [1,1,2] }, expectedOutput: [1] },
      { input: { nums: [1] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { nums: [2,2,3,3] }, expectedOutput: [2,3] },
      { input: { nums: [1,2,3,4] }, expectedOutput: [] },
    ],
  },

  {
    id: 53,
    title: "Rotate Array",
    slug: "rotate-array",
    functionName: "rotate",
    difficulty: "Medium",
    topic: "Arrays",
    pattern: "reverse trick",
    sourceType: "core",
    companies: ["Microsoft", "Amazon"],
    description: "Given an integer array nums, rotate the array to the right by k steps, where k is non-negative. Do it in-place with O(1) extra space.",
    examples: [
      { input: "nums = [1,2,3,4,5,6,7], k = 3", output: "[5,6,7,1,2,3,4]" },
      { input: "nums = [-1,-100,3,99], k = 2", output: "[3,99,-1,-100]" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-2^31 <= nums[i] <= 2^31 - 1", "0 <= k <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def rotate(self, nums, k):\n        pass`,
      javascript: `function rotate(nums, k) {\n\n}`,
      typescript: `function rotate(nums: number[], k: number): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void rotate(int[] nums, int k) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void rotate(vector<int>& nums, int k) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { nums: [1,2,3,4,5,6,7], k: 3 }, expectedOutput: [5,6,7,1,2,3,4] },
      { input: { nums: [-1,-100,3,99], k: 2 }, expectedOutput: [3,99,-1,-100] },
      { input: { nums: [1,2], k: 3 }, expectedOutput: [2,1] },
    ],
    hiddentestcases: [
      { input: { nums: [1], k: 0 }, expectedOutput: [1] },
      { input: { nums: [1,2,3], k: 3 }, expectedOutput: [1,2,3] },
    ],
  },

  {
    id: 54,
    title: "Sort Colors",
    slug: "sort-colors",
    functionName: "sortColors",
    difficulty: "Medium",
    topic: "Arrays",
    pattern: "dutch national flag",
    sourceType: "core",
    companies: ["Microsoft", "Amazon", "Facebook"],
    description: "Given an array nums with n objects colored red (0), white (1), or blue (2), sort them in-place so that objects of the same color are adjacent, in the order red, white, blue. You must solve this without using the library's sort function and in one pass.",
    examples: [
      { input: "nums = [2,0,2,1,1,0]", output: "[0,0,1,1,2,2]" },
      { input: "nums = [2,0,1]", output: "[0,1,2]" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 300", "nums[i] is either 0, 1, or 2."],
    starterCode: {
      python: `class Solution:\n    def sortColors(self, nums):\n        pass`,
      javascript: `function sortColors(nums) {\n\n}`,
      typescript: `function sortColors(nums: number[]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void sortColors(int[] nums) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void sortColors(vector<int>& nums) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { nums: [2,0,2,1,1,0] }, expectedOutput: [0,0,1,1,2,2] },
      { input: { nums: [2,0,1] }, expectedOutput: [0,1,2] },
      { input: { nums: [0] }, expectedOutput: [0] },
    ],
    hiddentestcases: [
      { input: { nums: [1,0] }, expectedOutput: [0,1] },
      { input: { nums: [2,2,0,0,1,1] }, expectedOutput: [0,0,1,1,2,2] },
    ],
  },

  {
    id: 55,
    title: "Next Permutation",
    slug: "next-permutation",
    functionName: "nextPermutation",
    difficulty: "Medium",
    topic: "Arrays",
    pattern: "in-place rearrangement",
    sourceType: "core",
    companies: ["Google", "Microsoft", "Amazon"],
    description: "A permutation of an array is the next lexicographically greater permutation. Given an array nums, rearrange the numbers into the next permutation. If no next permutation exists, rearrange into the lowest order (ascending). The replacement must be in place using only constant extra memory.",
    examples: [
      { input: "nums = [1,2,3]", output: "[1,3,2]" },
      { input: "nums = [3,2,1]", output: "[1,2,3]" },
      { input: "nums = [1,1,5]", output: "[1,5,1]" },
    ],
    constraints: ["1 <= nums.length <= 100", "0 <= nums[i] <= 100"],
    starterCode: {
      python: `class Solution:\n    def nextPermutation(self, nums):\n        pass`,
      javascript: `function nextPermutation(nums) {\n\n}`,
      typescript: `function nextPermutation(nums: number[]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void nextPermutation(int[] nums) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void nextPermutation(vector<int>& nums) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { nums: [1,2,3] }, expectedOutput: [1,3,2] },
      { input: { nums: [3,2,1] }, expectedOutput: [1,2,3] },
      { input: { nums: [1,1,5] }, expectedOutput: [1,5,1] },
    ],
    hiddentestcases: [
      { input: { nums: [1] }, expectedOutput: [1] },
      { input: { nums: [1,3,2] }, expectedOutput: [2,1,3] },
    ],
  },

  // ── BATCH 036: Strings II (IDs 56-60) ─────────────────────────────────────

  {
    id: 56,
    title: "Longest Palindromic Substring",
    slug: "longest-palindromic-substring",
    functionName: "longestPalindrome",
    difficulty: "Medium",
    topic: "Strings",
    pattern: "expand around center",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook", "Google"],
    description: "Given a string s, return the longest palindromic substring in s.",
    examples: [
      { input: 's = "babad"', output: '"bab"', explanation: '"aba" is also valid.' },
      { input: 's = "cbbd"', output: '"bb"' },
    ],
    constraints: ["1 <= s.length <= 1000", "s consists of only digits and English letters."],
    starterCode: {
      python: `class Solution:\n    def longestPalindrome(self, s):\n        pass`,
      javascript: `function longestPalindrome(s) {\n\n}`,
      typescript: `function longestPalindrome(s: string): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String longestPalindrome(String s) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string longestPalindrome(string s) {\n        return "";\n    }\n};`,
      c: `char* longestPalindrome(char* s) {\n    return "";\n}`,
    },
    testcases: [
      { input: { s: "babad" }, expectedOutput: "bab" },
      { input: { s: "cbbd" }, expectedOutput: "bb" },
      { input: { s: "a" }, expectedOutput: "a" },
    ],
    hiddentestcases: [
      { input: { s: "ac" }, expectedOutput: "a" },
      { input: { s: "racecar" }, expectedOutput: "racecar" },
      { input: { s: "aacabdkacaa" }, expectedOutput: "aca" },
    ],
  },

  {
    id: 57,
    title: "String to Integer (atoi)",
    slug: "string-to-integer-atoi",
    functionName: "myAtoi",
    difficulty: "Medium",
    topic: "Strings",
    pattern: "string parsing",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Bloomberg"],
    description: "Implement the myAtoi(string s) function, which converts a string to a 32-bit signed integer. The algorithm: ignore leading whitespace, check sign, read digits until non-digit, clamp to [-2^31, 2^31-1].",
    examples: [
      { input: 's = "42"', output: "42" },
      { input: 's = "   -42"', output: "-42" },
      { input: 's = "4193 with words"', output: "4193" },
    ],
    constraints: ["0 <= s.length <= 200", "s consists of English letters, digits, ' ', '+', '-', '.'."],
    starterCode: {
      python: `class Solution:\n    def myAtoi(self, s):\n        pass`,
      javascript: `function myAtoi(s) {\n\n}`,
      typescript: `function myAtoi(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int myAtoi(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int myAtoi(string s) {\n        return 0;\n    }\n};`,
      c: `int myAtoi(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "42" }, expectedOutput: 42 },
      { input: { s: "   -42" }, expectedOutput: -42 },
      { input: { s: "4193 with words" }, expectedOutput: 4193 },
    ],
    hiddentestcases: [
      { input: { s: "words and 987" }, expectedOutput: 0 },
      { input: { s: "-91283472332" }, expectedOutput: -2147483648 },
      { input: { s: "  +  413" }, expectedOutput: 0 },
    ],
  },

  {
    id: 58,
    title: "Count and Say",
    slug: "count-and-say",
    functionName: "countAndSay",
    difficulty: "Medium",
    topic: "Strings",
    pattern: "simulation",
    sourceType: "core",
    companies: ["Facebook", "Google"],
    description: "The count-and-say sequence is: 1, 11, 21, 1211, 111221, ... Each term describes the previous term by counting runs of digits. Given n, return the nth term of the count-and-say sequence.",
    examples: [
      { input: "n = 1", output: '"1"' },
      { input: "n = 4", output: '"1211"' },
    ],
    constraints: ["1 <= n <= 30"],
    starterCode: {
      python: `class Solution:\n    def countAndSay(self, n):\n        pass`,
      javascript: `function countAndSay(n) {\n\n}`,
      typescript: `function countAndSay(n: number): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String countAndSay(int n) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string countAndSay(int n) {\n        return "";\n    }\n};`,
      c: `char* countAndSay(int n) {\n    return "";\n}`,
    },
    testcases: [
      { input: { n: 1 }, expectedOutput: "1" },
      { input: { n: 4 }, expectedOutput: "1211" },
      { input: { n: 2 }, expectedOutput: "11" },
    ],
    hiddentestcases: [
      { input: { n: 5 }, expectedOutput: "111221" },
      { input: { n: 6 }, expectedOutput: "312211" },
    ],
  },

  {
    id: 59,
    title: "Minimum Window Substring",
    slug: "minimum-window-substring",
    functionName: "minWindow",
    difficulty: "Hard",
    topic: "Sliding Window",
    pattern: "sliding window with frequency map",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description: "Given two strings s and t, return the minimum window substring of s such that every character in t (including duplicates) is included in the window. If no such window exists, return the empty string.",
    examples: [
      { input: 's = "ADOBECODEBANC", t = "ABC"', output: '"BANC"' },
      { input: 's = "a", t = "a"', output: '"a"' },
      { input: 's = "a", t = "aa"', output: '""' },
    ],
    constraints: ["m == s.length", "n == t.length", "1 <= m, n <= 10^5", "s and t consist of uppercase and lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def minWindow(self, s, t):\n        pass`,
      javascript: `function minWindow(s, t) {\n\n}`,
      typescript: `function minWindow(s: string, t: string): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String minWindow(String s, String t) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string minWindow(string s, string t) {\n        return "";\n    }\n};`,
      c: `char* minWindow(char* s, char* t) {\n    return "";\n}`,
    },
    testcases: [
      { input: { s: "ADOBECODEBANC", t: "ABC" }, expectedOutput: "BANC" },
      { input: { s: "a", t: "a" }, expectedOutput: "a" },
      { input: { s: "a", t: "aa" }, expectedOutput: "" },
    ],
    hiddentestcases: [
      { input: { s: "abc", t: "cba" }, expectedOutput: "abc" },
      { input: { s: "bba", t: "ab" }, expectedOutput: "ba" },
    ],
  },

  {
    id: 60,
    title: "Encode and Decode Strings",
    slug: "encode-and-decode-strings",
    functionName: "encode",
    difficulty: "Medium",
    topic: "Strings",
    pattern: "length-prefix encoding",
    sourceType: "core",
    companies: ["Google", "Facebook"],
    description: "Design an algorithm to encode a list of strings to a single string, and decode that single string back to the original list. Implement encode(strs) and decode(s). The encoded string should be transferable through HTTP and decodable back to the original list.",
    examples: [
      { input: 'strs = ["lint","code","love","you"]', output: '["lint","code","love","you"]', explanation: "After encoding then decoding, we get back the original." },
      { input: 'strs = ["we","say",":","yes"]', output: '["we","say",":","yes"]' },
    ],
    constraints: ["1 <= strs.length <= 200", "0 <= strs[i].length <= 200", "strs[i] contains any possible characters."],
    starterCode: {
      python: `class Solution:\n    def encode(self, strs):\n        pass\n\n    def decode(self, s):\n        pass`,
      javascript: `function encode(strs) {\n\n}\n\nfunction decode(s) {\n\n}`,
      typescript: `function encode(strs: string[]): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String encode(List<String> strs) {\n        return "";\n    }\n    public List<String> decode(String s) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string encode(vector<string>& strs) {\n        return "";\n    }\n    vector<string> decode(string s) {\n        return {};\n    }\n};`,
      c: `char* encode(char** strs, int strsSize) {\n    return "";\n}`,
    },
    testcases: [
      { input: { strs: ["lint","code","love","you"] }, expectedOutput: ["lint","code","love","you"] },
      { input: { strs: ["we","say",":","yes"] }, expectedOutput: ["we","say",":","yes"] },
      { input: { strs: [""] }, expectedOutput: [""] },
    ],
    hiddentestcases: [
      { input: { strs: ["hello","world"] }, expectedOutput: ["hello","world"] },
      { input: { strs: ["#","##"] }, expectedOutput: ["#","##"] },
    ],
  },

  // ── BATCH 037: Linked Lists II (IDs 61-70) ────────────────────────────────

  {
    id: 61,
    title: "Linked List Cycle",
    slug: "linked-list-cycle",
    functionName: "hasCycle",
    difficulty: "Easy",
    topic: "Linked List",
    pattern: "slow and fast pointers",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook"],
    description: "Given head, the head of a linked list, determine if the linked list has a cycle in it. Return true if there is a cycle, false otherwise. Use O(1) memory.",
    examples: [
      { input: "head = [3,2,0,-4], pos = 1", output: "true", explanation: "Tail connects to node at index 1." },
      { input: "head = [1,2], pos = 0", output: "true" },
      { input: "head = [1], pos = -1", output: "false" },
    ],
    constraints: ["0 <= n <= 10^4", "-10^5 <= Node.val <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def hasCycle(self, head):\n        pass`,
      javascript: `function hasCycle(head) {\n\n}`,
      typescript: `function hasCycle(head: any): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean hasCycle(ListNode head) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool hasCycle(ListNode *head) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { head: [3,2,0,-4], pos: 1 }, expectedOutput: true },
      { input: { head: [1,2], pos: 0 }, expectedOutput: true },
      { input: { head: [1], pos: -1 }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { head: [], pos: -1 }, expectedOutput: false },
      { input: { head: [1,2,3,4,5], pos: 2 }, expectedOutput: true },
    ],
  },

  {
    id: 62,
    title: "Reorder List",
    slug: "reorder-list",
    functionName: "reorderList",
    difficulty: "Medium",
    topic: "Linked List",
    pattern: "slow-fast + reverse + merge",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given the head of a singly linked list L0→L1→…→Ln, reorder it to: L0→Ln→L1→Ln-1→L2→Ln-2→… Do not change node values, only node pointers.",
    examples: [
      { input: "head = [1,2,3,4]", output: "[1,4,2,3]" },
      { input: "head = [1,2,3,4,5]", output: "[1,5,2,4,3]" },
    ],
    constraints: ["1 <= n <= 5 * 10^4", "1 <= Node.val <= 1000"],
    starterCode: {
      python: `class Solution:\n    def reorderList(self, head):\n        pass`,
      javascript: `function reorderList(head) {\n\n}`,
      typescript: `function reorderList(head: any): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void reorderList(ListNode head) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void reorderList(ListNode* head) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { head: [1,2,3,4] }, expectedOutput: [1,4,2,3] },
      { input: { head: [1,2,3,4,5] }, expectedOutput: [1,5,2,4,3] },
      { input: { head: [1] }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { head: [1,2] }, expectedOutput: [1,2] },
      { input: { head: [1,2,3] }, expectedOutput: [1,3,2] },
    ],
  },

  {
    id: 63,
    title: "LRU Cache",
    slug: "lru-cache",
    functionName: "LRUCache",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "returningOnly" },
    difficulty: "Medium",
    topic: "Linked List",
    pattern: "doubly linked list + hashmap",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft", "Facebook"],
    description: "Design a data structure that follows the Least Recently Used (LRU) cache constraints. Implement LRUCache with capacity, get(key), and put(key, value). get returns -1 if key not found. put inserts or updates, evicting the LRU key if at capacity. Both ops must run in O(1).",
    examples: [
      { input: '["LRUCache","put","put","get","put","get","put","get","get","get"]\n[[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]', output: "[null,null,null,1,null,-1,null,-1,3,4]" },
    ],
    constraints: ["1 <= capacity <= 3000", "0 <= key <= 10^4", "0 <= value <= 10^5", "At most 2 * 10^5 calls to get and put."],
    starterCode: {
      python: `class LRUCache:\n    def __init__(self, capacity):\n        pass\n\n    def get(self, key):\n        pass\n\n    def put(self, key, value):\n        pass`,
      javascript: `class LRUCache {\n  constructor(capacity) {\n\n  }\n  get(key) {\n\n  }\n  put(key, value) {\n\n  }\n}`,
      typescript: `class LRUCache {\n  constructor(capacity: number) {\n    throw new Error("Not implemented");\n  }\n  get(key: number): number {\n    throw new Error("Not implemented");\n  }\n  put(key: number, value: number): void {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class LRUCache {\n    public LRUCache(int capacity) {\n        \n    }\n    public int get(int key) {\n        return -1;\n    }\n    public void put(int key, int value) {\n        \n    }\n}`,
      cpp: `class LRUCache {\npublic:\n    LRUCache(int capacity) {\n        \n    }\n    int get(int key) {\n        return -1;\n    }\n    void put(int key, int value) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { capacity: 2, operations: [["put",1,1],["put",2,2],["get",1],["put",3,3],["get",2],["put",4,4],["get",1],["get",3],["get",4]] }, expectedOutput: [1,-1,-1,3,4] },
    ],
    hiddentestcases: [
      { input: { capacity: 1, operations: [["put",1,1],["get",1],["put",2,2],["get",1],["get",2]] }, expectedOutput: [1,-1,2] },
    ],
  },

  {
    id: 64,
    title: "Intersection of Two Linked Lists",
    slug: "intersection-of-two-linked-lists",
    functionName: "getIntersectionNode",
    difficulty: "Easy",
    topic: "Linked List",
    pattern: "two pointers length equalization",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given the heads of two singly linked-lists headA and headB, return the node at which the two lists intersect. If no intersection, return null. Use O(1) memory.",
    examples: [
      { input: "intersectVal = 8, listA = [4,1,8,4,5], listB = [5,6,1,8,4,5]", output: "Intersected at 8" },
      { input: "intersectVal = 0, listA = [2,6,4], listB = [1,5]", output: "No intersection" },
    ],
    constraints: ["1 <= m, n <= 3 * 10^4"],
    starterCode: {
      python: `class Solution:\n    def getIntersectionNode(self, headA, headB):\n        pass`,
      javascript: `function getIntersectionNode(headA, headB) {\n\n}`,
      typescript: `function getIntersectionNode(headA: any, headB: any): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public ListNode getIntersectionNode(ListNode headA, ListNode headB) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    ListNode *getIntersectionNode(ListNode *headA, ListNode *headB) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { listA: [4,1,8,4,5], listB: [5,6,1,8,4,5], intersectVal: 8, skipA: 2, skipB: 3 }, expectedOutput: 8 },
      { input: { listA: [2,6,4], listB: [1,5], intersectVal: 0, skipA: 3, skipB: 2 }, expectedOutput: null },
    ],
    hiddentestcases: [
      { input: { listA: [1], listB: [1], intersectVal: 1, skipA: 0, skipB: 0 }, expectedOutput: 1 },
    ],
  },

  {
    id: 65,
    title: "Palindrome Linked List",
    slug: "palindrome-linked-list",
    functionName: "isPalindrome",
    difficulty: "Easy",
    topic: "Linked List",
    pattern: "slow-fast + reverse second half",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given the head of a singly linked list, return true if it is a palindrome, false otherwise. Solve in O(n) time and O(1) space.",
    examples: [
      { input: "head = [1,2,2,1]", output: "true" },
      { input: "head = [1,2]", output: "false" },
    ],
    constraints: ["1 <= n <= 10^5", "0 <= Node.val <= 9"],
    starterCode: {
      python: `class Solution:\n    def isPalindrome(self, head):\n        pass`,
      javascript: `function isPalindrome(head) {\n\n}`,
      typescript: `function isPalindrome(head: any): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isPalindrome(ListNode head) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isPalindrome(ListNode* head) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { head: [1,2,2,1] }, expectedOutput: true },
      { input: { head: [1,2] }, expectedOutput: false },
      { input: { head: [1] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { head: [1,2,3,2,1] }, expectedOutput: true },
      { input: { head: [1,0,0] }, expectedOutput: false },
    ],
  },

  // ── BATCH 037: Trees II (IDs 66-70) ───────────────────────────────────────

  {
    id: 66,
    title: "Binary Tree Level Order Traversal",
    slug: "binary-tree-level-order-traversal",
    functionName: "levelOrder",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "BFS queue",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook", "Google"],
    description: "Given the root of a binary tree, return the level order traversal of its nodes' values (i.e., from left to right, level by level).",
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "[[3],[9,20],[15,7]]" },
      { input: "root = [1]", output: "[[1]]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: ["0 <= n <= 2000", "-1000 <= Node.val <= 1000"],
    starterCode: {
      python: `class Solution:\n    def levelOrder(self, root):\n        pass`,
      javascript: `function levelOrder(root) {\n\n}`,
      typescript: `function levelOrder(root: any): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> levelOrder(TreeNode root) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> levelOrder(TreeNode* root) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { root: [3,9,20,null,null,15,7] }, expectedOutput: [[3],[9,20],[15,7]] },
      { input: { root: [1] }, expectedOutput: [[1]] },
      { input: { root: [] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { root: [1,2,3,4,5] }, expectedOutput: [[1],[2,3],[4,5]] },
      { input: { root: [0] }, expectedOutput: [[0]] },
    ],
  },

  {
    id: 67,
    title: "Lowest Common Ancestor of BST",
    slug: "lowest-common-ancestor-of-bst",
    functionName: "lowestCommonAncestor",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "BST property traversal",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Microsoft"],
    description: "Given a BST, find the lowest common ancestor (LCA) of two given nodes p and q. The LCA is the lowest node that has both p and q as descendants (a node can be a descendant of itself).",
    examples: [
      { input: "root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 8", output: "6" },
      { input: "root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 4", output: "2" },
    ],
    constraints: ["2 <= n <= 10^5", "-10^9 <= Node.val <= 10^9", "All Node.val are unique.", "p != q, both exist in the BST."],
    starterCode: {
      python: `class Solution:\n    def lowestCommonAncestor(self, root, p, q):\n        pass`,
      javascript: `function lowestCommonAncestor(root, p, q) {\n\n}`,
      typescript: `function lowestCommonAncestor(root: any, p: any, q: any): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { root: [6,2,8,0,4,7,9,null,null,3,5], p: 2, q: 8 }, expectedOutput: 6 },
      { input: { root: [6,2,8,0,4,7,9,null,null,3,5], p: 2, q: 4 }, expectedOutput: 2 },
      { input: { root: [2,1], p: 2, q: 1 }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { root: [6,2,8], p: 2, q: 8 }, expectedOutput: 6 },
      { input: { root: [3,1,4,null,2], p: 1, q: 4 }, expectedOutput: 3 },
    ],
  },

  {
    id: 68,
    title: "Construct Binary Tree from Preorder and Inorder Traversal",
    slug: "construct-binary-tree-from-preorder-inorder",
    functionName: "buildTree",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "divide and conquer recursion",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Google"],
    description: "Given two integer arrays preorder and inorder where preorder is the preorder traversal and inorder is the inorder traversal of the same tree, construct and return the binary tree.",
    examples: [
      { input: "preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]", output: "[3,9,20,null,null,15,7]" },
      { input: "preorder = [-1], inorder = [-1]", output: "[-1]" },
    ],
    constraints: ["1 <= n <= 3000", "-3000 <= values <= 3000", "preorder and inorder have unique values."],
    starterCode: {
      python: `class Solution:\n    def buildTree(self, preorder, inorder):\n        pass`,
      javascript: `function buildTree(preorder, inorder) {\n\n}`,
      typescript: `function buildTree(preorder: number[], inorder: number[]): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public TreeNode buildTree(int[] preorder, int[] inorder) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    TreeNode* buildTree(vector<int>& preorder, vector<int>& inorder) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { preorder: [3,9,20,15,7], inorder: [9,3,15,20,7] }, expectedOutput: [3,9,20,null,null,15,7] },
      { input: { preorder: [-1], inorder: [-1] }, expectedOutput: [-1] },
    ],
    hiddentestcases: [
      { input: { preorder: [1,2,3], inorder: [2,1,3] }, expectedOutput: [1,2,3] },
      { input: { preorder: [1,2], inorder: [2,1] }, expectedOutput: [1,2] },
    ],
  },

  {
    id: 69,
    title: "Serialize and Deserialize Binary Tree",
    slug: "serialize-deserialize-binary-tree",
    functionName: "serialize",
    difficulty: "Hard",
    topic: "Trees",
    pattern: "BFS serialization",
    sourceType: "core",
    companies: ["Facebook", "Google", "Amazon", "Microsoft"],
    description: "Design an algorithm to serialize and deserialize a binary tree. Serialization converts a tree to a string; deserialization reconstructs it. There is no restriction on your serialization/deserialization format.",
    examples: [
      { input: "root = [1,2,3,null,null,4,5]", output: "[1,2,3,null,null,4,5]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: ["0 <= n <= 10^4", "-1000 <= Node.val <= 1000"],
    starterCode: {
      python: `class Codec:\n    def serialize(self, root):\n        pass\n\n    def deserialize(self, data):\n        pass`,
      javascript: `function serialize(root) {\n\n}\nfunction deserialize(data) {\n\n}`,
      typescript: `function serialize(root: any): string {\n    throw new Error("Not implemented");\n}`,
      java: `public class Codec {\n    public String serialize(TreeNode root) {\n        return "";\n    }\n    public TreeNode deserialize(String data) {\n        return null;\n    }\n}`,
      cpp: `class Codec {\npublic:\n    string serialize(TreeNode* root) {\n        return "";\n    }\n    TreeNode* deserialize(string data) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { root: [1,2,3,null,null,4,5] }, expectedOutput: [1,2,3,null,null,4,5] },
      { input: { root: [] }, expectedOutput: [] },
      { input: { root: [1] }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { root: [1,2] }, expectedOutput: [1,2] },
      { input: { root: [1,null,2,null,3] }, expectedOutput: [1,null,2,null,3] },
    ],
  },

  {
    id: 70,
    title: "Binary Tree Right Side View",
    slug: "binary-tree-right-side-view",
    functionName: "rightSideView",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "BFS level order rightmost",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given the root of a binary tree, imagine yourself standing on the right side. Return the values of the nodes you can see ordered from top to bottom.",
    examples: [
      { input: "root = [1,2,3,null,5,null,4]", output: "[1,3,4]" },
      { input: "root = [1,null,3]", output: "[1,3]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: ["0 <= n <= 100", "-100 <= Node.val <= 100"],
    starterCode: {
      python: `class Solution:\n    def rightSideView(self, root):\n        pass`,
      javascript: `function rightSideView(root) {\n\n}`,
      typescript: `function rightSideView(root: any): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<Integer> rightSideView(TreeNode root) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> rightSideView(TreeNode* root) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { root: [1,2,3,null,5,null,4] }, expectedOutput: [1,3,4] },
      { input: { root: [1,null,3] }, expectedOutput: [1,3] },
      { input: { root: [] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { root: [1] }, expectedOutput: [1] },
      { input: { root: [1,2,3,4] }, expectedOutput: [1,3,4] },
    ],
  },

  // ── BATCH 038: Graphs (IDs 71-80) ─────────────────────────────────────────

  {
    id: 71,
    title: "Clone Graph",
    slug: "clone-graph",
    functionName: "cloneGraph",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "BFS/DFS with hash map",
    sourceType: "core",
    companies: ["Facebook", "Amazon", "Google"],
    description: "Given a reference of a node in a connected undirected graph, return a deep copy (clone) of the graph. Each node contains a value and a list of its neighbors.",
    examples: [
      { input: "adjList = [[2,4],[1,3],[2,4],[1,3]]", output: "[[2,4],[1,3],[2,4],[1,3]]" },
      { input: "adjList = [[]]", output: "[[]]" },
    ],
    constraints: ["0 <= n <= 100", "1 <= Node.val <= 100", "The graph is connected and undirected."],
    starterCode: {
      python: `class Solution:\n    def cloneGraph(self, node):\n        pass`,
      javascript: `function cloneGraph(node) {\n\n}`,
      typescript: `function cloneGraph(node: any): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public Node cloneGraph(Node node) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    Node* cloneGraph(Node* node) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { adjList: [[2,4],[1,3],[2,4],[1,3]] }, expectedOutput: [[2,4],[1,3],[2,4],[1,3]] },
      { input: { adjList: [[]] }, expectedOutput: [[]] },
      { input: { adjList: [] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { adjList: [[2],[1]] }, expectedOutput: [[2],[1]] },
    ],
  },

  {
    id: 72,
    title: "Course Schedule",
    slug: "course-schedule",
    functionName: "canFinish",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "topological sort / cycle detection",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description: "There are numCourses courses (0 to numCourses-1). Given prerequisites[i] = [ai, bi] meaning you must take bi before ai, return true if you can finish all courses (i.e., no cycle exists).",
    examples: [
      { input: "numCourses = 2, prerequisites = [[1,0]]", output: "true" },
      { input: "numCourses = 2, prerequisites = [[1,0],[0,1]]", output: "false" },
    ],
    constraints: ["1 <= numCourses <= 2000", "0 <= prerequisites.length <= 5000", "prerequisites[i].length == 2"],
    starterCode: {
      python: `class Solution:\n    def canFinish(self, numCourses, prerequisites):\n        pass`,
      javascript: `function canFinish(numCourses, prerequisites) {\n\n}`,
      typescript: `function canFinish(numCourses: number, prerequisites: number[][]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean canFinish(int numCourses, int[][] prerequisites) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { numCourses: 2, prerequisites: [[1,0]] }, expectedOutput: true },
      { input: { numCourses: 2, prerequisites: [[1,0],[0,1]] }, expectedOutput: false },
      { input: { numCourses: 1, prerequisites: [] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { numCourses: 3, prerequisites: [[1,0],[2,1]] }, expectedOutput: true },
      { input: { numCourses: 3, prerequisites: [[1,0],[0,2],[2,1]] }, expectedOutput: false },
    ],
  },

  {
    id: 73,
    title: "Pacific Atlantic Water Flow",
    slug: "pacific-atlantic-water-flow",
    functionName: "pacificAtlantic",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "multi-source BFS",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "Given an m×n matrix of non-negative integers representing heights, water can flow to adjacent cells (4 directions) with equal or lower height. Find all cells from which water can flow to both the Pacific ocean (top/left border) and Atlantic ocean (bottom/right border).",
    examples: [
      { input: "heights = [[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]", output: "[[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]" },
      { input: "heights = [[1]]", output: "[[0,0]]" },
    ],
    constraints: ["m == heights.length", "n == heights[r].length", "1 <= m, n <= 200", "0 <= heights[i][j] <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def pacificAtlantic(self, heights):\n        pass`,
      javascript: `function pacificAtlantic(heights) {\n\n}`,
      typescript: `function pacificAtlantic(heights: number[][]): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> pacificAtlantic(int[][] heights) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> pacificAtlantic(vector<vector<int>>& heights) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { heights: [[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]] }, expectedOutput: [[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]] },
      { input: { heights: [[1]] }, expectedOutput: [[0,0]] },
    ],
    hiddentestcases: [
      { input: { heights: [[1,1],[1,1]] }, expectedOutput: [[0,0],[0,1],[1,0],[1,1]] },
    ],
  },

  {
    id: 74,
    title: "Rotting Oranges",
    slug: "rotting-oranges",
    functionName: "orangesRotting",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "multi-source BFS",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google"],
    description: "In a grid: 0=empty, 1=fresh orange, 2=rotten orange. Every minute, rotten oranges make adjacent (4-dir) fresh oranges rotten. Return the minimum time until no fresh oranges remain, or -1 if impossible.",
    examples: [
      { input: "grid = [[2,1,1],[1,1,0],[0,1,1]]", output: "4" },
      { input: "grid = [[2,1,1],[0,1,1],[1,0,1]]", output: "-1" },
      { input: "grid = [[0,2]]", output: "0" },
    ],
    constraints: ["m == grid.length", "n == grid[i].length", "1 <= m, n <= 10", "grid[i][j] is 0, 1, or 2."],
    starterCode: {
      python: `class Solution:\n    def orangesRotting(self, grid):\n        pass`,
      javascript: `function orangesRotting(grid) {\n\n}`,
      typescript: `function orangesRotting(grid: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int orangesRotting(int[][] grid) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int orangesRotting(vector<vector<int>>& grid) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { grid: [[2,1,1],[1,1,0],[0,1,1]] }, expectedOutput: 4 },
      { input: { grid: [[2,1,1],[0,1,1],[1,0,1]] }, expectedOutput: -1 },
      { input: { grid: [[0,2]] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { grid: [[1]] }, expectedOutput: -1 },
      { input: { grid: [[2,2],[1,1],[0,0]] }, expectedOutput: 1 },
    ],
  },

  {
    id: 75,
    title: "Word Ladder",
    slug: "word-ladder",
    functionName: "ladderLength",
    difficulty: "Hard",
    topic: "Graphs",
    pattern: "BFS shortest path",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Microsoft", "Google"],
    description: "Given two words beginWord and endWord, and a dictionary wordList, return the number of words in the shortest transformation sequence from beginWord to endWord, where each adjacent pair differs by exactly one letter. Return 0 if no such sequence exists.",
    examples: [
      { input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]', output: "5" },
      { input: 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log"]', output: "0" },
    ],
    constraints: ["1 <= beginWord.length <= 10", "beginWord.length == endWord.length", "1 <= wordList.length <= 5000", "All words consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def ladderLength(self, beginWord, endWord, wordList):\n        pass`,
      javascript: `function ladderLength(beginWord, endWord, wordList) {\n\n}`,
      typescript: `function ladderLength(beginWord: string, endWord: string, wordList: string[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int ladderLength(String beginWord, String endWord, List<String> wordList) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {\n        return 0;\n    }\n};`,
      c: `int ladderLength(char* beginWord, char* endWord, char** wordList, int wordListSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { beginWord: "hit", endWord: "cog", wordList: ["hot","dot","dog","lot","log","cog"] }, expectedOutput: 5 },
      { input: { beginWord: "hit", endWord: "cog", wordList: ["hot","dot","dog","lot","log"] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { beginWord: "a", endWord: "c", wordList: ["a","b","c"] }, expectedOutput: 2 },
    ],
  },

  // ── BATCH 038: Dynamic Programming II (IDs 76-80) ─────────────────────────

  {
    id: 76,
    title: "Unique Paths",
    slug: "unique-paths",
    functionName: "uniquePaths",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "2D DP grid",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft"],
    description: "A robot is on an m x n grid at top-left. It can only move right or down. How many unique paths are there to reach the bottom-right corner?",
    examples: [
      { input: "m = 3, n = 7", output: "28" },
      { input: "m = 3, n = 2", output: "3" },
    ],
    constraints: ["1 <= m, n <= 100"],
    starterCode: {
      python: `class Solution:\n    def uniquePaths(self, m, n):\n        pass`,
      javascript: `function uniquePaths(m, n) {\n\n}`,
      typescript: `function uniquePaths(m: number, n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int uniquePaths(int m, int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int uniquePaths(int m, int n) {\n        return 0;\n    }\n};`,
      c: `int uniquePaths(int m, int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { m: 3, n: 7 }, expectedOutput: 28 },
      { input: { m: 3, n: 2 }, expectedOutput: 3 },
      { input: { m: 1, n: 1 }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { m: 7, n: 3 }, expectedOutput: 28 },
      { input: { m: 2, n: 2 }, expectedOutput: 2 },
    ],
  },

  {
    id: 77,
    title: "Longest Increasing Subsequence",
    slug: "longest-increasing-subsequence",
    functionName: "lengthOfLIS",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "patience sorting / binary search DP",
    sourceType: "core",
    companies: ["Microsoft", "Amazon", "Google", "Facebook"],
    description: "Given an integer array nums, return the length of the longest strictly increasing subsequence.",
    examples: [
      { input: "nums = [10,9,2,5,3,7,101,18]", output: "4", explanation: "[2,3,7,101]" },
      { input: "nums = [0,1,0,3,2,3]", output: "4" },
      { input: "nums = [7,7,7,7]", output: "1" },
    ],
    constraints: ["1 <= nums.length <= 2500", "-10^4 <= nums[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def lengthOfLIS(self, nums):\n        pass`,
      javascript: `function lengthOfLIS(nums) {\n\n}`,
      typescript: `function lengthOfLIS(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int lengthOfLIS(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int lengthOfLIS(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int lengthOfLIS(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [10,9,2,5,3,7,101,18] }, expectedOutput: 4 },
      { input: { nums: [0,1,0,3,2,3] }, expectedOutput: 4 },
      { input: { nums: [7,7,7,7] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums: [1] }, expectedOutput: 1 },
      { input: { nums: [3,5,6,2,5,4,19,5,6,7,12] }, expectedOutput: 6 },
    ],
  },

  {
    id: 78,
    title: "Edit Distance",
    slug: "edit-distance",
    functionName: "minDistance",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "2D DP string",
    sourceType: "core",
    companies: ["Google", "Amazon", "Microsoft", "Facebook"],
    description: "Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2. Operations: insert a character, delete a character, replace a character.",
    examples: [
      { input: 'word1 = "horse", word2 = "ros"', output: "3" },
      { input: 'word1 = "intention", word2 = "execution"', output: "5" },
    ],
    constraints: ["0 <= word1.length, word2.length <= 500", "word1 and word2 consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def minDistance(self, word1, word2):\n        pass`,
      javascript: `function minDistance(word1, word2) {\n\n}`,
      typescript: `function minDistance(word1: string, word2: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int minDistance(String word1, String word2) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int minDistance(string word1, string word2) {\n        return 0;\n    }\n};`,
      c: `int minDistance(char* word1, char* word2) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { word1: "horse", word2: "ros" }, expectedOutput: 3 },
      { input: { word1: "intention", word2: "execution" }, expectedOutput: 5 },
      { input: { word1: "", word2: "a" }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { word1: "abc", word2: "abc" }, expectedOutput: 0 },
      { input: { word1: "abc", word2: "" }, expectedOutput: 3 },
    ],
  },

  {
    id: 79,
    title: "Partition Equal Subset Sum",
    slug: "partition-equal-subset-sum",
    functionName: "canPartition",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "0/1 knapsack",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given an integer array nums, return true if you can partition it into two subsets such that the sum of elements in both subsets is equal.",
    examples: [
      { input: "nums = [1,5,11,5]", output: "true", explanation: "[1,5,5] and [11]" },
      { input: "nums = [1,2,3,5]", output: "false" },
    ],
    constraints: ["1 <= nums.length <= 200", "1 <= nums[i] <= 100"],
    starterCode: {
      python: `class Solution:\n    def canPartition(self, nums):\n        pass`,
      javascript: `function canPartition(nums) {\n\n}`,
      typescript: `function canPartition(nums: number[]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean canPartition(int[] nums) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool canPartition(vector<int>& nums) {\n        return false;\n    }\n};`,
      c: `bool canPartition(int* nums, int numsSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { nums: [1,5,11,5] }, expectedOutput: true },
      { input: { nums: [1,2,3,5] }, expectedOutput: false },
      { input: { nums: [2,2] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { nums: [1,1] }, expectedOutput: true },
      { input: { nums: [1,2,5] }, expectedOutput: false },
    ],
  },

  {
    id: 80,
    title: "Burst Balloons",
    slug: "burst-balloons",
    functionName: "maxCoins",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "interval DP",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "You have n balloons, indexed 0 to n-1. Each balloon is painted with a number nums[i]. Burst a balloon to earn nums[i-1] * nums[i] * nums[i+1] coins. After bursting, adjacent balloons become neighbors. Return the maximum coins you can collect by bursting all balloons.",
    examples: [
      { input: "nums = [3,1,5,8]", output: "167", explanation: "Burst 1→5→3→8: 3*1*5 + 3*5*8 + 1*3*8 + 1*8*1 = 167" },
      { input: "nums = [1,5]", output: "10" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 300", "0 <= nums[i] <= 100"],
    starterCode: {
      python: `class Solution:\n    def maxCoins(self, nums):\n        pass`,
      javascript: `function maxCoins(nums) {\n\n}`,
      typescript: `function maxCoins(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxCoins(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxCoins(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int maxCoins(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [3,1,5,8] }, expectedOutput: 167 },
      { input: { nums: [1,5] }, expectedOutput: 10 },
      { input: { nums: [1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums: [7,9,8,0,7,1,3,5,5,2,3] }, expectedOutput: 1654 },
    ],
  },

  // ── BATCH 039: Heap / Priority Queue (IDs 81-90) ─────────────────────────

  {
    id: 81,
    title: "Top K Frequent Elements",
    slug: "top-k-frequent-elements",
    functionName: "topKFrequent",
    // Description says "return the answer in any order" — see audit P0-3.
    comparisonMode: "unordered",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "bucket sort / heap",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description: "Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order. Your solution must be better than O(n log n).",
    examples: [
      { input: "nums = [1,1,1,2,2,3], k = 2", output: "[1,2]" },
      { input: "nums = [1], k = 1", output: "[1]" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4", "k is in the range [1, the number of unique elements in the array]."],
    starterCode: {
      python: `class Solution:\n    def topKFrequent(self, nums, k):\n        pass`,
      javascript: `function topKFrequent(nums, k) {\n\n}`,
      typescript: `function topKFrequent(nums: number[], k: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] topKFrequent(int[] nums, int k) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> topKFrequent(vector<int>& nums, int k) {\n        return {};\n    }\n};`,
      c: `int* topKFrequent(int* nums, int numsSize, int k, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { nums: [1,1,1,2,2,3], k: 2 }, expectedOutput: [1,2] },
      { input: { nums: [1], k: 1 }, expectedOutput: [1] },
      { input: { nums: [4,4,2,2,3], k: 2 }, expectedOutput: [4,2] },
    ],
    hiddentestcases: [
      { input: { nums: [1,2], k: 2 }, expectedOutput: [1,2] },
      { input: { nums: [5,5,5,3,3,1], k: 1 }, expectedOutput: [5] },
    ],
  },

  {
    id: 82,
    title: "Find Median from Data Stream",
    slug: "find-median-from-data-stream",
    functionName: "MedianFinder",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "returningOnly" },
    difficulty: "Hard",
    topic: "Heap",
    pattern: "two heaps (max-heap + min-heap)",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft", "Facebook"],
    description: "Implement MedianFinder that supports: addNum(int num) — adds an integer, and findMedian() — returns the median of current elements. If even count, median = average of two middles.",
    examples: [
      { input: '["MedianFinder","addNum","addNum","findMedian","addNum","findMedian"]\n[[],[1],[2],[],[3],[]]', output: "[null,null,null,1.5,null,2.0]" },
    ],
    constraints: ["-10^5 <= num <= 10^5", "At most 5 * 10^4 calls to addNum and findMedian.", "findMedian called after at least one addNum."],
    starterCode: {
      python: `class MedianFinder:\n    def __init__(self):\n        pass\n\n    def addNum(self, num):\n        pass\n\n    def findMedian(self):\n        pass`,
      javascript: `class MedianFinder {\n  constructor() {}\n  addNum(num) {}\n  findMedian() {}\n}`,
      typescript: `class MedianFinder {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  addNum(num: number): void {\n    throw new Error("Not implemented");\n  }\n  findMedian(): number {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MedianFinder {\n    public MedianFinder() {}\n    public void addNum(int num) {}\n    public double findMedian() { return 0.0; }\n}`,
      cpp: `class MedianFinder {\npublic:\n    MedianFinder() {}\n    void addNum(int num) {}\n    double findMedian() { return 0.0; }\n};`,
    },
    testcases: [
      { input: { ops: ["addNum","addNum","findMedian","addNum","findMedian"], vals: [[1],[2],[],[3],[]] }, expectedOutput: [1.5, 2.0] },
    ],
    hiddentestcases: [
      { input: { ops: ["addNum","findMedian"], vals: [[1],[]] }, expectedOutput: [1.0] },
      { input: { ops: ["addNum","addNum","findMedian"], vals: [[2],[3],[]] }, expectedOutput: [2.5] },
    ],
  },

  {
    id: 83,
    title: "K Closest Points to Origin",
    slug: "k-closest-points-to-origin",
    functionName: "kClosest",
    // Description says "you may return the answer in any order" — audit P0-3.
    comparisonMode: "unordered",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "max-heap of size k",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google"],
    description: "Given an array of points where points[i] = [xi, yi] represents a point on the X-Y plane and an integer k, return the k closest points to the origin (0,0). The distance is Euclidean. You may return the answer in any order.",
    examples: [
      { input: "points = [[1,3],[-2,2]], k = 1", output: "[[-2,2]]" },
      { input: "points = [[3,3],[5,-1],[-2,4]], k = 2", output: "[[3,3],[-2,4]]" },
    ],
    constraints: ["1 <= k <= points.length <= 10^4", "-10^4 <= xi, yi <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def kClosest(self, points, k):\n        pass`,
      javascript: `function kClosest(points, k) {\n\n}`,
      typescript: `function kClosest(points: number[][], k: number): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[][] kClosest(int[][] points, int k) {\n        return new int[][]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> kClosest(vector<vector<int>>& points, int k) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { points: [[1,3],[-2,2]], k: 1 }, expectedOutput: [[-2,2]] },
      { input: { points: [[3,3],[5,-1],[-2,4]], k: 2 }, expectedOutput: [[3,3],[-2,4]] },
      { input: { points: [[0,1],[1,0]], k: 2 }, expectedOutput: [[0,1],[1,0]] },
    ],
    hiddentestcases: [
      { input: { points: [[0,0],[1,1]], k: 1 }, expectedOutput: [[0,0]] },
      { input: { points: [[-5,4],[-6,-5],[4,6]], k: 2 }, expectedOutput: [[-5,4],[4,6]] },
    ],
  },

  {
    id: 84,
    title: "Task Scheduler",
    slug: "task-scheduler",
    functionName: "leastInterval",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "greedy with max-heap",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given a list of CPU tasks (A-Z) and an integer n (cooldown between same tasks), return the minimum number of intervals (including idles) needed to complete all tasks.",
    examples: [
      { input: 'tasks = ["A","A","A","B","B","B"], n = 2', output: "8", explanation: "A->B->idle->A->B->idle->A->B" },
      { input: 'tasks = ["A","A","A","B","B","B"], n = 0', output: "6" },
    ],
    constraints: ["1 <= tasks.length <= 10^4", "tasks[i] is an uppercase English letter.", "0 <= n <= 100"],
    starterCode: {
      python: `class Solution:\n    def leastInterval(self, tasks, n):\n        pass`,
      javascript: `function leastInterval(tasks, n) {\n\n}`,
      typescript: `function leastInterval(tasks: string[], n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int leastInterval(char[] tasks, int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int leastInterval(vector<char>& tasks, int n) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { tasks: ["A","A","A","B","B","B"], n: 2 }, expectedOutput: 8 },
      { input: { tasks: ["A","A","A","B","B","B"], n: 0 }, expectedOutput: 6 },
      { input: { tasks: ["A","A","A","A","A","A","B","C","D","E","F","G"], n: 2 }, expectedOutput: 16 },
    ],
    hiddentestcases: [
      { input: { tasks: ["A"], n: 5 }, expectedOutput: 1 },
      { input: { tasks: ["A","A","B","B"], n: 2 }, expectedOutput: 5 },
    ],
  },

  {
    id: 85,
    title: "Merge K Sorted Lists",
    slug: "merge-k-sorted-lists",
    functionName: "mergeKLists",
    difficulty: "Hard",
    topic: "Heap",
    pattern: "min-heap / divide and conquer",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft", "Facebook"],
    description: "You are given an array of k linked-lists lists, each sorted in ascending order. Merge all the linked lists into one sorted linked list and return it.",
    examples: [
      { input: "lists = [[1,4,5],[1,3,4],[2,6]]", output: "[1,1,2,3,4,4,5,6]" },
      { input: "lists = []", output: "[]" },
      { input: "lists = [[]]", output: "[]" },
    ],
    constraints: ["k == lists.length", "0 <= k <= 10^4", "0 <= lists[i].length <= 500", "-10^4 <= lists[i][j] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def mergeKLists(self, lists):\n        pass`,
      javascript: `function mergeKLists(lists) {\n\n}`,
      typescript: `function mergeKLists(lists: any): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public ListNode mergeKLists(ListNode[] lists) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    ListNode* mergeKLists(vector<ListNode*>& lists) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { lists: [[1,4,5],[1,3,4],[2,6]] }, expectedOutput: [1,1,2,3,4,4,5,6] },
      { input: { lists: [] }, expectedOutput: [] },
      { input: { lists: [[]] }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { lists: [[1],[2],[3]] }, expectedOutput: [1,2,3] },
      { input: { lists: [[-1,0,5],[2,4]] }, expectedOutput: [-1,0,2,4,5] },
    ],
  },

  // ── BATCH 039: Binary Search II (IDs 86-90) ────────────────────────────────

  {
    id: 86,
    title: "Search a 2D Matrix",
    slug: "search-a-2d-matrix",
    functionName: "searchMatrix",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "treat matrix as sorted array",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given an m x n matrix where each row is sorted left to right and the first integer of each row is greater than the last of the previous row, return true if target exists in the matrix.",
    examples: [
      { input: "matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 3", output: "true" },
      { input: "matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 13", output: "false" },
    ],
    constraints: ["m == matrix.length", "n == matrix[i].length", "1 <= m, n <= 100", "-10^4 <= matrix[i][j], target <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def searchMatrix(self, matrix, target):\n        pass`,
      javascript: `function searchMatrix(matrix, target) {\n\n}`,
      typescript: `function searchMatrix(matrix: number[][], target: number): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean searchMatrix(int[][] matrix, int target) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool searchMatrix(vector<vector<int>>& matrix, int target) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { matrix: [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target: 3 }, expectedOutput: true },
      { input: { matrix: [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target: 13 }, expectedOutput: false },
      { input: { matrix: [[1]], target: 1 }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { matrix: [[1,3]], target: 3 }, expectedOutput: true },
      { input: { matrix: [[1,3]], target: 2 }, expectedOutput: false },
    ],
  },

  {
    id: 87,
    title: "Koko Eating Bananas",
    slug: "koko-eating-bananas",
    functionName: "minEatingSpeed",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search on answer",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Koko can eat k bananas per hour. Given piles of bananas and h hours, find the minimum eating speed k such that she finishes all piles within h hours. Each hour she picks one pile and eats up to k bananas from it.",
    examples: [
      { input: "piles = [3,6,7,11], h = 8", output: "4" },
      { input: "piles = [30,11,23,4,20], h = 5", output: "30" },
      { input: "piles = [30,11,23,4,20], h = 6", output: "23" },
    ],
    constraints: ["1 <= piles.length <= 10^4", "piles.length <= h <= 10^9", "1 <= piles[i] <= 10^9"],
    starterCode: {
      python: `class Solution:\n    def minEatingSpeed(self, piles, h):\n        pass`,
      javascript: `function minEatingSpeed(piles, h) {\n\n}`,
      typescript: `function minEatingSpeed(piles: number[], h: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int minEatingSpeed(int[] piles, int h) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int minEatingSpeed(vector<int>& piles, int h) {\n        return 0;\n    }\n};`,
      c: `int minEatingSpeed(int* piles, int pilesSize, int h) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { piles: [3,6,7,11], h: 8 }, expectedOutput: 4 },
      { input: { piles: [30,11,23,4,20], h: 5 }, expectedOutput: 30 },
      { input: { piles: [30,11,23,4,20], h: 6 }, expectedOutput: 23 },
    ],
    hiddentestcases: [
      { input: { piles: [312884470], h: 312884469 }, expectedOutput: 2 },
      { input: { piles: [1,1,1,999999999], h: 10 }, expectedOutput: 142857143 },
    ],
  },

  {
    id: 88,
    title: "Time Based Key-Value Store",
    slug: "time-based-key-value-store",
    functionName: "TimeMap",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "returningOnly" },
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search on sorted timestamps",
    sourceType: "core",
    companies: ["Google", "Facebook", "Amazon"],
    description: "Design a time-based key-value data structure that stores multiple values for the same key at different timestamps. Implement TimeMap with: set(key, value, timestamp) and get(key, timestamp) which returns the value with the largest timestamp <= given timestamp, or \"\" if none.",
    examples: [
      { input: '["TimeMap","set","get","get","set","get","get"]\n[[],["foo","bar",1],["foo",1],["foo",3],["foo","bar2",4],["foo",4],["foo",5]]', output: '[null,null,"bar","bar",null,"bar2","bar2"]' },
    ],
    constraints: ["1 <= key.length, value.length <= 100", "1 <= timestamp <= 10^7", "All calls to set are made with strictly increasing timestamp values."],
    starterCode: {
      python: `class TimeMap:\n    def __init__(self):\n        pass\n\n    def set(self, key, value, timestamp):\n        pass\n\n    def get(self, key, timestamp):\n        pass`,
      javascript: `class TimeMap {\n  constructor() {}\n  set(key, value, timestamp) {}\n  get(key, timestamp) { return ""; }\n}`,
      typescript: `class TimeMap {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  set(key: string, value: string, timestamp: number): void {\n    throw new Error("Not implemented");\n  }\n  get(key: string, timestamp: number): string {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class TimeMap {\n    public TimeMap() {}\n    public void set(String key, String value, int timestamp) {}\n    public String get(String key, int timestamp) { return ""; }\n}`,
      cpp: `class TimeMap {\npublic:\n    TimeMap() {}\n    void set(string key, string value, int timestamp) {}\n    string get(string key, int timestamp) { return ""; }\n};`,
    },
    testcases: [
      { input: { ops: ["set","get","get","set","get","get"], vals: [["foo","bar",1],["foo",1],["foo",3],["foo","bar2",4],["foo",4],["foo",5]] }, expectedOutput: ["bar","bar","bar2","bar2"] },
    ],
    hiddentestcases: [
      { input: { ops: ["set","get","get"], vals: [["a","b",1],["a",1],["a",2]] }, expectedOutput: ["b","b"] },
    ],
  },

  {
    id: 89,
    title: "Median of Two Sorted Arrays",
    slug: "median-of-two-sorted-arrays",
    functionName: "findMedianSortedArrays",
    difficulty: "Hard",
    topic: "Binary Search",
    pattern: "binary search on partition",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft", "Facebook"],
    description: "Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays. The overall time complexity must be O(log(m+n)).",
    examples: [
      { input: "nums1 = [1,3], nums2 = [2]", output: "2.00000" },
      { input: "nums1 = [1,2], nums2 = [3,4]", output: "2.50000" },
    ],
    constraints: ["0 <= m, n <= 1000", "1 <= m + n", "-10^6 <= nums1[i], nums2[i] <= 10^6"],
    starterCode: {
      python: `class Solution:\n    def findMedianSortedArrays(self, nums1, nums2):\n        pass`,
      javascript: `function findMedianSortedArrays(nums1, nums2) {\n\n}`,
      typescript: `function findMedianSortedArrays(nums1: number[], nums2: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        return 0.0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n        return 0.0;\n    }\n};`,
      c: `double findMedianSortedArrays(int* nums1, int nums1Size, int* nums2, int nums2Size) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums1: [1,3], nums2: [2] }, expectedOutput: 2.0 },
      { input: { nums1: [1,2], nums2: [3,4] }, expectedOutput: 2.5 },
      { input: { nums1: [0,0], nums2: [0,0] }, expectedOutput: 0.0 },
    ],
    hiddentestcases: [
      { input: { nums1: [], nums2: [1] }, expectedOutput: 1.0 },
      { input: { nums1: [2], nums2: [] }, expectedOutput: 2.0 },
    ],
  },

  {
    id: 90,
    title: "Find Peak Element",
    slug: "find-peak-element",
    functionName: "findPeakElement",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search on peak condition",
    sourceType: "core",
    companies: ["Google", "Amazon", "Facebook"],
    description: "A peak element is an element strictly greater than its neighbors. Given an array, find a peak element and return its index. You may assume nums[-1] = nums[n] = -∞. You must run in O(log n) time.",
    examples: [
      { input: "nums = [1,2,3,1]", output: "2" },
      { input: "nums = [1,2,1,3,5,6,4]", output: "5" },
    ],
    constraints: ["1 <= nums.length <= 1000", "-2^31 <= nums[i] <= 2^31 - 1", "nums[i] != nums[i+1] for all valid i."],
    starterCode: {
      python: `class Solution:\n    def findPeakElement(self, nums):\n        pass`,
      javascript: `function findPeakElement(nums) {\n\n}`,
      typescript: `function findPeakElement(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findPeakElement(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findPeakElement(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int findPeakElement(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1,2,3,1] }, expectedOutput: 2 },
      { input: { nums: [1,2,1,3,5,6,4] }, expectedOutput: 5 },
      { input: { nums: [1] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [3,2,1] }, expectedOutput: 0 },
      { input: { nums: [1,2] }, expectedOutput: 1 },
    ],
  },

  // ── BATCH 040: Backtracking II (IDs 91-100) ───────────────────────────────

  {
    id: 91,
    title: "Permutations",
    slug: "permutations",
    functionName: "permute",
    // Description says "return the answer in any order" — audit P0-3.
    comparisonMode: "unordered",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "swap-based backtracking",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook"],
    description: "Given an array nums of distinct integers, return all the possible permutations. You can return the answer in any order.",
    examples: [
      { input: "nums = [1,2,3]", output: "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]" },
      { input: "nums = [0,1]", output: "[[0,1],[1,0]]" },
      { input: "nums = [1]", output: "[[1]]" },
    ],
    constraints: ["1 <= nums.length <= 6", "-10 <= nums[i] <= 10", "All integers in nums are unique."],
    starterCode: {
      python: `class Solution:\n    def permute(self, nums):\n        pass`,
      javascript: `function permute(nums) {\n\n}`,
      typescript: `function permute(nums: number[]): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> permute(int[] nums) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> permute(vector<int>& nums) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { nums: [1,2,3] }, expectedOutput: [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]] },
      { input: { nums: [0,1] }, expectedOutput: [[0,1],[1,0]] },
      { input: { nums: [1] }, expectedOutput: [[1]] },
    ],
    hiddentestcases: [
      { input: { nums: [1,2] }, expectedOutput: [[1,2],[2,1]] },
    ],
  },

  {
    id: 92,
    title: "Sudoku Solver",
    slug: "sudoku-solver",
    functionName: "solveSudoku",
    difficulty: "Hard",
    topic: "Backtracking",
    pattern: "constraint backtracking",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Google"],
    description: "Write a program to solve a Sudoku puzzle by filling the empty cells ('.'). A valid Sudoku must satisfy: each row, column, and 3x3 box contains the digits 1-9 without repetition.",
    examples: [
      { input: 'board = [["5","3",".",".","7",".",".",".","."],["6",".",".","1","9","5",".",".","."],[".","9","8",".",".",".",".","6","."],["8",".",".",".","6",".",".",".","3"],["4",".",".","8",".","3",".",".","1"],["7",".",".",".","2",".",".",".","6"],[".","6",".",".",".",".","2","8","."],[".",".",".","4","1","9",".",".","5"],[".",".",".",".","8",".",".","7","9"]]', output: "solved board" },
    ],
    constraints: ["board.length == 9", "board[i].length == 9", "board[i][j] is a digit or '.'."],
    starterCode: {
      python: `class Solution:\n    def solveSudoku(self, board):\n        pass`,
      javascript: `function solveSudoku(board) {\n\n}`,
      typescript: `function solveSudoku(board: string[][]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void solveSudoku(char[][] board) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void solveSudoku(vector<vector<char>>& board) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { board: [["5","3",".",".","7",".",".",".","."],["6",".",".","1","9","5",".",".","."],[".","9","8",".",".",".",".","6","."],["8",".",".",".","6",".",".",".","3"],["4",".",".","8",".","3",".",".","1"],["7",".",".",".","2",".",".",".","6"],[".","6",".",".",".",".","2","8","."],[".",".",".","4","1","9",".",".","5"],[".",".",".",".","8",".",".","7","9"]] }, expectedOutput: [["5","3","4","6","7","8","9","1","2"],["6","7","2","1","9","5","3","4","8"],["1","9","8","3","4","2","5","6","7"],["8","5","9","7","6","1","4","2","3"],["4","2","6","8","5","3","7","9","1"],["7","1","3","9","2","4","8","5","6"],["9","6","1","5","3","7","2","8","4"],["2","8","7","4","1","9","6","3","5"],["3","4","5","2","8","6","1","7","9"]] },
    ],
    hiddentestcases: [],
  },

  {
    id: 93,
    title: "Generate Parentheses",
    slug: "generate-parentheses",
    functionName: "generateParenthesis",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "DFS with open/close counters",
    sourceType: "core",
    companies: ["Amazon", "Google", "Facebook", "Microsoft"],
    description: "Given n pairs of parentheses, write a function to generate all combinations of well-formed parentheses.",
    examples: [
      { input: "n = 3", output: '["((()))","(()())","(())()","()(())","()()()"]' },
      { input: "n = 1", output: '["()"]' },
    ],
    constraints: ["1 <= n <= 8"],
    starterCode: {
      python: `class Solution:\n    def generateParenthesis(self, n):\n        pass`,
      javascript: `function generateParenthesis(n) {\n\n}`,
      typescript: `function generateParenthesis(n: number): string[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<String> generateParenthesis(int n) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<string> generateParenthesis(int n) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { n: 3 }, expectedOutput: ["((()))","(()())","(())()","()(())","()()()"] },
      { input: { n: 1 }, expectedOutput: ["()"] },
      { input: { n: 2 }, expectedOutput: ["(())","()()"] },
    ],
    hiddentestcases: [
      { input: { n: 4 }, expectedOutput: ["(((())))","((()()))","((())())","((()))()","(()(()))","(()()())","(()())()","(())(())","(())()()","()((())) ","()((()))","()(()())","()(())()","()()(())","()()()()"].map(s=>s.trim()) },
    ],
  },

  {
    id: 94,
    title: "Word Search",
    slug: "word-search",
    functionName: "exist",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "DFS grid backtracking",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook"],
    description: "Given an m x n grid of characters board and a string word, return true if word exists in the grid. The word can be constructed from letters of sequentially adjacent cells (horizontally or vertically). The same cell may not be used more than once.",
    examples: [
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"', output: "true" },
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "SEE"', output: "true" },
      { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCB"', output: "false" },
    ],
    constraints: ["m == board.length", "n == board[i].length", "1 <= m, n <= 6", "1 <= word.length <= 15"],
    starterCode: {
      python: `class Solution:\n    def exist(self, board, word):\n        pass`,
      javascript: `function exist(board, word) {\n\n}`,
      typescript: `function exist(board: string[][], word: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean exist(char[][] board, String word) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool exist(vector<vector<char>>& board, string word) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { board: [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word: "ABCCED" }, expectedOutput: true },
      { input: { board: [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word: "SEE" }, expectedOutput: true },
      { input: { board: [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word: "ABCB" }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { board: [["a"]], word: "a" }, expectedOutput: true },
      { input: { board: [["a","b"],["c","d"]], word: "abdc" }, expectedOutput: true },
    ],
  },

  {
    id: 95,
    title: "N-Queens",
    slug: "n-queens",
    functionName: "solveNQueens",
    difficulty: "Hard",
    topic: "Backtracking",
    pattern: "row-by-row constraint backtracking",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft"],
    description: "Place n queens on an n×n chessboard such that no two queens attack each other. Return all distinct solutions. Each solution contains a distinct board configuration where 'Q' indicates a queen and '.' indicates empty.",
    examples: [
      { input: "n = 4", output: '[[".Q..","...Q","Q...","..Q."],[ "..Q.","Q...","...Q",".Q.."]]' },
      { input: "n = 1", output: '[["Q"]]' },
    ],
    constraints: ["1 <= n <= 9"],
    starterCode: {
      python: `class Solution:\n    def solveNQueens(self, n):\n        pass`,
      javascript: `function solveNQueens(n) {\n\n}`,
      typescript: `function solveNQueens(n: number): string[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<String>> solveNQueens(int n) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<string>> solveNQueens(int n) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { n: 4 }, expectedOutput: [[".Q..","...Q","Q...","..Q."],["..Q.","Q...","...Q",".Q.."]] },
      { input: { n: 1 }, expectedOutput: [["Q"]] },
    ],
    hiddentestcases: [
      { input: { n: 2 }, expectedOutput: [] },
      { input: { n: 3 }, expectedOutput: [] },
    ],
  },

  // ── BATCH 040: Trie (IDs 96-100) ──────────────────────────────────────────

  {
    id: 96,
    title: "Implement Trie (Prefix Tree)",
    slug: "implement-trie",
    functionName: "Trie",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "returningOnly" },
    difficulty: "Medium",
    topic: "Trie",
    pattern: "trie insert/search/prefix",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft", "Facebook"],
    description: "Implement the Trie class with: insert(word), search(word) returning true if word is in the trie, and startsWith(prefix) returning true if any word starts with prefix.",
    examples: [
      { input: '["Trie","insert","search","search","startsWith","insert","search"]\n[[],["apple"],["apple"],["app"],["app"],["app"],["app"]]', output: "[null,null,true,false,true,null,true]" },
    ],
    constraints: ["1 <= word.length, prefix.length <= 2000", "All inputs consist of lowercase English letters.", "At most 3 * 10^4 calls to insert, search, and startsWith."],
    starterCode: {
      python: `class Trie:\n    def __init__(self):\n        pass\n\n    def insert(self, word):\n        pass\n\n    def search(self, word):\n        pass\n\n    def startsWith(self, prefix):\n        pass`,
      javascript: `class Trie {\n  constructor() {}\n  insert(word) {}\n  search(word) { return false; }\n  startsWith(prefix) { return false; }\n}`,
      typescript: `class Trie {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  insert(word: string): void {\n    throw new Error("Not implemented");\n  }\n  search(word: string): boolean {\n    throw new Error("Not implemented");\n  }\n  startsWith(prefix: string): boolean {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class Trie {\n    public Trie() {}\n    public void insert(String word) {}\n    public boolean search(String word) { return false; }\n    public boolean startsWith(String prefix) { return false; }\n}`,
      cpp: `class Trie {\npublic:\n    Trie() {}\n    void insert(string word) {}\n    bool search(string word) { return false; }\n    bool startsWith(string prefix) { return false; }\n};`,
    },
    testcases: [
      { input: { ops: ["insert","search","search","startsWith","insert","search"], vals: [["apple"],["apple"],["app"],["app"],["app"],["app"]] }, expectedOutput: [true,false,true,true] },
    ],
    hiddentestcases: [
      { input: { ops: ["insert","search","startsWith"], vals: [["hello"],["hello"],["hel"]] }, expectedOutput: [true,true] },
    ],
  },

  {
    id: 97,
    title: "Word Search II",
    slug: "word-search-ii",
    functionName: "findWords",
    difficulty: "Hard",
    topic: "Trie",
    pattern: "trie + DFS grid",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft"],
    description: "Given an m x n board of characters and a list of strings words, return all words on the board. Each word must be constructed from adjacent (4-dir) cells without reusing the same cell.",
    examples: [
      { input: 'board = [["o","a","a","n"],["e","t","a","e"],["i","h","k","r"],["i","f","l","v"]], words = ["oath","pea","eat","rain"]', output: '["eat","oath"]' },
    ],
    constraints: ["m == board.length", "n == board[i].length", "1 <= m, n <= 12", "1 <= words.length <= 3 * 10^4"],
    starterCode: {
      python: `class Solution:\n    def findWords(self, board, words):\n        pass`,
      javascript: `function findWords(board, words) {\n\n}`,
      typescript: `function findWords(board: string[][], words: string[]): string[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<String> findWords(char[][] board, String[] words) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<string> findWords(vector<vector<char>>& board, vector<string>& words) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { board: [["o","a","a","n"],["e","t","a","e"],["i","h","k","r"],["i","f","l","v"]], words: ["oath","pea","eat","rain"] }, expectedOutput: ["eat","oath"] },
      { input: { board: [["a","b"],["c","d"]], words: ["abdc","abcd"] }, expectedOutput: ["abdc"] },
    ],
    hiddentestcases: [
      { input: { board: [["a"]], words: ["a"] }, expectedOutput: ["a"] },
    ],
  },

  {
    id: 98,
    title: "Design Add and Search Words Data Structure",
    slug: "design-add-search-words",
    functionName: "WordDictionary",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "returningOnly" },
    difficulty: "Medium",
    topic: "Trie",
    pattern: "trie with wildcard DFS",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Implement WordDictionary with: addWord(word) and search(word) where word may contain '.' which matches any letter. Return true if the word matches any previously added word.",
    examples: [
      { input: '["WordDictionary","addWord","addWord","addWord","search","search","search","search"]\n[[],["bad"],["dad"],["mad"],["pad"],["bad"],[".ad"],["b.."]]', output: "[null,null,null,null,false,true,true,true]" },
    ],
    constraints: ["1 <= word.length <= 25", "word consists of lowercase letters or '.'", "At most 10^4 calls total."],
    starterCode: {
      python: `class WordDictionary:\n    def __init__(self):\n        pass\n\n    def addWord(self, word):\n        pass\n\n    def search(self, word):\n        pass`,
      javascript: `class WordDictionary {\n  constructor() {}\n  addWord(word) {}\n  search(word) { return false; }\n}`,
      typescript: `class WordDictionary {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  addWord(word: string): void {\n    throw new Error("Not implemented");\n  }\n  search(word: string): boolean {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class WordDictionary {\n    public WordDictionary() {}\n    public void addWord(String word) {}\n    public boolean search(String word) { return false; }\n}`,
      cpp: `class WordDictionary {\npublic:\n    WordDictionary() {}\n    void addWord(string word) {}\n    bool search(string word) { return false; }\n};`,
    },
    testcases: [
      { input: { ops: ["addWord","addWord","addWord","search","search","search","search"], vals: [["bad"],["dad"],["mad"],["pad"],["bad"],[".ad"],["b.."]] }, expectedOutput: [false,true,true,true] },
    ],
    hiddentestcases: [
      { input: { ops: ["addWord","search","search"], vals: [["a"],["a"],["."]] }, expectedOutput: [true,true] },
    ],
  },

  {
    id: 99,
    title: "Maximum XOR of Two Numbers in an Array",
    slug: "maximum-xor-of-two-numbers",
    functionName: "findMaximumXOR",
    difficulty: "Medium",
    topic: "Trie",
    pattern: "bit trie",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "Given an integer array nums, return the maximum result of nums[i] XOR nums[j], where 0 <= i <= j < n. Your solution must run in O(n) time.",
    examples: [
      { input: "nums = [3,10,5,25,2,8]", output: "28", explanation: "5 XOR 25 = 28" },
      { input: "nums = [14,70,53,83,49,91,36,80,92,51,66,70]", output: "127" },
    ],
    constraints: ["1 <= nums.length <= 2 * 10^5", "0 <= nums[i] <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def findMaximumXOR(self, nums):\n        pass`,
      javascript: `function findMaximumXOR(nums) {\n\n}`,
      typescript: `function findMaximumXOR(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findMaximumXOR(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findMaximumXOR(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int findMaximumXOR(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [3,10,5,25,2,8] }, expectedOutput: 28 },
      { input: { nums: [0] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [2,4] }, expectedOutput: 6 },
      { input: { nums: [14,70,53,83,49,91,36,80,92,51,66,70] }, expectedOutput: 127 },
    ],
  },

  {
    id: 100,
    title: "Replace Words",
    slug: "replace-words",
    functionName: "replaceWords",
    difficulty: "Medium",
    topic: "Trie",
    pattern: "trie prefix lookup",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given a dictionary of roots and a sentence, replace all successor words with the root that appears in the dictionary. If a word has multiple roots, replace it with the shortest root.",
    examples: [
      { input: 'dictionary = ["cat","bat","rat"], sentence = "the cattle was rattled by the battery"', output: '"the cat was rat by the bat"' },
      { input: 'dictionary = ["a","b","c"], sentence = "aadsfasf absbs bbab cadsfafs"', output: '"a a b c"' },
    ],
    constraints: ["1 <= dictionary.length <= 1000", "1 <= dictionary[i].length <= 100", "1 <= sentence.length <= 10^6"],
    starterCode: {
      python: `class Solution:\n    def replaceWords(self, dictionary, sentence):\n        pass`,
      javascript: `function replaceWords(dictionary, sentence) {\n\n}`,
      typescript: `function replaceWords(dictionary: string[], sentence: string): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String replaceWords(List<String> dictionary, String sentence) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string replaceWords(vector<string>& dictionary, string sentence) {\n        return "";\n    }\n};`,
      c: `char* replaceWords(char** dictionary, int dictionarySize, char* sentence) {\n    return "";\n}`,
    },
    testcases: [
      { input: { dictionary: ["cat","bat","rat"], sentence: "the cattle was rattled by the battery" }, expectedOutput: "the cat was rat by the bat" },
      { input: { dictionary: ["a","b","c"], sentence: "aadsfasf absbs bbab cadsfafs" }, expectedOutput: "a a b c" },
    ],
    hiddentestcases: [
      { input: { dictionary: ["e","b"], sentence: "eae ea ebee" }, expectedOutput: "e e e" },
    ],
  },

  // ── BATCH 041: Two Pointers / Sliding Window (IDs 101-110) ───────────────

  {
    id: 101,
    title: "4Sum",
    slug: "four-sum",
    functionName: "fourSum",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "sort + two nested loops + two pointers",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given an array nums of n integers and a target, return all unique quadruplets [a,b,c,d] such that a+b+c+d == target. The solution set must not contain duplicate quadruplets.",
    examples: [
      { input: "nums = [1,0,-1,0,-2,2], target = 0", output: "[[-2,-1,1,2],[-2,0,0,2],[-1,0,0,1]]" },
      { input: "nums = [2,2,2,2,2], target = 8", output: "[[2,2,2,2]]" },
    ],
    constraints: ["1 <= nums.length <= 200", "-10^9 <= nums[i] <= 10^9", "-10^9 <= target <= 10^9"],
    starterCode: {
      python: `class Solution:\n    def fourSum(self, nums, target):\n        pass`,
      javascript: `function fourSum(nums, target) {\n\n}`,
      typescript: `function fourSum(nums: number[], target: number): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> fourSum(int[] nums, int target) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> fourSum(vector<int>& nums, int target) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { nums: [1,0,-1,0,-2,2], target: 0 }, expectedOutput: [[-2,-1,1,2],[-2,0,0,2],[-1,0,0,1]] },
      { input: { nums: [2,2,2,2,2], target: 8 }, expectedOutput: [[2,2,2,2]] },
      { input: { nums: [0,0,0,0], target: 0 }, expectedOutput: [[0,0,0,0]] },
    ],
    hiddentestcases: [
      { input: { nums: [-1,0,1,2,-1,-4], target: -1 }, expectedOutput: [[-4,0,1,2],[-1,-1,0,1]] },
    ],
  },

  {
    id: 102,
    title: "Longest Repeating Character Replacement",
    slug: "longest-repeating-character-replacement",
    functionName: "characterReplacement",
    difficulty: "Medium",
    topic: "Sliding Window",
    pattern: "sliding window with max frequency",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given a string s and integer k, you can replace at most k characters. Return the length of the longest substring with repeating characters you can achieve.",
    examples: [
      { input: 's = "ABAB", k = 2', output: "4", explanation: "Replace 2 A's with B's or vice versa." },
      { input: 's = "AABABBA", k = 1', output: "4" },
    ],
    constraints: ["1 <= s.length <= 10^5", "s consists of uppercase English letters.", "0 <= k <= s.length"],
    starterCode: {
      python: `class Solution:\n    def characterReplacement(self, s, k):\n        pass`,
      javascript: `function characterReplacement(s, k) {\n\n}`,
      typescript: `function characterReplacement(s: string, k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int characterReplacement(String s, int k) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int characterReplacement(string s, int k) {\n        return 0;\n    }\n};`,
      c: `int characterReplacement(char* s, int k) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "ABAB", k: 2 }, expectedOutput: 4 },
      { input: { s: "AABABBA", k: 1 }, expectedOutput: 4 },
      { input: { s: "AAAA", k: 0 }, expectedOutput: 4 },
    ],
    hiddentestcases: [
      { input: { s: "A", k: 0 }, expectedOutput: 1 },
      { input: { s: "ABCDE", k: 1 }, expectedOutput: 2 },
    ],
  },

  {
    id: 103,
    title: "Permutation in String",
    slug: "permutation-in-string",
    functionName: "checkInclusion",
    difficulty: "Medium",
    topic: "Sliding Window",
    pattern: "fixed-window frequency match",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Google"],
    description: "Given two strings s1 and s2, return true if s2 contains a permutation of s1. In other words, return true if one of s1's permutations is a substring of s2.",
    examples: [
      { input: 's1 = "ab", s2 = "eidbaooo"', output: "true" },
      { input: 's1 = "ab", s2 = "eidboaoo"', output: "false" },
    ],
    constraints: ["1 <= s1.length, s2.length <= 10^4", "s1 and s2 consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def checkInclusion(self, s1, s2):\n        pass`,
      javascript: `function checkInclusion(s1, s2) {\n\n}`,
      typescript: `function checkInclusion(s1: string, s2: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean checkInclusion(String s1, String s2) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool checkInclusion(string s1, string s2) {\n        return false;\n    }\n};`,
      c: `bool checkInclusion(char* s1, char* s2) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s1: "ab", s2: "eidbaooo" }, expectedOutput: true },
      { input: { s1: "ab", s2: "eidboaoo" }, expectedOutput: false },
      { input: { s1: "adc", s2: "dcda" }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { s1: "hello", s2: "ooolleoooleh" }, expectedOutput: false },
      { input: { s1: "a", s2: "ab" }, expectedOutput: true },
    ],
  },

  {
    id: 104,
    title: "Fruit Into Baskets",
    slug: "fruit-into-baskets",
    functionName: "totalFruit",
    difficulty: "Medium",
    topic: "Sliding Window",
    pattern: "at most k distinct elements window",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "You have two baskets, each holding one type of fruit. Given an integer array fruits where fruits[i] is the type of fruit on tree i, return the maximum number of fruits you can pick starting from any tree, picking only 2 types.",
    examples: [
      { input: "fruits = [1,2,1]", output: "3" },
      { input: "fruits = [0,1,2,2]", output: "3" },
      { input: "fruits = [1,2,3,2,2]", output: "4" },
    ],
    constraints: ["1 <= fruits.length <= 10^5", "0 <= fruits[i] < fruits.length"],
    starterCode: {
      python: `class Solution:\n    def totalFruit(self, fruits):\n        pass`,
      javascript: `function totalFruit(fruits) {\n\n}`,
      typescript: `function totalFruit(fruits: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int totalFruit(int[] fruits) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int totalFruit(vector<int>& fruits) {\n        return 0;\n    }\n};`,
      c: `int totalFruit(int* fruits, int fruitsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { fruits: [1,2,1] }, expectedOutput: 3 },
      { input: { fruits: [0,1,2,2] }, expectedOutput: 3 },
      { input: { fruits: [1,2,3,2,2] }, expectedOutput: 4 },
    ],
    hiddentestcases: [
      { input: { fruits: [3,3,3,1,2,1,1,2,3,3,4] }, expectedOutput: 5 },
      { input: { fruits: [1] }, expectedOutput: 1 },
    ],
  },

  {
    id: 105,
    title: "Subarray Sum Equals K",
    slug: "subarray-sum-equals-k",
    functionName: "subarraySum",
    difficulty: "Medium",
    topic: "Hash Maps",
    pattern: "prefix sum + hash map",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description: "Given an array of integers nums and an integer k, return the total number of subarrays whose sum equals k.",
    examples: [
      { input: "nums = [1,1,1], k = 2", output: "2" },
      { input: "nums = [1,2,3], k = 3", output: "2" },
    ],
    constraints: ["1 <= nums.length <= 2 * 10^4", "-1000 <= nums[i] <= 1000", "-10^7 <= k <= 10^7"],
    starterCode: {
      python: `class Solution:\n    def subarraySum(self, nums, k):\n        pass`,
      javascript: `function subarraySum(nums, k) {\n\n}`,
      typescript: `function subarraySum(nums: number[], k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int subarraySum(int[] nums, int k) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int subarraySum(vector<int>& nums, int k) {\n        return 0;\n    }\n};`,
      c: `int subarraySum(int* nums, int numsSize, int k) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1,1,1], k: 2 }, expectedOutput: 2 },
      { input: { nums: [1,2,3], k: 3 }, expectedOutput: 2 },
      { input: { nums: [1], k: 0 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [-1,-1,1], k: 0 }, expectedOutput: 1 },
      { input: { nums: [1,2,1,2,1], k: 3 }, expectedOutput: 4 },
    ],
  },

  // ── BATCH 041: Greedy II (IDs 106-110) ────────────────────────────────────

  {
    id: 106,
    title: "Jump Game",
    slug: "jump-game",
    functionName: "canJump",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "greedy max reach",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Google"],
    description: "Given an integer array nums where nums[i] is your maximum jump length at position i, return true if you can reach the last index starting from index 0.",
    examples: [
      { input: "nums = [2,3,1,1,4]", output: "true" },
      { input: "nums = [3,2,1,0,4]", output: "false" },
    ],
    constraints: ["1 <= nums.length <= 10^4", "0 <= nums[i] <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def canJump(self, nums):\n        pass`,
      javascript: `function canJump(nums) {\n\n}`,
      typescript: `function canJump(nums: number[]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean canJump(int[] nums) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool canJump(vector<int>& nums) {\n        return false;\n    }\n};`,
      c: `bool canJump(int* nums, int numsSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { nums: [2,3,1,1,4] }, expectedOutput: true },
      { input: { nums: [3,2,1,0,4] }, expectedOutput: false },
      { input: { nums: [0] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { nums: [2,0,0] }, expectedOutput: true },
      { input: { nums: [1,0,1,0] }, expectedOutput: false },
    ],
  },

  {
    id: 107,
    title: "Gas Station",
    slug: "gas-station",
    functionName: "canCompleteCircuit",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "total tank check + start tracking",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "There are n gas stations in a circle. gas[i] is the gas at station i; cost[i] is the gas to travel to the next station. Starting with empty tank, find the starting station index if you can complete the circuit once, otherwise return -1. Guaranteed unique solution if it exists.",
    examples: [
      { input: "gas = [1,2,3,4,5], cost = [3,4,5,1,2]", output: "3" },
      { input: "gas = [2,3,4], cost = [3,4,3]", output: "-1" },
    ],
    constraints: ["n == gas.length == cost.length", "1 <= n <= 10^5", "0 <= gas[i], cost[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def canCompleteCircuit(self, gas, cost):\n        pass`,
      javascript: `function canCompleteCircuit(gas, cost) {\n\n}`,
      typescript: `function canCompleteCircuit(gas: number[], cost: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int canCompleteCircuit(int[] gas, int[] cost) {\n        return -1;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int canCompleteCircuit(vector<int>& gas, vector<int>& cost) {\n        return -1;\n    }\n};`,
      c: `int canCompleteCircuit(int* gas, int gasSize, int* cost, int costSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { gas: [1,2,3,4,5], cost: [3,4,5,1,2] }, expectedOutput: 3 },
      { input: { gas: [2,3,4], cost: [3,4,3] }, expectedOutput: -1 },
      { input: { gas: [5,1,2,3,4], cost: [4,4,1,5,1] }, expectedOutput: 4 },
    ],
    hiddentestcases: [
      { input: { gas: [1,2], cost: [2,1] }, expectedOutput: 1 },
      { input: { gas: [3,1,1], cost: [1,2,2] }, expectedOutput: 0 },
    ],
  },

  {
    id: 108,
    title: "Hand of Straights",
    slug: "hand-of-straights",
    functionName: "isNStraightHand",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "sorted frequency map",
    sourceType: "core",
    companies: ["Google"],
    description: "Given an array of integers hand and groupSize, return true if you can rearrange the cards into groups of groupSize consecutive cards.",
    examples: [
      { input: "hand = [1,2,3,6,2,3,4,7,8], groupSize = 3", output: "true" },
      { input: "hand = [1,2,3,4,5], groupSize = 4", output: "false" },
    ],
    constraints: ["1 <= hand.length <= 10^4", "0 <= hand[i] <= 10^9", "1 <= groupSize <= hand.length"],
    starterCode: {
      python: `class Solution:\n    def isNStraightHand(self, hand, groupSize):\n        pass`,
      javascript: `function isNStraightHand(hand, groupSize) {\n\n}`,
      typescript: `function isNStraightHand(hand: number[], groupSize: number): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isNStraightHand(int[] hand, int groupSize) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isNStraightHand(vector<int>& hand, int groupSize) {\n        return false;\n    }\n};`,
      c: `bool isNStraightHand(int* hand, int handSize, int groupSize) {\n    return false;\n}`,
    },
    testcases: [
      { input: { hand: [1,2,3,6,2,3,4,7,8], groupSize: 3 }, expectedOutput: true },
      { input: { hand: [1,2,3,4,5], groupSize: 4 }, expectedOutput: false },
      { input: { hand: [1,1,2,2,3,3], groupSize: 3 }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { hand: [8,10,12], groupSize: 3 }, expectedOutput: false },
      { input: { hand: [1,2,3], groupSize: 1 }, expectedOutput: true },
    ],
  },

  {
    id: 109,
    title: "Merge Intervals",
    slug: "merge-intervals",
    functionName: "merge",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "sort + linear merge",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description: "Given an array of intervals where intervals[i] = [start, end], merge all overlapping intervals and return an array of the non-overlapping intervals.",
    examples: [
      { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
      { input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]" },
    ],
    constraints: ["1 <= intervals.length <= 10^4", "intervals[i].length == 2", "0 <= starti <= endi <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def merge(self, intervals):\n        pass`,
      javascript: `function merge(intervals) {\n\n}`,
      typescript: `function merge(intervals: number[][]): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[][] merge(int[][] intervals) {\n        return new int[][]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> merge(vector<vector<int>>& intervals) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { intervals: [[1,3],[2,6],[8,10],[15,18]] }, expectedOutput: [[1,6],[8,10],[15,18]] },
      { input: { intervals: [[1,4],[4,5]] }, expectedOutput: [[1,5]] },
      { input: { intervals: [[1,4],[2,3]] }, expectedOutput: [[1,4]] },
    ],
    hiddentestcases: [
      { input: { intervals: [[1,4],[0,4]] }, expectedOutput: [[0,4]] },
      { input: { intervals: [[1,4],[0,0]] }, expectedOutput: [[0,0],[1,4]] },
    ],
  },

  {
    id: 110,
    title: "Non-overlapping Intervals",
    slug: "non-overlapping-intervals",
    functionName: "eraseOverlapIntervals",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "sort by end time + greedy keep",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google"],
    description: "Given an array of intervals, return the minimum number of intervals you need to remove to make the rest non-overlapping.",
    examples: [
      { input: "intervals = [[1,2],[2,3],[3,4],[1,3]]", output: "1", explanation: "Remove [1,3]." },
      { input: "intervals = [[1,2],[1,2],[1,2]]", output: "2" },
      { input: "intervals = [[1,2],[2,3]]", output: "0" },
    ],
    constraints: ["1 <= intervals.length <= 10^5", "intervals[i].length == 2", "-5 * 10^4 <= starti < endi <= 5 * 10^4"],
    starterCode: {
      python: `class Solution:\n    def eraseOverlapIntervals(self, intervals):\n        pass`,
      javascript: `function eraseOverlapIntervals(intervals) {\n\n}`,
      typescript: `function eraseOverlapIntervals(intervals: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int eraseOverlapIntervals(int[][] intervals) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int eraseOverlapIntervals(vector<vector<int>>& intervals) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { intervals: [[1,2],[2,3],[3,4],[1,3]] }, expectedOutput: 1 },
      { input: { intervals: [[1,2],[1,2],[1,2]] }, expectedOutput: 2 },
      { input: { intervals: [[1,2],[2,3]] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { intervals: [[-52,31],[-73,-26],[82,97],[-65,-11],[-62,-49],[95,99],[58,95],[-31,49],[66,98],[-63,2],[30,47],[-40,-26]] }, expectedOutput: 7 },
    ],
  },

  // ── BATCH 042: Math / Bit Manipulation (IDs 111-120) ─────────────────────

  {
    id: 111,
    title: "Counting Bits",
    slug: "counting-bits",
    functionName: "countBits",
    difficulty: "Easy",
    topic: "Bit Manipulation",
    pattern: "DP with bit shift",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given an integer n, return an array ans of length n + 1 such that for each i (0 <= i <= n), ans[i] is the number of 1's in the binary representation of i.",
    examples: [
      { input: "n = 2", output: "[0,1,1]" },
      { input: "n = 5", output: "[0,1,1,2,1,2]" },
    ],
    constraints: ["0 <= n <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def countBits(self, n):\n        pass`,
      javascript: `function countBits(n) {\n\n}`,
      typescript: `function countBits(n: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] countBits(int n) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> countBits(int n) {\n        return {};\n    }\n};`,
      c: `int* countBits(int n, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { n: 2 }, expectedOutput: [0,1,1] },
      { input: { n: 5 }, expectedOutput: [0,1,1,2,1,2] },
      { input: { n: 0 }, expectedOutput: [0] },
    ],
    hiddentestcases: [
      { input: { n: 1 }, expectedOutput: [0,1] },
      { input: { n: 8 }, expectedOutput: [0,1,1,2,1,2,2,3,1] },
    ],
  },

  {
    id: 112,
    title: "Reverse Bits",
    slug: "reverse-bits",
    functionName: "reverseBits",
    difficulty: "Easy",
    topic: "Bit Manipulation",
    pattern: "bit shift and mask",
    sourceType: "core",
    companies: ["Apple", "Amazon"],
    description: "Reverse bits of a given 32-bit unsigned integer and return the result.",
    examples: [
      { input: "n = 00000010100101000001111010011100", output: "964176192 (00111001011110000010100101000000)" },
      { input: "n = 11111111111111111111111111111101", output: "3221225471 (10111111111111111111111111111111)" },
    ],
    constraints: ["Input must be a binary string of length 32."],
    starterCode: {
      python: `class Solution:\n    def reverseBits(self, n):\n        pass`,
      javascript: `function reverseBits(n) {\n\n}`,
      typescript: `function reverseBits(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int reverseBits(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    uint32_t reverseBits(uint32_t n) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { n: 43261596 }, expectedOutput: 964176192 },
      { input: { n: 4294967293 }, expectedOutput: 3221225471 },
    ],
    hiddentestcases: [
      { input: { n: 0 }, expectedOutput: 0 },
      { input: { n: 1 }, expectedOutput: 2147483648 },
    ],
  },

  {
    id: 113,
    title: "Missing Number",
    slug: "missing-number",
    functionName: "missingNumber",
    difficulty: "Easy",
    topic: "Bit Manipulation",
    pattern: "XOR / Gauss sum",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Google"],
    description: "Given an array nums containing n distinct numbers in the range [0, n], return the only number in the range that is missing from the array.",
    examples: [
      { input: "nums = [3,0,1]", output: "2" },
      { input: "nums = [0,1]", output: "2" },
      { input: "nums = [9,6,4,2,3,5,7,0,1]", output: "8" },
    ],
    constraints: ["n == nums.length", "1 <= n <= 10^4", "0 <= nums[i] <= n", "All numbers are unique."],
    starterCode: {
      python: `class Solution:\n    def missingNumber(self, nums):\n        pass`,
      javascript: `function missingNumber(nums) {\n\n}`,
      typescript: `function missingNumber(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int missingNumber(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int missingNumber(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int missingNumber(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [3,0,1] }, expectedOutput: 2 },
      { input: { nums: [0,1] }, expectedOutput: 2 },
      { input: { nums: [9,6,4,2,3,5,7,0,1] }, expectedOutput: 8 },
    ],
    hiddentestcases: [
      { input: { nums: [0] }, expectedOutput: 1 },
      { input: { nums: [1] }, expectedOutput: 0 },
    ],
  },

  {
    id: 114,
    title: "Number of 1 Bits",
    slug: "number-of-1-bits",
    functionName: "hammingWeight",
    difficulty: "Easy",
    topic: "Bit Manipulation",
    pattern: "n & (n-1) trick",
    sourceType: "core",
    companies: ["Apple", "Microsoft"],
    description: "Write a function that takes the binary representation of a positive integer and returns the number of set bits (also known as the Hamming weight).",
    examples: [
      { input: "n = 11", output: "3", explanation: "Binary: 1011 — three '1' bits." },
      { input: "n = 128", output: "1", explanation: "Binary: 10000000" },
      { input: "n = 2147483645", output: "30" },
    ],
    constraints: ["1 <= n <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def hammingWeight(self, n):\n        pass`,
      javascript: `function hammingWeight(n) {\n\n}`,
      typescript: `function hammingWeight(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int hammingWeight(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int hammingWeight(uint32_t n) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { n: 11 }, expectedOutput: 3 },
      { input: { n: 128 }, expectedOutput: 1 },
      { input: { n: 2147483645 }, expectedOutput: 30 },
    ],
    hiddentestcases: [
      { input: { n: 1 }, expectedOutput: 1 },
      { input: { n: 7 }, expectedOutput: 3 },
    ],
  },

  {
    id: 115,
    title: "Sum of Two Integers",
    slug: "sum-of-two-integers",
    functionName: "getSum",
    difficulty: "Medium",
    topic: "Bit Manipulation",
    pattern: "bit manipulation add without +",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given two integers a and b, return the sum of the two integers without using the operators + and -.",
    examples: [
      { input: "a = 1, b = 2", output: "3" },
      { input: "a = 2, b = 3", output: "5" },
    ],
    constraints: ["-1000 <= a, b <= 1000"],
    starterCode: {
      python: `class Solution:\n    def getSum(self, a, b):\n        pass`,
      javascript: `function getSum(a, b) {\n\n}`,
      typescript: `function getSum(a: number, b: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int getSum(int a, int b) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int getSum(int a, int b) {\n        return 0;\n    }\n};`,
      c: `int getSum(int a, int b) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { a: 1, b: 2 }, expectedOutput: 3 },
      { input: { a: 2, b: 3 }, expectedOutput: 5 },
      { input: { a: -1, b: 1 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { a: -12, b: -8 }, expectedOutput: -20 },
      { input: { a: 0, b: 0 }, expectedOutput: 0 },
    ],
  },

  // ── BATCH 042: DP III / Math (IDs 116-120) ────────────────────────────────

  {
    id: 116,
    title: "Maximum Product Subarray",
    slug: "maximum-product-subarray",
    functionName: "maxProduct",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "track min and max simultaneously",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Flipkart"],
    description: "Given an integer array nums, find a contiguous subarray that has the largest product and return the product.",
    examples: [
      { input: "nums = [2,3,-2,4]", output: "6" },
      { input: "nums = [-2,0,-1]", output: "0" },
    ],
    constraints: ["1 <= nums.length <= 2 * 10^4", "-10 <= nums[i] <= 10", "The product of any subarray fits in a 32-bit integer."],
    starterCode: {
      python: `class Solution:\n    def maxProduct(self, nums):\n        pass`,
      javascript: `function maxProduct(nums) {\n\n}`,
      typescript: `function maxProduct(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxProduct(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxProduct(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int maxProduct(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [2,3,-2,4] }, expectedOutput: 6 },
      { input: { nums: [-2,0,-1] }, expectedOutput: 0 },
      { input: { nums: [-2] }, expectedOutput: -2 },
    ],
    hiddentestcases: [
      { input: { nums: [3,-1,4] }, expectedOutput: 4 },
      { input: { nums: [-3,-1,-1] }, expectedOutput: 3 },
    ],
  },

  {
    id: 117,
    title: "Longest Common Subsequence",
    slug: "longest-common-subsequence",
    functionName: "longestCommonSubsequence",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "2D DP string",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft"],
    description: "Given two strings text1 and text2, return the length of their longest common subsequence. A subsequence is a sequence derived from the string by deleting some (or no) characters without changing the order.",
    examples: [
      { input: 'text1 = "abcde", text2 = "ace"', output: "3" },
      { input: 'text1 = "abc", text2 = "abc"', output: "3" },
      { input: 'text1 = "abc", text2 = "def"', output: "0" },
    ],
    constraints: ["1 <= text1.length, text2.length <= 1000", "text1 and text2 consist only of lowercase English characters."],
    starterCode: {
      python: `class Solution:\n    def longestCommonSubsequence(self, text1, text2):\n        pass`,
      javascript: `function longestCommonSubsequence(text1, text2) {\n\n}`,
      typescript: `function longestCommonSubsequence(text1: string, text2: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int longestCommonSubsequence(String text1, String text2) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int longestCommonSubsequence(string text1, string text2) {\n        return 0;\n    }\n};`,
      c: `int longestCommonSubsequence(char* text1, char* text2) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { text1: "abcde", text2: "ace" }, expectedOutput: 3 },
      { input: { text1: "abc", text2: "abc" }, expectedOutput: 3 },
      { input: { text1: "abc", text2: "def" }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { text1: "bl", text2: "yby" }, expectedOutput: 1 },
      { input: { text1: "bsbininm", text2: "jmjkbkjkv" }, expectedOutput: 2 },
    ],
  },

  {
    id: 118,
    title: "Palindrome Partitioning",
    slug: "palindrome-partitioning",
    functionName: "partition",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "backtracking + palindrome check",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given a string s, partition s such that every substring of the partition is a palindrome. Return all possible palindrome partitioning of s.",
    examples: [
      { input: 's = "aab"', output: '[["a","a","b"],["aa","b"]]' },
      { input: 's = "a"', output: '[["a"]]' },
    ],
    constraints: ["1 <= s.length <= 16", "s contains only lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def partition(self, s):\n        pass`,
      javascript: `function partition(s) {\n\n}`,
      typescript: `function partition(s: string): string[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<String>> partition(String s) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<string>> partition(string s) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { s: "aab" }, expectedOutput: [["a","a","b"],["aa","b"]] },
      { input: { s: "a" }, expectedOutput: [["a"]] },
      { input: { s: "ab" }, expectedOutput: [["a","b"]] },
    ],
    hiddentestcases: [
      { input: { s: "aba" }, expectedOutput: [["a","b","a"],["aba"]] },
    ],
  },

  {
    id: 119,
    title: "House Robber II",
    slug: "house-robber-ii",
    functionName: "rob",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "circular DP — run twice",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft"],
    description: "Houses are arranged in a circle. You can't rob adjacent houses. Given nums representing the amount of money at each house, return the maximum you can rob without alerting police.",
    examples: [
      { input: "nums = [2,3,2]", output: "3" },
      { input: "nums = [1,2,3,1]", output: "4" },
      { input: "nums = [1,2,3]", output: "3" },
    ],
    constraints: ["1 <= nums.length <= 100", "0 <= nums[i] <= 1000"],
    starterCode: {
      python: `class Solution:\n    def rob(self, nums):\n        pass`,
      javascript: `function rob(nums) {\n\n}`,
      typescript: `function rob(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int rob(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int rob(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int rob(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [2,3,2] }, expectedOutput: 3 },
      { input: { nums: [1,2,3,1] }, expectedOutput: 4 },
      { input: { nums: [1,2,3] }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { nums: [0] }, expectedOutput: 0 },
      { input: { nums: [200,3,140,20,10] }, expectedOutput: 340 },
    ],
  },

  {
    id: 120,
    title: "Regular Expression Matching",
    slug: "regular-expression-matching",
    functionName: "isMatch",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "2D DP with * handling",
    sourceType: "core",
    companies: ["Google", "Facebook", "Amazon", "Microsoft"],
    description: "Given an input string s and a pattern p, implement regular expression matching with '.' (matches any character) and '*' (matches zero or more of the preceding element). The matching should cover the entire string.",
    examples: [
      { input: 's = "aa", p = "a"', output: "false" },
      { input: 's = "aa", p = "a*"', output: "true" },
      { input: 's = "ab", p = ".*"', output: "true" },
    ],
    constraints: ["1 <= s.length <= 20", "1 <= p.length <= 20", "s contains only lowercase English letters.", "p contains only lowercase English letters, '.', and '*'."],
    starterCode: {
      python: `class Solution:\n    def isMatch(self, s, p):\n        pass`,
      javascript: `function isMatch(s, p) {\n\n}`,
      typescript: `function isMatch(s: string, p: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isMatch(String s, String p) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isMatch(string s, string p) {\n        return false;\n    }\n};`,
      c: `bool isMatch(char* s, char* p) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "aa", p: "a" }, expectedOutput: false },
      { input: { s: "aa", p: "a*" }, expectedOutput: true },
      { input: { s: "ab", p: ".*" }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { s: "aab", p: "c*a*b" }, expectedOutput: true },
      { input: { s: "mississippi", p: "mis*is*p*." }, expectedOutput: false },
    ],
  },

  // ── BATCH 043: Stacks / Queues (IDs 121-130) ─────────────────────────────

  {
    id: 121,
    title: "Largest Rectangle in Histogram",
    slug: "largest-rectangle-in-histogram",
    functionName: "largestRectangleArea",
    difficulty: "Hard",
    topic: "Stacks",
    pattern: "monotonic stack",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google", "Microsoft"],
    description: "Given an array of integers heights representing the histogram's bar heights where each bar has a width of 1, return the area of the largest rectangle in the histogram.",
    examples: [
      { input: "heights = [2,1,5,6,2,3]", output: "10" },
      { input: "heights = [2,4]", output: "4" },
    ],
    constraints: ["1 <= heights.length <= 10^5", "0 <= heights[i] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def largestRectangleArea(self, heights):\n        pass`,
      javascript: `function largestRectangleArea(heights) {\n\n}`,
      typescript: `function largestRectangleArea(heights: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int largestRectangleArea(int[] heights) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int largestRectangleArea(vector<int>& heights) {\n        return 0;\n    }\n};`,
      c: `int largestRectangleArea(int* heights, int heightsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { heights: [2,1,5,6,2,3] }, expectedOutput: 10 },
      { input: { heights: [2,4] }, expectedOutput: 4 },
      { input: { heights: [1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { heights: [0,9] }, expectedOutput: 9 },
      { input: { heights: [6,7,5,2,4,5,9,3] }, expectedOutput: 16 },
    ],
  },

  {
    id: 122,
    title: "Car Fleet",
    slug: "car-fleet",
    functionName: "carFleet",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "sort + monotonic stack",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "n cars go to the same destination at target miles. position[i] and speed[i] are given. A car that catches a faster car becomes a fleet. Return the number of car fleets that will arrive at the destination.",
    examples: [
      { input: "target = 12, position = [10,8,0,5,3], speed = [2,4,1,1,3]", output: "3" },
      { input: "target = 10, position = [3], speed = [3]", output: "1" },
      { input: "target = 100, position = [0,2,4], speed = [4,2,1]", output: "1" },
    ],
    constraints: ["n == position.length == speed.length", "1 <= n <= 10^5", "0 < target <= 10^6"],
    starterCode: {
      python: `class Solution:\n    def carFleet(self, target, position, speed):\n        pass`,
      javascript: `function carFleet(target, position, speed) {\n\n}`,
      typescript: `function carFleet(target: number, position: number[], speed: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int carFleet(int target, int[] position, int[] speed) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int carFleet(int target, vector<int>& position, vector<int>& speed) {\n        return 0;\n    }\n};`,
      c: `int carFleet(int target, int* position, int positionSize, int* speed, int speedSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { target: 12, position: [10,8,0,5,3], speed: [2,4,1,1,3] }, expectedOutput: 3 },
      { input: { target: 10, position: [3], speed: [3] }, expectedOutput: 1 },
      { input: { target: 100, position: [0,2,4], speed: [4,2,1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { target: 10, position: [6,8], speed: [3,2] }, expectedOutput: 2 },
    ],
  },

  {
    id: 123,
    title: "Evaluate Reverse Polish Notation",
    slug: "evaluate-reverse-polish-notation",
    functionName: "evalRPN",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "stack evaluation",
    sourceType: "core",
    companies: ["Amazon", "LinkedIn"],
    description: "Evaluate an expression in Reverse Polish Notation. Valid operators are +, -, *, /. Each operand may be an integer or another expression. Division truncates toward zero.",
    examples: [
      { input: 'tokens = ["2","1","+","3","*"]', output: "9", explanation: "((2+1)*3) = 9" },
      { input: 'tokens = ["4","13","5","/","+"]', output: "6" },
      { input: 'tokens = ["10","6","9","3","+","-11","*","/","*","17","+","5","+"]', output: "22" },
    ],
    constraints: ["1 <= tokens.length <= 10^4", "tokens[i] is either an operator (+,-,*,/) or an integer in range [-200, 200]."],
    starterCode: {
      python: `class Solution:\n    def evalRPN(self, tokens):\n        pass`,
      javascript: `function evalRPN(tokens) {\n\n}`,
      typescript: `function evalRPN(tokens: string[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int evalRPN(String[] tokens) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int evalRPN(vector<string>& tokens) {\n        return 0;\n    }\n};`,
      c: `int evalRPN(char** tokens, int tokensSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { tokens: ["2","1","+","3","*"] }, expectedOutput: 9 },
      { input: { tokens: ["4","13","5","/","+"] }, expectedOutput: 6 },
      { input: { tokens: ["10","6","9","3","+","-11","*","/","*","17","+","5","+"] }, expectedOutput: 22 },
    ],
    hiddentestcases: [
      { input: { tokens: ["3","11","5","+","-"] }, expectedOutput: -13 },
      { input: { tokens: ["2"] }, expectedOutput: 2 },
    ],
  },

  {
    id: 124,
    title: "Basic Calculator II",
    slug: "basic-calculator-ii",
    functionName: "calculate",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "stack with operator precedence",
    sourceType: "core",
    companies: ["Facebook", "Amazon", "Microsoft"],
    description: "Given a string s representing a valid expression with integers and operators +, -, *, / (no parentheses), return the result. Integer division truncates toward zero.",
    examples: [
      { input: 's = "3+2*2"', output: "7" },
      { input: 's = " 3/2 "', output: "1" },
      { input: 's = " 3+5 / 2 "', output: "5" },
    ],
    constraints: ["1 <= s.length <= 3 * 10^5", "s consists of integers and operators +, -, *, /.", "Integer division truncates toward zero."],
    starterCode: {
      python: `class Solution:\n    def calculate(self, s):\n        pass`,
      javascript: `function calculate(s) {\n\n}`,
      typescript: `function calculate(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int calculate(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int calculate(string s) {\n        return 0;\n    }\n};`,
      c: `int calculate(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "3+2*2" }, expectedOutput: 7 },
      { input: { s: " 3/2 " }, expectedOutput: 1 },
      { input: { s: " 3+5 / 2 " }, expectedOutput: 5 },
    ],
    hiddentestcases: [
      { input: { s: "100000000/1/2/3/4/5/6/7/8/9/10" }, expectedOutput: 27 },
      { input: { s: "1*2-3/4+5*6-7*8+9/10" }, expectedOutput: -24 },
    ],
  },

  {
    id: 125,
    title: "Implement Queue using Stacks",
    slug: "implement-queue-using-stacks",
    functionName: "MyQueue",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "returningOnly" },
    difficulty: "Easy",
    topic: "Stacks",
    pattern: "two stacks",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Implement a first-in-first-out queue using only two stacks. Implement MyQueue with push(x), pop(), peek(), and empty(). Use only standard stack operations (push to top, peek/pop from top, size, is empty).",
    examples: [
      { input: '["MyQueue","push","push","peek","pop","empty"]\n[[],[1],[2],[],[],[]]', output: "[null,null,null,1,1,false]" },
    ],
    constraints: ["1 <= x <= 9", "At most 100 calls to push, pop, peek, and empty.", "All calls to pop and peek are valid."],
    starterCode: {
      python: `class MyQueue:\n    def __init__(self):\n        pass\n\n    def push(self, x):\n        pass\n\n    def pop(self):\n        pass\n\n    def peek(self):\n        pass\n\n    def empty(self):\n        pass`,
      javascript: `class MyQueue {\n  constructor() {}\n  push(x) {}\n  pop() {}\n  peek() {}\n  empty() { return true; }\n}`,
      typescript: `class MyQueue {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  push(x: number): void {\n    throw new Error("Not implemented");\n  }\n  pop(): number {\n    throw new Error("Not implemented");\n  }\n  peek(): number {\n    throw new Error("Not implemented");\n  }\n  empty(): boolean {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MyQueue {\n    public MyQueue() {}\n    public void push(int x) {}\n    public int pop() { return 0; }\n    public int peek() { return 0; }\n    public boolean empty() { return true; }\n}`,
      cpp: `class MyQueue {\npublic:\n    MyQueue() {}\n    void push(int x) {}\n    int pop() { return 0; }\n    int peek() { return 0; }\n    bool empty() { return true; }\n};`,
    },
    testcases: [
      { input: { ops: ["push","push","peek","pop","empty"], vals: [[1],[2],[],[],[]] }, expectedOutput: [1,1,false] },
    ],
    hiddentestcases: [
      { input: { ops: ["push","push","pop","push","pop","pop"], vals: [[1],[2],[],[3],[],[]] }, expectedOutput: [1,2,3] },
    ],
  },

  // ── BATCH 043: Advanced Graphs (IDs 126-130) ──────────────────────────────

  {
    id: 126,
    title: "Network Delay Time",
    slug: "network-delay-time",
    functionName: "networkDelayTime",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "Dijkstra's algorithm",
    sourceType: "core",
    companies: ["Amazon", "Google", "Facebook"],
    description: "You have n nodes (labeled 1 to n) and times[i] = [ui, vi, wi] is the travel time from node u to v with weight w. Given k as the starting node, return the time it takes for all nodes to receive the signal, or -1 if impossible.",
    examples: [
      { input: "times = [[2,1,1],[2,3,1],[3,4,1]], n = 4, k = 2", output: "2" },
      { input: "times = [[1,2,1]], n = 2, k = 1", output: "1" },
      { input: "times = [[1,2,1]], n = 2, k = 2", output: "-1" },
    ],
    constraints: ["1 <= k <= n <= 100", "1 <= times.length <= 6000", "times[i].length == 3"],
    starterCode: {
      python: `class Solution:\n    def networkDelayTime(self, times, n, k):\n        pass`,
      javascript: `function networkDelayTime(times, n, k) {\n\n}`,
      typescript: `function networkDelayTime(times: number[][], n: number, k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int networkDelayTime(int[][] times, int n, int k) {\n        return -1;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int networkDelayTime(vector<vector<int>>& times, int n, int k) {\n        return -1;\n    }\n};`,
    },
    testcases: [
      { input: { times: [[2,1,1],[2,3,1],[3,4,1]], n: 4, k: 2 }, expectedOutput: 2 },
      { input: { times: [[1,2,1]], n: 2, k: 1 }, expectedOutput: 1 },
      { input: { times: [[1,2,1]], n: 2, k: 2 }, expectedOutput: -1 },
    ],
    hiddentestcases: [
      { input: { times: [[1,2,1],[2,3,2],[1,3,4]], n: 3, k: 1 }, expectedOutput: 3 },
    ],
  },

  {
    id: 127,
    title: "Cheapest Flights Within K Stops",
    slug: "cheapest-flights-within-k-stops",
    functionName: "findCheapestPrice",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "Bellman-Ford / BFS with limit",
    sourceType: "core",
    companies: ["Amazon", "Google", "Facebook"],
    description: "There are n cities connected by some flights. flights[i] = [from, to, price]. Given src, dst, and k, return the cheapest price from src to dst with at most k stops. Return -1 if no such route exists.",
    examples: [
      { input: "n = 4, flights = [[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]], src = 0, dst = 3, k = 1", output: "700" },
      { input: "n = 3, flights = [[0,1,100],[1,2,100],[0,2,500]], src = 0, dst = 2, k = 1", output: "200" },
    ],
    constraints: ["1 <= n <= 100", "0 <= flights.length <= (n * (n - 1) / 2)", "0 <= k < n"],
    starterCode: {
      python: `class Solution:\n    def findCheapestPrice(self, n, flights, src, dst, k):\n        pass`,
      javascript: `function findCheapestPrice(n, flights, src, dst, k) {\n\n}`,
      typescript: `function findCheapestPrice(n: number, flights: number[][], src: number, dst: number, k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findCheapestPrice(int n, int[][] flights, int src, int dst, int k) {\n        return -1;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findCheapestPrice(int n, vector<vector<int>>& flights, int src, int dst, int k) {\n        return -1;\n    }\n};`,
    },
    testcases: [
      { input: { n: 4, flights: [[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]], src: 0, dst: 3, k: 1 }, expectedOutput: 700 },
      { input: { n: 3, flights: [[0,1,100],[1,2,100],[0,2,500]], src: 0, dst: 2, k: 1 }, expectedOutput: 200 },
    ],
    hiddentestcases: [
      { input: { n: 3, flights: [[0,1,100],[1,2,100],[0,2,500]], src: 0, dst: 2, k: 0 }, expectedOutput: 500 },
    ],
  },

  {
    id: 128,
    title: "Min Cost to Connect All Points",
    slug: "min-cost-to-connect-all-points",
    functionName: "minCostConnectPoints",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "Prim's MST / Kruskal's",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "Given an array of points where points[i] = [xi, yi], return the minimum cost to connect all points. The cost of connecting two points is their Manhattan distance. There are no connection fees and connections are undirected.",
    examples: [
      { input: "points = [[0,0],[2,2],[3,10],[5,2],[7,0]]", output: "20" },
      { input: "points = [[3,12],[-2,5],[-4,1]]", output: "18" },
    ],
    constraints: ["1 <= points.length <= 1000", "-10^6 <= xi, yi <= 10^6", "All pairs (xi, yi) are distinct."],
    starterCode: {
      python: `class Solution:\n    def minCostConnectPoints(self, points):\n        pass`,
      javascript: `function minCostConnectPoints(points) {\n\n}`,
      typescript: `function minCostConnectPoints(points: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int minCostConnectPoints(int[][] points) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int minCostConnectPoints(vector<vector<int>>& points) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { points: [[0,0],[2,2],[3,10],[5,2],[7,0]] }, expectedOutput: 20 },
      { input: { points: [[3,12],[-2,5],[-4,1]] }, expectedOutput: 18 },
      { input: { points: [[0,0]] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { points: [[0,0],[1,1],[1,0],[0,1]] }, expectedOutput: 3 },
    ],
  },

  {
    id: 129,
    title: "Number of Connected Components in Undirected Graph",
    slug: "number-of-connected-components",
    functionName: "countComponents",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "Union-Find / DFS",
    sourceType: "core",
    companies: ["LinkedIn", "Amazon", "Google"],
    description: "Given n nodes labeled 0 to n-1 and a list of undirected edges, return the number of connected components in the graph.",
    examples: [
      { input: "n = 5, edges = [[0,1],[1,2],[3,4]]", output: "2" },
      { input: "n = 5, edges = [[0,1],[1,2],[2,3],[3,4]]", output: "1" },
    ],
    constraints: ["1 <= n <= 2000", "1 <= edges.length <= 5000", "edges[i].length == 2", "0 <= ai, bi < n", "ai != bi", "No repeated edges."],
    starterCode: {
      python: `class Solution:\n    def countComponents(self, n, edges):\n        pass`,
      javascript: `function countComponents(n, edges) {\n\n}`,
      typescript: `function countComponents(n: number, edges: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int countComponents(int n, int[][] edges) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int countComponents(int n, vector<vector<int>>& edges) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { n: 5, edges: [[0,1],[1,2],[3,4]] }, expectedOutput: 2 },
      { input: { n: 5, edges: [[0,1],[1,2],[2,3],[3,4]] }, expectedOutput: 1 },
      { input: { n: 3, edges: [] }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { n: 1, edges: [] }, expectedOutput: 1 },
      { input: { n: 4, edges: [[0,1],[2,3]] }, expectedOutput: 2 },
    ],
  },

  {
    id: 130,
    title: "Redundant Connection",
    slug: "redundant-connection",
    functionName: "findRedundantConnection",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "Union-Find cycle detection",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given a graph that started as a tree (n nodes, n-1 edges) with one additional edge added, find and return the edge that can be removed so the result is a tree. If multiple answers, return the last one in the input.",
    examples: [
      { input: "edges = [[1,2],[1,3],[2,3]]", output: "[2,3]" },
      { input: "edges = [[1,2],[2,3],[3,4],[1,4],[1,5]]", output: "[1,4]" },
    ],
    constraints: ["n == edges.length", "3 <= n <= 1000", "edges[i].length == 2", "1 <= ai < bi <= edges.length"],
    starterCode: {
      python: `class Solution:\n    def findRedundantConnection(self, edges):\n        pass`,
      javascript: `function findRedundantConnection(edges) {\n\n}`,
      typescript: `function findRedundantConnection(edges: number[][]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] findRedundantConnection(int[][] edges) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> findRedundantConnection(vector<vector<int>>& edges) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { edges: [[1,2],[1,3],[2,3]] }, expectedOutput: [2,3] },
      { input: { edges: [[1,2],[2,3],[3,4],[1,4],[1,5]] }, expectedOutput: [1,4] },
    ],
    hiddentestcases: [
      { input: { edges: [[1,2],[2,3],[1,3]] }, expectedOutput: [1,3] },
    ],
  },

  // ── BATCH 039: Intervals + Matrix (IDs 131-140) ────────────────────────────

  { id: 131, title: "Minimum Number of Meeting Rooms", slug: "minimum-meeting-rooms", functionName: "minMeetingRooms", difficulty: "Medium", topic: "Intervals", pattern: "min heap sweep", companies: ["Amazon","Facebook","Google"], description: "Given an array of meeting time intervals, return the minimum number of conference rooms required.", examples: [{ input: "intervals = [[0,30],[5,10],[15,20]]", output: "2" }], constraints: ["1 <= intervals.length <= 10^4", "0 <= start < end <= 10^6"], starterCode: { python: `class Solution:\n    def minMeetingRooms(self, intervals):\n        pass`, javascript: `function minMeetingRooms(intervals) {\n\n}`, typescript: `function minMeetingRooms(intervals: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int minMeetingRooms(int[][] intervals) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int minMeetingRooms(vector<vector<int>>& intervals) { return 0; }\n};` }, testcases: [{ input: { intervals: [[0,30],[5,10],[15,20]] }, expectedOutput: 2 }, { input: { intervals: [[7,10],[2,4]] }, expectedOutput: 1 }], hiddentestcases: [{ input: { intervals: [[1,5],[5,10],[10,14]] }, expectedOutput: 1 }, { input: { intervals: [[1,4],[2,5],[7,9]] }, expectedOutput: 2 }] },

  {
    id: 132,
    title: "Insert Interval",
    slug: "insert-interval",
    functionName: "insert",
    difficulty: "Medium",
    topic: "Intervals",
    pattern: "linear scan merge",
    sourceType: "core",
    companies: ["Google", "Facebook", "Amazon"],
    description: "You are given an array of non-overlapping intervals sorted in ascending order by start time. Insert a new interval (merge if necessary) and return the result.",
    examples: [
      { input: "intervals = [[1,3],[6,9]], newInterval = [2,5]", output: "[[1,5],[6,9]]" },
      { input: "intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]", output: "[[1,2],[3,10],[12,16]]" },
    ],
    constraints: ["0 <= intervals.length <= 10^4", "intervals[i].length == 2", "0 <= newInterval[0] <= newInterval[1] <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def insert(self, intervals, newInterval):\n        pass`,
      javascript: `function insert(intervals, newInterval) {\n\n}`,
      typescript: `function insert(intervals: number[][], newInterval: number[]): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[][] insert(int[][] intervals, int[] newInterval) {\n        return new int[][]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> insert(vector<vector<int>>& intervals, vector<int>& newInterval) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { intervals: [[1,3],[6,9]], newInterval: [2,5] }, expectedOutput: [[1,5],[6,9]] },
      { input: { intervals: [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval: [4,8] }, expectedOutput: [[1,2],[3,10],[12,16]] },
      { input: { intervals: [], newInterval: [5,7] }, expectedOutput: [[5,7]] },
    ],
    hiddentestcases: [
      { input: { intervals: [[1,5]], newInterval: [2,3] }, expectedOutput: [[1,5]] },
      { input: { intervals: [[1,5]], newInterval: [6,8] }, expectedOutput: [[1,5],[6,8]] },
    ],
  },

  { id: 133, title: "Interval List Intersections", slug: "interval-list-intersections", functionName: "intervalIntersection", difficulty: "Medium", topic: "Intervals", pattern: "two pointer merge", companies: ["Facebook","Amazon"], description: "Given two lists of closed intervals, each list of intervals is pairwise disjoint and in sorted order. Return the intersection of these two interval lists.", examples: [{ input: "firstList = [[0,2],[5,10],[13,23],[24,25]], secondList = [[1,5],[8,12],[15,24],[25,26]]", output: "[[1,2],[5,5],[8,10],[15,23],[24,24],[25,25]]" }], constraints: ["0 <= firstList.length, secondList.length <= 1000"], starterCode: { python: `class Solution:\n    def intervalIntersection(self, firstList, secondList):\n        pass`, javascript: `function intervalIntersection(firstList, secondList) {\n\n}`, typescript: `function intervalIntersection(firstList: number[][], secondList: number[][]): number[][] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int[][] intervalIntersection(int[][] firstList, int[][] secondList) { return new int[][]{}; }\n}`, cpp: `class Solution {\npublic:\n    vector<vector<int>> intervalIntersection(vector<vector<int>>& firstList, vector<vector<int>>& secondList) { return {}; }\n};` }, testcases: [{ input: { firstList: [[0,2],[5,10],[13,23],[24,25]], secondList: [[1,5],[8,12],[15,24],[25,26]] }, expectedOutput: [[1,2],[5,5],[8,10],[15,23],[24,24],[25,25]] }, { input: { firstList: [], secondList: [] }, expectedOutput: [] }], hiddentestcases: [{ input: { firstList: [[1,3],[5,9]], secondList: [] }, expectedOutput: [] }, { input: { firstList: [[1,7]], secondList: [[3,10]] }, expectedOutput: [[3,7]] }] },

  {
    id: 134,
    title: "Meeting Rooms",
    slug: "meeting-rooms",
    functionName: "canAttendMeetings",
    difficulty: "Easy",
    topic: "Intervals",
    pattern: "sort and check overlap",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given an array of meeting time intervals where intervals[i] = [starti, endi], determine if a person could attend all meetings (no two meetings overlap).",
    examples: [
      { input: "intervals = [[0,30],[5,10],[15,20]]", output: "false" },
      { input: "intervals = [[7,10],[2,4]]", output: "true" },
    ],
    constraints: ["0 <= intervals.length <= 10^4", "intervals[i].length == 2", "0 <= starti < endi <= 10^6"],
    starterCode: {
      python: `class Solution:\n    def canAttendMeetings(self, intervals):\n        pass`,
      javascript: `function canAttendMeetings(intervals) {\n\n}`,
      typescript: `function canAttendMeetings(intervals: number[][]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean canAttendMeetings(int[][] intervals) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool canAttendMeetings(vector<vector<int>>& intervals) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { intervals: [[0,30],[5,10],[15,20]] }, expectedOutput: false },
      { input: { intervals: [[7,10],[2,4]] }, expectedOutput: true },
      { input: { intervals: [] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { intervals: [[1,5],[5,10]] }, expectedOutput: true },
      { input: { intervals: [[1,5],[4,10]] }, expectedOutput: false },
    ],
  },

  {
    id: 135,
    title: "My Calendar II",
    slug: "my-calendar-ii",
    functionName: "MyCalendarTwo",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Medium",
    topic: "Intervals",
    pattern: "double-booking overlap tracking",
    sourceType: "core",
    companies: ["Facebook", "Google", "Amazon", "Microsoft"],
    description: "Implement a MyCalendarTwo class to book events, where a new event can be added to the calendar as long as it does not cause a triple booking (three events with a common time slot). A double booking (two events overlapping, but not three) is allowed. book(start, end) returns true if the event can be added without causing a triple booking, and false otherwise (in which case the event is not added). Each event is a half-open interval [start, end).",
    examples: [
      { input: '["MyCalendarTwo","book","book","book","book","book","book"]\n[[],[10,20],[50,60],[10,40],[5,15],[5,10],[25,55]]', output: "[null,true,true,true,false,true,true]" },
    ],
    constraints: ["0 <= start < end <= 10^9", "At most 1000 calls will be made to book."],
    starterCode: {
      python: `class MyCalendarTwo:\n    def __init__(self):\n        pass\n\n    def book(self, start, end):\n        pass`,
      javascript: `class MyCalendarTwo {\n  constructor() {}\n  book(start, end) { return false; }\n}`,
      typescript: `class MyCalendarTwo {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  book(start: number, end: number): boolean {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MyCalendarTwo {\n    public MyCalendarTwo() {}\n    public boolean book(int start, int end) { return false; }\n}`,
      cpp: `class MyCalendarTwo {\npublic:\n    MyCalendarTwo() {}\n    bool book(int start, int end) { return false; }\n};`,
    },
    testcases: [
      { input: { ops: ["book","book","book","book","book","book"], vals: [[10,20],[50,60],[10,40],[5,15],[5,10],[25,55]] }, expectedOutput: [true,true,true,false,true,true] },
    ],
    hiddentestcases: [
      { input: { ops: ["book","book","book"], vals: [[0,10],[0,10],[0,10]] }, expectedOutput: [true,true,false] },
    ],
  },

  {
    id: 136,
    title: "Set Matrix Zeroes",
    slug: "set-matrix-zeroes",
    functionName: "setZeroes",
    difficulty: "Medium",
    topic: "Matrix",
    pattern: "in-place marker",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook"],
    description: "Given an m x n integer matrix, if an element is 0, set its entire row and column to 0's. Do it in-place.",
    examples: [
      { input: "matrix = [[1,1,1],[1,0,1],[1,1,1]]", output: "[[1,0,1],[0,0,0],[1,0,1]]" },
      { input: "matrix = [[0,1,2,0],[3,4,5,2],[1,3,1,5]]", output: "[[0,0,0,0],[0,4,5,0],[0,3,1,0]]" },
    ],
    constraints: ["m == matrix.length", "n == matrix[0].length", "1 <= m, n <= 200", "-2^31 <= matrix[i][j] <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def setZeroes(self, matrix):\n        pass`,
      javascript: `function setZeroes(matrix) {\n\n}`,
      typescript: `function setZeroes(matrix: number[][]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void setZeroes(int[][] matrix) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void setZeroes(vector<vector<int>>& matrix) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { matrix: [[1,1,1],[1,0,1],[1,1,1]] }, expectedOutput: [[1,0,1],[0,0,0],[1,0,1]] },
      { input: { matrix: [[0,1,2,0],[3,4,5,2],[1,3,1,5]] }, expectedOutput: [[0,0,0,0],[0,4,5,0],[0,3,1,0]] },
    ],
    hiddentestcases: [
      { input: { matrix: [[1,0]] }, expectedOutput: [[0,0]] },
      { input: { matrix: [[1,2],[0,4]] }, expectedOutput: [[0,2],[0,0]] },
    ],
  },

  {
    id: 137,
    title: "Spiral Matrix",
    slug: "spiral-matrix",
    functionName: "spiralOrder",
    difficulty: "Medium",
    topic: "Matrix",
    pattern: "layer-by-layer simulation",
    sourceType: "core",
    companies: ["Microsoft", "Amazon", "Google"],
    description: "Given an m x n matrix, return all elements of the matrix in spiral order.",
    examples: [
      { input: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", output: "[1,2,3,6,9,8,7,4,5]" },
      { input: "matrix = [[1,2,3,4],[5,6,7,8],[9,10,11,12]]", output: "[1,2,3,4,8,12,11,10,9,5,6,7]" },
    ],
    constraints: ["m == matrix.length", "n == matrix[i].length", "1 <= m, n <= 10", "-100 <= matrix[i][j] <= 100"],
    starterCode: {
      python: `class Solution:\n    def spiralOrder(self, matrix):\n        pass`,
      javascript: `function spiralOrder(matrix) {\n\n}`,
      typescript: `function spiralOrder(matrix: number[][]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<Integer> spiralOrder(int[][] matrix) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> spiralOrder(vector<vector<int>>& matrix) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { matrix: [[1,2,3],[4,5,6],[7,8,9]] }, expectedOutput: [1,2,3,6,9,8,7,4,5] },
      { input: { matrix: [[1,2,3,4],[5,6,7,8],[9,10,11,12]] }, expectedOutput: [1,2,3,4,8,12,11,10,9,5,6,7] },
      { input: { matrix: [[1]] }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { matrix: [[1,2],[3,4]] }, expectedOutput: [1,2,4,3] },
      { input: { matrix: [[7],[9],[6]] }, expectedOutput: [7,9,6] },
    ],
  },

  {
    id: 138,
    title: "Rotate Image",
    slug: "rotate-image",
    functionName: "rotate",
    difficulty: "Medium",
    topic: "Matrix",
    pattern: "transpose + reverse",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Facebook"],
    description: "Given an n x n 2D matrix representing an image, rotate the image by 90 degrees clockwise in-place.",
    examples: [
      { input: "matrix = [[1,2,3],[4,5,6],[7,8,9]]", output: "[[7,4,1],[8,5,2],[9,6,3]]" },
      { input: "matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]", output: "[[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]" },
    ],
    constraints: ["n == matrix.length == matrix[i].length", "1 <= n <= 20", "-1000 <= matrix[i][j] <= 1000"],
    starterCode: {
      python: `class Solution:\n    def rotate(self, matrix):\n        pass`,
      javascript: `function rotate(matrix) {\n\n}`,
      typescript: `function rotate(matrix: number[][]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void rotate(int[][] matrix) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void rotate(vector<vector<int>>& matrix) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { matrix: [[1,2,3],[4,5,6],[7,8,9]] }, expectedOutput: [[7,4,1],[8,5,2],[9,6,3]] },
      { input: { matrix: [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]] }, expectedOutput: [[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]] },
    ],
    hiddentestcases: [
      { input: { matrix: [[1]] }, expectedOutput: [[1]] },
      { input: { matrix: [[1,2],[3,4]] }, expectedOutput: [[3,1],[4,2]] },
    ],
  },

  { id: 139, title: "Binary Search Tree Iterator", slug: "binary-search-tree-iterator", functionName: "BSTIterator", difficulty: "Medium", topic: "Trees", pattern: "controlled inorder traversal", companies: ["Facebook","Google","Amazon"], description: "Implement the BSTIterator class that represents an iterator over the in-order traversal of a BST. next() returns the next smallest number. hasNext() returns whether the next element exists. Both operations must be O(h) average where h is the height.", examples: [{ input: '[7,3,15,null,null,9,20] → next,next,hasNext,next,hasNext,next,hasNext,next,hasNext', output: '[3,9,true,15,true,20,false]' }], constraints: ["1 <= n <= 10^5", "-10^5 <= Node.val <= 10^5"], starterCode: { python: `class BSTIterator:\n    def __init__(self, root):\n        pass\n    def next(self):\n        pass\n    def hasNext(self):\n        pass`, javascript: `class BSTIterator {\n  constructor(root) {}\n  next() { return 0; }\n  hasNext() { return false; }\n}`, typescript: `class BSTIterator {\n  constructor(root: any) {\n    throw new Error("Not implemented");\n  }\n  next(): number {\n    throw new Error("Not implemented");\n  }\n  hasNext(): boolean {\n    throw new Error("Not implemented");\n  }\n}`, java: `class BSTIterator {\n    public BSTIterator(TreeNode root) {}\n    public int next() { return 0; }\n    public boolean hasNext() { return false; }\n}`, cpp: `class BSTIterator {\npublic:\n    BSTIterator(TreeNode* root) {}\n    int next() { return 0; }\n    bool hasNext() { return false; }\n};` }, testcases: [{ input: { root: [7,3,15,null,null,9,20], ops: ["next","next","hasNext","next","hasNext","next","hasNext","next","hasNext"], vals: [[],[],[],[],[],[],[],[],[]] }, expectedOutput: [3,9,true,15,true,20,false,null,false] }], hiddentestcases: [{ input: { root: [3,1,4,null,2], ops: ["next","next","hasNext","next"], vals: [[],[],[],[]] }, expectedOutput: [1,2,true,3] }] },

  {
    id: 140,
    title: "Game of Life",
    slug: "game-of-life",
    functionName: "gameOfLife",
    difficulty: "Medium",
    topic: "Matrix",
    pattern: "in-place state encoding",
    sourceType: "core",
    companies: ["Google", "Amazon", "Microsoft"],
    description: "Given an m×n board of cells (1=live, 0=dead), apply Conway's Game of Life rules simultaneously to all cells and return the next state. Do it in-place.",
    examples: [
      { input: "board = [[0,1,0],[0,0,1],[1,1,1],[0,0,0]]", output: "[[0,0,0],[1,0,1],[0,1,1],[0,1,0]]" },
      { input: "board = [[1,1],[1,0]]", output: "[[1,1],[1,1]]" },
    ],
    constraints: ["m == board.length", "n == board[i].length", "1 <= m, n <= 25", "board[i][j] is 0 or 1"],
    starterCode: {
      python: `class Solution:\n    def gameOfLife(self, board):\n        pass`,
      javascript: `function gameOfLife(board) {\n\n}`,
      typescript: `function gameOfLife(board: number[][]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void gameOfLife(int[][] board) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void gameOfLife(vector<vector<int>>& board) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { board: [[0,1,0],[0,0,1],[1,1,1],[0,0,0]] }, expectedOutput: [[0,0,0],[1,0,1],[0,1,1],[0,1,0]] },
      { input: { board: [[1,1],[1,0]] }, expectedOutput: [[1,1],[1,1]] },
    ],
    hiddentestcases: [
      { input: { board: [[1]] }, expectedOutput: [[0]] },
      { input: { board: [[0,0,0],[0,0,0],[0,0,0]] }, expectedOutput: [[0,0,0],[0,0,0],[0,0,0]] },
    ],
  },

  // ── BATCH 040: Math + Number Theory (IDs 141-150) ─────────────────────────

  {
    id: 141,
    title: "Reverse Integer",
    slug: "reverse-integer",
    functionName: "reverse",
    difficulty: "Medium",
    topic: "Math",
    pattern: "digit extraction",
    sourceType: "core",
    companies: ["Amazon", "Bloomberg", "Apple"],
    description: "Given a signed 32-bit integer x, return x with its digits reversed. If reversing causes overflow beyond [-2^31, 2^31-1], return 0.",
    examples: [
      { input: "x = 123", output: "321" },
      { input: "x = -123", output: "-321" },
      { input: "x = 120", output: "21" },
    ],
    constraints: ["-2^31 <= x <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def reverse(self, x):\n        pass`,
      javascript: `function reverse(x) {\n\n}`,
      typescript: `function reverse(x: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int reverse(int x) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int reverse(int x) {\n        return 0;\n    }\n};`,
      c: `int reverse(int x) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { x: 123 }, expectedOutput: 321 },
      { input: { x: -123 }, expectedOutput: -321 },
      { input: { x: 120 }, expectedOutput: 21 },
    ],
    hiddentestcases: [
      { input: { x: 0 }, expectedOutput: 0 },
      { input: { x: 1534236469 }, expectedOutput: 0 },
    ],
  },

  {
    id: 142,
    title: "Palindrome Number",
    slug: "palindrome-number",
    functionName: "isPalindrome",
    difficulty: "Easy",
    topic: "Math",
    pattern: "digit reversal",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given an integer x, return true if x is a palindrome (reads the same forward and backward). Negative numbers are not palindromes. Solve without converting to a string.",
    examples: [
      { input: "x = 121", output: "true" },
      { input: "x = -121", output: "false" },
      { input: "x = 10", output: "false" },
    ],
    constraints: ["-2^31 <= x <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def isPalindrome(self, x):\n        pass`,
      javascript: `function isPalindrome(x) {\n\n}`,
      typescript: `function isPalindrome(x: number): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isPalindrome(int x) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isPalindrome(int x) {\n        return false;\n    }\n};`,
      c: `bool isPalindrome(int x) {\n    return false;\n}`,
    },
    testcases: [
      { input: { x: 121 }, expectedOutput: true },
      { input: { x: -121 }, expectedOutput: false },
      { input: { x: 10 }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { x: 0 }, expectedOutput: true },
      { input: { x: 1000021 }, expectedOutput: false },
    ],
  },

  {
    id: 143,
    title: "Happy Number",
    slug: "happy-number",
    functionName: "isHappy",
    difficulty: "Easy",
    topic: "Math",
    pattern: "cycle detection Floyd",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "A happy number is defined by repeatedly replacing the number with the sum of the squares of its digits until it equals 1 (happy) or loops endlessly. Return true if n is a happy number.",
    examples: [
      { input: "n = 19", output: "true", explanation: "1²+9²=82 → 8²+2²=68 → ... → 1" },
      { input: "n = 2", output: "false" },
    ],
    constraints: ["1 <= n <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def isHappy(self, n):\n        pass`,
      javascript: `function isHappy(n) {\n\n}`,
      typescript: `function isHappy(n: number): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isHappy(int n) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isHappy(int n) {\n        return false;\n    }\n};`,
      c: `bool isHappy(int n) {\n    return false;\n}`,
    },
    testcases: [
      { input: { n: 19 }, expectedOutput: true },
      { input: { n: 2 }, expectedOutput: false },
      { input: { n: 1 }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { n: 7 }, expectedOutput: true },
      { input: { n: 4 }, expectedOutput: false },
    ],
  },

  {
    id: 144,
    title: "Power of Two",
    slug: "power-of-two",
    functionName: "isPowerOfTwo",
    difficulty: "Easy",
    topic: "Math",
    pattern: "bit manipulation",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "Given an integer n, return true if it is a power of two. An integer n is a power of two if there exists an integer x such that n == 2^x.",
    examples: [
      { input: "n = 1", output: "true" },
      { input: "n = 16", output: "true" },
      { input: "n = 3", output: "false" },
    ],
    constraints: ["-2^31 <= n <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def isPowerOfTwo(self, n):\n        pass`,
      javascript: `function isPowerOfTwo(n) {\n\n}`,
      typescript: `function isPowerOfTwo(n: number): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isPowerOfTwo(int n) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isPowerOfTwo(int n) {\n        return false;\n    }\n};`,
      c: `bool isPowerOfTwo(int n) {\n    return false;\n}`,
    },
    testcases: [
      { input: { n: 1 }, expectedOutput: true },
      { input: { n: 16 }, expectedOutput: true },
      { input: { n: 3 }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { n: 0 }, expectedOutput: false },
      { input: { n: -16 }, expectedOutput: false },
    ],
  },

  {
    id: 145,
    title: "Excel Sheet Column Number",
    slug: "excel-sheet-column-number",
    functionName: "titleToNumber",
    difficulty: "Easy",
    topic: "Math",
    pattern: "base-26 conversion",
    sourceType: "core",
    companies: ["Microsoft", "Amazon"],
    description: "Given a string columnTitle that represents the column title as appears in an Excel sheet, return its corresponding column number. A→1, B→2, ..., Z→26, AA→27, AB→28.",
    examples: [
      { input: 'columnTitle = "A"', output: "1" },
      { input: 'columnTitle = "AB"', output: "28" },
      { input: 'columnTitle = "ZY"', output: "701" },
    ],
    constraints: ["1 <= columnTitle.length <= 7", "columnTitle consists only of uppercase English letters."],
    starterCode: {
      python: `class Solution:\n    def titleToNumber(self, columnTitle):\n        pass`,
      javascript: `function titleToNumber(columnTitle) {\n\n}`,
      typescript: `function titleToNumber(columnTitle: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int titleToNumber(String columnTitle) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int titleToNumber(string columnTitle) {\n        return 0;\n    }\n};`,
      c: `int titleToNumber(char* columnTitle) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { columnTitle: "A" }, expectedOutput: 1 },
      { input: { columnTitle: "AB" }, expectedOutput: 28 },
      { input: { columnTitle: "ZY" }, expectedOutput: 701 },
    ],
    hiddentestcases: [
      { input: { columnTitle: "Z" }, expectedOutput: 26 },
      { input: { columnTitle: "AA" }, expectedOutput: 27 },
    ],
  },

  {
    id: 146,
    title: "Count Primes",
    slug: "count-primes",
    functionName: "countPrimes",
    difficulty: "Medium",
    topic: "Math",
    pattern: "Sieve of Eratosthenes",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given an integer n, return the number of prime numbers strictly less than n.",
    examples: [
      { input: "n = 10", output: "4", explanation: "2, 3, 5, 7" },
      { input: "n = 0", output: "0" },
      { input: "n = 1", output: "0" },
    ],
    constraints: ["0 <= n <= 5 * 10^6"],
    starterCode: {
      python: `class Solution:\n    def countPrimes(self, n):\n        pass`,
      javascript: `function countPrimes(n) {\n\n}`,
      typescript: `function countPrimes(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int countPrimes(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int countPrimes(int n) {\n        return 0;\n    }\n};`,
      c: `int countPrimes(int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { n: 10 }, expectedOutput: 4 },
      { input: { n: 0 }, expectedOutput: 0 },
      { input: { n: 1 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { n: 2 }, expectedOutput: 0 },
      { input: { n: 20 }, expectedOutput: 8 },
    ],
  },

  {
    id: 147,
    title: "Sqrt(x)",
    slug: "sqrt-x",
    functionName: "mySqrt",
    difficulty: "Easy",
    topic: "Math",
    pattern: "binary search",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Bloomberg"],
    description: "Given a non-negative integer x, return the square root of x rounded down to the nearest integer. Do not use any built-in exponent function or operator.",
    examples: [
      { input: "x = 4", output: "2" },
      { input: "x = 8", output: "2", explanation: "sqrt(8) = 2.82..., rounded down to 2" },
    ],
    constraints: ["0 <= x <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def mySqrt(self, x):\n        pass`,
      javascript: `function mySqrt(x) {\n\n}`,
      typescript: `function mySqrt(x: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int mySqrt(int x) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int mySqrt(int x) {\n        return 0;\n    }\n};`,
      c: `int mySqrt(int x) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { x: 4 }, expectedOutput: 2 },
      { input: { x: 8 }, expectedOutput: 2 },
      { input: { x: 0 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { x: 1 }, expectedOutput: 1 },
      { input: { x: 2147395599 }, expectedOutput: 46339 },
    ],
  },

  {
    id: 148,
    title: "Roman to Integer",
    slug: "roman-to-integer",
    functionName: "romanToInt",
    difficulty: "Easy",
    topic: "Math",
    pattern: "symbol table lookup",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Bloomberg", "Facebook"],
    description: "Given a roman numeral string s, convert it to an integer. Roman numerals: I=1, V=5, X=10, L=50, C=100, D=500, M=1000. Subtractive notation: IV=4, IX=9, XL=40, XC=90, CD=400, CM=900.",
    examples: [
      { input: 's = "III"', output: "3" },
      { input: 's = "LVIII"', output: "58" },
      { input: 's = "MCMXCIV"', output: "1994" },
    ],
    constraints: ["1 <= s.length <= 15", "s contains only Roman numeral characters.", "It is guaranteed that s is a valid roman numeral in the range [1, 3999]."],
    starterCode: {
      python: `class Solution:\n    def romanToInt(self, s):\n        pass`,
      javascript: `function romanToInt(s) {\n\n}`,
      typescript: `function romanToInt(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int romanToInt(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int romanToInt(string s) {\n        return 0;\n    }\n};`,
      c: `int romanToInt(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "III" }, expectedOutput: 3 },
      { input: { s: "LVIII" }, expectedOutput: 58 },
      { input: { s: "MCMXCIV" }, expectedOutput: 1994 },
    ],
    hiddentestcases: [
      { input: { s: "IV" }, expectedOutput: 4 },
      { input: { s: "IX" }, expectedOutput: 9 },
    ],
  },

  {
    id: 149,
    title: "Add Two Numbers",
    slug: "add-two-numbers",
    functionName: "addTwoNumbers",
    difficulty: "Medium",
    topic: "Linked List",
    pattern: "carry propagation",
    sourceType: "core",
    companies: ["Amazon", "Microsoft", "Bloomberg", "Facebook"],
    description: "Given two non-empty linked lists representing two non-negative integers stored in reverse order, add the two numbers and return the sum as a linked list.",
    examples: [
      { input: "l1 = [2,4,3], l2 = [5,6,4]", output: "[7,0,8]", explanation: "342 + 465 = 807" },
      { input: "l1 = [0], l2 = [0]", output: "[0]" },
      { input: "l1 = [9,9,9,9,9,9,9], l2 = [9,9,9,9]", output: "[8,9,9,9,0,0,0,1]" },
    ],
    constraints: ["1 <= n, m <= 100", "0 <= Node.val <= 9", "No leading zeros except the number 0 itself."],
    starterCode: {
      python: `class Solution:\n    def addTwoNumbers(self, l1, l2):\n        pass`,
      javascript: `function addTwoNumbers(l1, l2) {\n\n}`,
      typescript: `function addTwoNumbers(l1: any, l2: any): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public ListNode addTwoNumbers(ListNode l1, ListNode l2) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { l1: [2,4,3], l2: [5,6,4] }, expectedOutput: [7,0,8] },
      { input: { l1: [0], l2: [0] }, expectedOutput: [0] },
      { input: { l1: [9,9,9,9,9,9,9], l2: [9,9,9,9] }, expectedOutput: [8,9,9,9,0,0,0,1] },
    ],
    hiddentestcases: [
      { input: { l1: [1], l2: [9,9] }, expectedOutput: [0,0,1] },
      { input: { l1: [5], l2: [5] }, expectedOutput: [0,1] },
    ],
  },

  {
    id: 150,
    title: "Pow(x, n)",
    slug: "pow-x-n",
    functionName: "myPow",
    difficulty: "Medium",
    topic: "Math",
    pattern: "fast exponentiation",
    sourceType: "core",
    companies: ["Facebook", "Google", "Amazon"],
    description: "Implement pow(x, n), which calculates x raised to the power n. Handle negative n and be efficient (O(log n)).",
    examples: [
      { input: "x = 2.00000, n = 10", output: "1024.00000" },
      { input: "x = 2.10000, n = 3", output: "9.26100" },
      { input: "x = 2.00000, n = -2", output: "0.25000" },
    ],
    constraints: ["-100.0 < x < 100.0", "-2^31 <= n <= 2^31-1", "n is an integer", "-10^4 <= x^n <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def myPow(self, x, n):\n        pass`,
      javascript: `function myPow(x, n) {\n\n}`,
      typescript: `function myPow(x: number, n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public double myPow(double x, int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    double myPow(double x, int n) {\n        return 0;\n    }\n};`,
      c: `double myPow(double x, int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { x: 2.0, n: 10 }, expectedOutput: 1024.0 },
      { input: { x: 2.0, n: -2 }, expectedOutput: 0.25 },
      { input: { x: 2.0, n: 0 }, expectedOutput: 1.0 },
    ],
    hiddentestcases: [
      { input: { x: 1.0, n: -2147483648 }, expectedOutput: 1.0 },
      { input: { x: 0.0, n: 0 }, expectedOutput: 1.0 },
    ],
  },

  // ── BATCH 041: Two Pointers Deep + Design (IDs 151-160) ───────────────────

  {
    id: 151,
    title: "3Sum Smaller",
    slug: "3sum-smaller",
    functionName: "threeSumSmaller",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "sort + two pointer counting",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given an integer array nums of length n and an integer target, return the number of index triplets i, j, k with 0 <= i < j < k < n such that nums[i] + nums[j] + nums[k] < target.",
    examples: [
      { input: "nums = [-2,0,1,3], target = 2", output: "2", explanation: "The two triplets are [-2,0,1] (sum -1) and [-2,0,3] (sum 1); both are less than 2." },
      { input: "nums = [], target = 0", output: "0" },
      { input: "nums = [0], target = 0", output: "0", explanation: "Fewer than 3 elements, so no triplet exists." },
    ],
    constraints: ["0 <= nums.length <= 3500", "-100 <= nums[i] <= 100", "-100 <= target <= 100"],
    starterCode: {
      python: `class Solution:\n    def threeSumSmaller(self, nums, target):\n        pass`,
      javascript: `function threeSumSmaller(nums, target) {\n\n}`,
      typescript: `function threeSumSmaller(nums: number[], target: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int threeSumSmaller(int[] nums, int target) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int threeSumSmaller(vector<int>& nums, int target) {\n        return 0;\n    }\n};`,
      c: `int threeSumSmaller(int* nums, int numsSize, int target) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [-2,0,1,3], target: 2 }, expectedOutput: 2 },
      { input: { nums: [], target: 0 }, expectedOutput: 0 },
      { input: { nums: [0], target: 0 }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [1,1,1], target: 3 }, expectedOutput: 0 },
      { input: { nums: [1,1,1], target: 4 }, expectedOutput: 1 },
    ],
  },

  {
    id: 152,
    title: "Remove Duplicates from Sorted Array II",
    slug: "remove-duplicates-sorted-array-ii",
    functionName: "removeDuplicates",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "slow-fast pointer",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given a sorted array nums, remove duplicates in-place such that each element appears at most twice. Return the new length k. The first k elements of nums should contain the result.",
    examples: [
      { input: "nums = [1,1,1,2,2,3]", output: "5, nums = [1,1,2,2,3,_]" },
      { input: "nums = [0,0,1,1,1,1,2,3,3]", output: "7, nums = [0,0,1,1,2,3,3,_,_]" },
    ],
    constraints: ["1 <= nums.length <= 3 * 10^4", "-10^4 <= nums[i] <= 10^4", "nums is sorted in non-decreasing order."],
    starterCode: {
      python: `class Solution:\n    def removeDuplicates(self, nums):\n        pass`,
      javascript: `function removeDuplicates(nums) {\n\n}`,
      typescript: `function removeDuplicates(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int removeDuplicates(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int removeDuplicates(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int removeDuplicates(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1,1,1,2,2,3] }, expectedOutput: 5 },
      { input: { nums: [0,0,1,1,1,1,2,3,3] }, expectedOutput: 7 },
      { input: { nums: [1,1] }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { nums: [1] }, expectedOutput: 1 },
      { input: { nums: [1,1,1,1] }, expectedOutput: 2 },
    ],
  },

  {
    id: 153,
    title: "Valid Triangle Number",
    slug: "valid-triangle-number",
    functionName: "triangleNumber",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "sort + two pointer",
    sourceType: "core",
    companies: ["Google"],
    description: "Given an integer array nums, return the number of triplets chosen from the array that can make triangles if we take them as side lengths.",
    examples: [
      { input: "nums = [2,2,3,4]", output: "3" },
      { input: "nums = [4,2,3,4]", output: "4" },
    ],
    constraints: ["1 <= nums.length <= 1000", "0 <= nums[i] <= 1000"],
    starterCode: {
      python: `class Solution:\n    def triangleNumber(self, nums):\n        pass`,
      javascript: `function triangleNumber(nums) {\n\n}`,
      typescript: `function triangleNumber(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int triangleNumber(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int triangleNumber(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int triangleNumber(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [2,2,3,4] }, expectedOutput: 3 },
      { input: { nums: [4,2,3,4] }, expectedOutput: 4 },
      { input: { nums: [0,0,0] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { nums: [1,1,1] }, expectedOutput: 1 },
      { input: { nums: [3,24,4,380] }, expectedOutput: 0 },
    ],
  },

  {
    id: 154,
    title: "Implement Stack using Queues",
    slug: "implement-stack-using-queues",
    functionName: "MyStack",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Easy",
    topic: "Design",
    pattern: "queue rotation trick",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Implement a last-in-first-out (LIFO) stack using only two queues. Implement push, pop, top, and empty operations. pop and top must be O(1) amortized or O(n) worst case — use only standard queue operations.",
    examples: [
      { input: '["MyStack","push","push","top","pop","empty"]\n[[],[1],[2],[],[],[]]', output: "[null,null,null,2,2,false]" },
    ],
    constraints: ["1 <= val <= 9", "At most 100 calls to push, pop, top, empty.", "All pop/top calls valid."],
    starterCode: {
      python: `class MyStack:\n    def __init__(self):\n        pass\n    def push(self, val):\n        pass\n    def pop(self):\n        pass\n    def top(self):\n        pass\n    def empty(self):\n        pass`,
      javascript: `class MyStack {\n  constructor() {}\n  push(val) {}\n  pop() {}\n  top() {}\n  empty() {}\n}`,
      typescript: `class MyStack {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  push(val: number): void {\n    throw new Error("Not implemented");\n  }\n  pop(): number {\n    throw new Error("Not implemented");\n  }\n  top(): number {\n    throw new Error("Not implemented");\n  }\n  empty(): boolean {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MyStack {\n    public MyStack() {}\n    public void push(int x) {}\n    public int pop() { return 0; }\n    public int top() { return 0; }\n    public boolean empty() { return false; }\n}`,
      cpp: `class MyStack {\npublic:\n    MyStack() {}\n    void push(int x) {}\n    int pop() { return 0; }\n    int top() { return 0; }\n    bool empty() { return false; }\n};`,
    },
    testcases: [
      { input: { ops: ["push","push","top","pop","empty"], vals: [[1],[2],[],[],[]] }, expectedOutput: [null,null,2,2,false] },
    ],
    hiddentestcases: [
      { input: { ops: ["push","push","push","pop","top","empty"], vals: [[1],[2],[3],[],[],[]] }, expectedOutput: [null,null,null,3,2,false] },
    ],
  },

  {
    id: 155,
    title: "Design HashMap",
    slug: "design-hashmap",
    functionName: "MyHashMap",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Easy",
    topic: "Design",
    pattern: "chaining / open addressing",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Design a HashMap without using any built-in hash table libraries. Implement put(key, value), get(key) (returns -1 if not found), and remove(key).",
    examples: [
      { input: '["MyHashMap","put","put","get","get","put","get","remove","get"]\n[[],[1,1],[2,2],[1],[3],[2,1],[2],[2],[2]]', output: "[null,null,null,1,-1,null,1,null,-1]" },
    ],
    constraints: ["0 <= key, value <= 10^6", "At most 10^4 calls to put, get, remove."],
    starterCode: {
      python: `class MyHashMap:\n    def __init__(self):\n        pass\n    def put(self, key, value):\n        pass\n    def get(self, key):\n        pass\n    def remove(self, key):\n        pass`,
      javascript: `class MyHashMap {\n  constructor() {}\n  put(key, value) {}\n  get(key) { return -1; }\n  remove(key) {}\n}`,
      typescript: `class MyHashMap {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  put(key: number, value: number): void {\n    throw new Error("Not implemented");\n  }\n  get(key: number): number {\n    throw new Error("Not implemented");\n  }\n  remove(key: number): void {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MyHashMap {\n    public MyHashMap() {}\n    public void put(int key, int value) {}\n    public int get(int key) { return -1; }\n    public void remove(int key) {}\n}`,
      cpp: `class MyHashMap {\npublic:\n    MyHashMap() {}\n    void put(int key, int value) {}\n    int get(int key) { return -1; }\n    void remove(int key) {}\n};`,
    },
    testcases: [
      { input: { ops: ["put","put","get","get","put","get","remove","get"], vals: [[1,1],[2,2],[1],[3],[2,1],[2],[2],[2]] }, expectedOutput: [null,null,1,-1,null,1,null,-1] },
    ],
    hiddentestcases: [
      { input: { ops: ["put","put","put","get","remove","get"], vals: [[0,0],[1,1],[0,2],[0],[0],[0]] }, expectedOutput: [null,null,null,2,null,-1] },
    ],
  },

  {
    id: 156,
    title: "Design Circular Queue",
    slug: "design-circular-queue",
    functionName: "MyCircularQueue",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Medium",
    topic: "Design",
    pattern: "ring buffer",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Design your implementation of a circular queue with a fixed capacity k. Implement enQueue, deQueue, Front, Rear, isEmpty, and isFull operations.",
    examples: [
      { input: '["MyCircularQueue","enQueue","enQueue","enQueue","enQueue","Rear","isFull","deQueue","enQueue","Rear"]\n[[3],[1],[2],[3],[4],[],[],[],[4],[]]', output: "[null,true,true,true,false,3,true,true,true,4]" },
    ],
    constraints: ["1 <= k <= 1000", "0 <= value <= 1000", "At most 3000 operations."],
    starterCode: {
      python: `class MyCircularQueue:\n    def __init__(self, k):\n        pass\n    def enQueue(self, value):\n        pass\n    def deQueue(self):\n        pass\n    def Front(self):\n        pass\n    def Rear(self):\n        pass\n    def isEmpty(self):\n        pass\n    def isFull(self):\n        pass`,
      javascript: `class MyCircularQueue {\n  constructor(k) {}\n  enQueue(value) {}\n  deQueue() {}\n  Front() {}\n  Rear() {}\n  isEmpty() {}\n  isFull() {}\n}`,
      typescript: `class MyCircularQueue {\n  constructor(k: number) {\n    throw new Error("Not implemented");\n  }\n  enQueue(value: number): boolean {\n    throw new Error("Not implemented");\n  }\n  deQueue(): boolean {\n    throw new Error("Not implemented");\n  }\n  Front(): number {\n    throw new Error("Not implemented");\n  }\n  Rear(): number {\n    throw new Error("Not implemented");\n  }\n  isEmpty(): boolean {\n    throw new Error("Not implemented");\n  }\n  isFull(): boolean {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MyCircularQueue {\n    public MyCircularQueue(int k) {}\n    public boolean enQueue(int value) { return false; }\n    public boolean deQueue() { return false; }\n    public int Front() { return -1; }\n    public int Rear() { return -1; }\n    public boolean isEmpty() { return false; }\n    public boolean isFull() { return false; }\n}`,
      cpp: `class MyCircularQueue {\npublic:\n    MyCircularQueue(int k) {}\n    bool enQueue(int value) { return false; }\n    bool deQueue() { return false; }\n    int Front() { return -1; }\n    int Rear() { return -1; }\n    bool isEmpty() { return false; }\n    bool isFull() { return false; }\n};`,
    },
    testcases: [
      { input: { k: 3, ops: ["enQueue","enQueue","enQueue","enQueue","Rear","isFull","deQueue","enQueue","Rear"], vals: [[1],[2],[3],[4],[],[],[],[4],[]] }, expectedOutput: [true,true,true,false,3,true,true,true,4] },
    ],
    hiddentestcases: [
      { input: { k: 1, ops: ["enQueue","isFull","deQueue","isEmpty"], vals: [[5],[],[],[]] }, expectedOutput: [true,true,true,true] },
    ],
  },

  { id: 157, title: "Design Twitter", slug: "design-twitter", functionName: "Twitter", operationSequence: { enabled: true, resultMode: "all" }, difficulty: "Medium", topic: "Design", pattern: "heap + timestamp", companies: ["Amazon","Facebook"], description: "Design a simplified version of Twitter with postTweet(userId, tweetId), getNewsFeed(userId) (returns 10 most recent tweets from user + followees), follow(followerId, followeeId), unfollow(followerId, followeeId).", examples: [{ input: '["Twitter","postTweet","getNewsFeed","follow","postTweet","getNewsFeed","unfollow","getNewsFeed"]\n[[],[1,5],[1],[1,2],[2,6],[1],[1,2],[1]]', output: "[null,null,[5],null,null,[6,5],null,[5]]" }], constraints: ["1 <= userId, followerId, followeeId <= 500", "0 <= tweetId <= 10^4", "At most 3 * 10^4 calls."], starterCode: { python: `class Twitter:\n    def __init__(self):\n        pass\n    def postTweet(self, userId, tweetId):\n        pass\n    def getNewsFeed(self, userId):\n        pass\n    def follow(self, followerId, followeeId):\n        pass\n    def unfollow(self, followerId, followeeId):\n        pass`, javascript: `class Twitter {\n  constructor() {}\n  postTweet(userId, tweetId) {}\n  getNewsFeed(userId) { return []; }\n  follow(followerId, followeeId) {}\n  unfollow(followerId, followeeId) {}\n}`, typescript: `class Twitter {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  postTweet(userId: number, tweetId: number): void {\n    throw new Error("Not implemented");\n  }\n  getNewsFeed(userId: number): number[] {\n    throw new Error("Not implemented");\n  }\n  follow(followerId: number, followeeId: number): void {\n    throw new Error("Not implemented");\n  }\n  unfollow(followerId: number, followeeId: number): void {\n    throw new Error("Not implemented");\n  }\n}`, java: `class Twitter {\n    public Twitter() {}\n    public void postTweet(int userId, int tweetId) {}\n    public List<Integer> getNewsFeed(int userId) { return new ArrayList<>(); }\n    public void follow(int followerId, int followeeId) {}\n    public void unfollow(int followerId, int followeeId) {}\n}`, cpp: `class Twitter {\npublic:\n    Twitter() {}\n    void postTweet(int userId, int tweetId) {}\n    vector<int> getNewsFeed(int userId) { return {}; }\n    void follow(int followerId, int followeeId) {}\n    void unfollow(int followerId, int followeeId) {}\n};` }, testcases: [{ input: { ops: ["postTweet","getNewsFeed","follow","postTweet","getNewsFeed","unfollow","getNewsFeed"], vals: [[1,5],[1],[1,2],[2,6],[1],[1,2],[1]] }, expectedOutput: [null,[5],null,null,[6,5],null,[5]] }], hiddentestcases: [{ input: { ops: ["postTweet","follow","getNewsFeed"], vals: [[2,5],[1,2],[1]] }, expectedOutput: [null,null,[5]] }] },

  { id: 158, title: "Random Pick with Weight", slug: "random-pick-with-weight", functionName: "Solution", difficulty: "Medium", topic: "Binary Search", pattern: "prefix sum + binary search", comingSoon: true, companies: ["Facebook","Google","Amazon"], description: "Implement Solution(w) which picks an index in [0, w.length-1] with probability proportional to w[i]. pickIndex() returns a random index according to this distribution.", examples: [{ input: "w = [1,3], pickIndex called", output: "Returns 0 with 25% probability, 1 with 75% probability" }], constraints: ["1 <= w.length <= 10^4", "1 <= w[i] <= 10^5", "pickIndex called at most 10^4 times"], starterCode: { python: `class Solution:\n    def __init__(self, w):\n        pass\n    def pickIndex(self):\n        pass`, javascript: `class Solution {\n  constructor(w) {}\n  pickIndex() { return 0; }\n}`, typescript: `class Solution {\n  constructor(w: number[]) {\n    throw new Error("Not implemented");\n  }\n  pickIndex(): number {\n    throw new Error("Not implemented");\n  }\n}`, java: `class Solution {\n    public Solution(int[] w) {}\n    public int pickIndex() { return 0; }\n}`, cpp: `class Solution {\npublic:\n    Solution(vector<int>& w) {}\n    int pickIndex() { return 0; }\n};` }, testcases: [{ input: { w: [1], ops: ["pickIndex"] }, expectedOutput: [0] }, { input: { w: [1,3], ops: ["pickIndex","pickIndex","pickIndex","pickIndex"] }, expectedOutput: "varies" }], hiddentestcases: [{ input: { w: [1,1,1,1], ops: ["pickIndex"] }, expectedOutput: "0-3" }] },

  {
    id: 159,
    title: "Maximum Frequency Stack",
    slug: "maximum-frequency-stack",
    functionName: "FreqStack",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Hard",
    topic: "Design",
    pattern: "frequency groups stack",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Design a stack-like data structure to push integers and pop the most frequently occurring element. FreqStack: push(val) pushes val onto the stack. pop() removes and returns the most frequent element. If tie, return the most recently pushed element.",
    examples: [
      { input: '["FreqStack","push","push","push","push","push","push","pop","pop","pop","pop"]\n[[],[5],[7],[5],[7],[4],[5],[],[],[],[]]', output: "[null,null,null,null,null,null,null,5,7,5,4]" },
    ],
    constraints: ["0 <= val <= 10^9", "At most 2 * 10^4 calls to push and pop.", "Pop guarantee: stack is non-empty."],
    starterCode: {
      python: `class FreqStack:\n    def __init__(self):\n        pass\n    def push(self, val):\n        pass\n    def pop(self):\n        pass`,
      javascript: `class FreqStack {\n  constructor() {}\n  push(val) {}\n  pop() { return 0; }\n}`,
      typescript: `class FreqStack {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  push(val: number): void {\n    throw new Error("Not implemented");\n  }\n  pop(): number {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class FreqStack {\n    public FreqStack() {}\n    public void push(int val) {}\n    public int pop() { return 0; }\n}`,
      cpp: `class FreqStack {\npublic:\n    FreqStack() {}\n    void push(int val) {}\n    int pop() { return 0; }\n};`,
    },
    testcases: [
      { input: { ops: ["push","push","push","push","push","push","pop","pop","pop","pop"], vals: [[5],[7],[5],[7],[4],[5],[],[],[],[]] }, expectedOutput: [null,null,null,null,null,null,5,7,5,4] },
    ],
    hiddentestcases: [
      { input: { ops: ["push","push","push","pop","pop"], vals: [[1],[1],[2],[],[]] }, expectedOutput: [null,null,null,1,2] },
    ],
  },

  {
    id: 160,
    title: "Sliding Window Maximum",
    slug: "sliding-window-maximum",
    functionName: "maxSlidingWindow",
    difficulty: "Hard",
    topic: "Sliding Window",
    pattern: "monotonic deque",
    sourceType: "core",
    companies: ["Amazon", "Google", "Facebook", "Microsoft"],
    description: "Given an integer array nums and an integer k, return an array of the maximum value in each sliding window of size k as it moves from left to right.",
    examples: [
      { input: "nums = [1,3,-1,-3,5,3,6,7], k = 3", output: "[3,3,5,5,6,7]" },
      { input: "nums = [1], k = 1", output: "[1]" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4", "1 <= k <= nums.length"],
    starterCode: {
      python: `class Solution:\n    def maxSlidingWindow(self, nums, k):\n        pass`,
      javascript: `function maxSlidingWindow(nums, k) {\n\n}`,
      typescript: `function maxSlidingWindow(nums: number[], k: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] maxSlidingWindow(int[] nums, int k) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> maxSlidingWindow(vector<int>& nums, int k) {\n        return {};\n    }\n};`,
      c: `int* maxSlidingWindow(int* nums, int numsSize, int k, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { nums: [1,3,-1,-3,5,3,6,7], k: 3 }, expectedOutput: [3,3,5,5,6,7] },
      { input: { nums: [1], k: 1 }, expectedOutput: [1] },
      { input: { nums: [1,-1], k: 1 }, expectedOutput: [1,-1] },
    ],
    hiddentestcases: [
      { input: { nums: [9,11], k: 2 }, expectedOutput: [11] },
      { input: { nums: [4,3,11,2], k: 2 }, expectedOutput: [4,11,11] },
    ],
  },

  // ── BATCH 042: Mixed Hard + Company-Specific (IDs 161-170) ───────────────

  { id: 161, title: "Path With Minimum Effort", slug: "path-with-minimum-effort", functionName: "minimumEffortPath", difficulty: "Medium", topic: "Graphs", pattern: "union find", companies: ["LinkedIn","Amazon"], description: "You are given a rows x columns matrix heights, where heights[row][col] represents the height of cell (row, col). You start at (0, 0) and want to travel to (rows-1, columns-1). You can move up, down, left, or right, and you want to find a route that minimizes the maximum absolute difference in heights between two consecutive cells of the route. Return the minimum effort required to travel from the top-left cell to the bottom-right cell.", examples: [{ input: "heights = [[1,2,2],[3,8,2],[5,3,5]]", output: "2", explanation: "The route [1,3,5,3,5] down the left column then right along the bottom has a maximum absolute difference of 2." }, { input: "heights = [[1,2,3],[3,8,4],[5,3,5]]", output: "1", explanation: "The route [1,2,3,4,5] along the top row then down the right column has a maximum absolute difference of 1." }, { input: "heights = [[1]]", output: "0", explanation: "Start and end are the same single cell, so no movement is required." }], constraints: ["rows == heights.length", "columns == heights[i].length", "1 <= rows, columns <= 100", "1 <= heights[i][j] <= 10^6"], starterCode: { python: `class Solution:\n    def minimumEffortPath(self, heights):\n        pass`, javascript: `function minimumEffortPath(heights) {\n\n}`, typescript: `function minimumEffortPath(heights: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int minimumEffortPath(int[][] heights) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int minimumEffortPath(vector<vector<int>>& heights) { return 0; }\n};` }, testcases: [{ input: { heights: [[1,2,2],[3,8,2],[5,3,5]] }, expectedOutput: 2 }, { input: { heights: [[1,2,3],[3,8,4],[5,3,5]] }, expectedOutput: 1 }, { input: { heights: [[1]] }, expectedOutput: 0 }], hiddentestcases: [{ input: { heights: [[1,10,6,7,9,10,4,9]] }, expectedOutput: 9 }, { input: { heights: [[1,2,1,1,1],[1,2,1,2,1],[1,2,1,2,1],[1,2,1,2,1],[1,1,1,2,1]] }, expectedOutput: 0 }] },

  {
    id: 162,
    title: "Reverse Nodes in k-Group",
    slug: "reverse-nodes-in-k-group",
    functionName: "reverseKGroup",
    difficulty: "Hard",
    topic: "Linked List",
    pattern: "iterative group reversal",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given the head of a linked list, reverse the nodes of the list k at a time, and return the modified list. k is a positive integer ≤ n. If n is not a multiple of k, the last remaining nodes should remain as-is.",
    examples: [
      { input: "head = [1,2,3,4,5], k = 2", output: "[2,1,4,3,5]" },
      { input: "head = [1,2,3,4,5], k = 3", output: "[3,2,1,4,5]" },
    ],
    constraints: ["1 <= k <= n <= 5000", "0 <= Node.val <= 1000"],
    starterCode: {
      python: `class Solution:\n    def reverseKGroup(self, head, k):\n        pass`,
      javascript: `function reverseKGroup(head, k) {\n\n}`,
      typescript: `function reverseKGroup(head: any, k: number): any {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public ListNode reverseKGroup(ListNode head, int k) {\n        return null;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    ListNode* reverseKGroup(ListNode* head, int k) {\n        return nullptr;\n    }\n};`,
    },
    testcases: [
      { input: { head: [1,2,3,4,5], k: 2 }, expectedOutput: [2,1,4,3,5] },
      { input: { head: [1,2,3,4,5], k: 3 }, expectedOutput: [3,2,1,4,5] },
      { input: { head: [1,2,3,4,5], k: 1 }, expectedOutput: [1,2,3,4,5] },
    ],
    hiddentestcases: [
      { input: { head: [1], k: 1 }, expectedOutput: [1] },
      { input: { head: [1,2], k: 2 }, expectedOutput: [2,1] },
    ],
  },

  {
    id: 163,
    title: "Longest Valid Parentheses",
    slug: "longest-valid-parentheses",
    functionName: "longestValidParentheses",
    difficulty: "Hard",
    topic: "Stacks",
    pattern: "stack index tracking",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given a string containing just '(' and ')', return the length of the longest valid (well-formed) parentheses substring.",
    examples: [
      { input: 's = "(()"', output: "2" },
      { input: 's = ")()())"', output: "4" },
      { input: 's = ""', output: "0" },
    ],
    constraints: ["0 <= s.length <= 3 * 10^4", "s[i] is '(' or ')'."],
    starterCode: {
      python: `class Solution:\n    def longestValidParentheses(self, s):\n        pass`,
      javascript: `function longestValidParentheses(s) {\n\n}`,
      typescript: `function longestValidParentheses(s: string): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int longestValidParentheses(String s) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int longestValidParentheses(string s) {\n        return 0;\n    }\n};`,
      c: `int longestValidParentheses(char* s) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { s: "(()" }, expectedOutput: 2 },
      { input: { s: ")()())" }, expectedOutput: 4 },
      { input: { s: "" }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { s: "()()" }, expectedOutput: 4 },
      { input: { s: "(((" }, expectedOutput: 0 },
    ],
  },

  { id: 164, title: "Shortest Bridge", slug: "shortest-bridge", functionName: "shortestBridge", difficulty: "Medium", topic: "Graphs", pattern: "DFS island marking + multi-source BFS", companies: ["Amazon","Google"], description: "You are given an n x n binary matrix grid where 1 represents land and 0 represents water. An island is a group of 1's connected 4-directionally. The grid contains exactly two islands. You may change any 0 to a 1 to connect the two islands into one. Return the smallest number of 0's you must flip to connect the two islands.", examples: [{ input: "grid = [[0,1],[1,0]]", output: "1", explanation: "The two single-cell islands at (0,1) and (1,0) are 2 apart (Manhattan distance), so 1 flip connects them." }, { input: "grid = [[0,1,0],[0,0,0],[0,0,1]]", output: "2", explanation: "The islands at (0,1) and (2,2) are 3 apart, so 2 flips connect them." }, { input: "grid = [[1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]]", output: "1", explanation: "The outer ring and the single center cell are separated by a ring of water only 1 cell thick at the closest point." }], constraints: ["n == grid.length == grid[i].length", "2 <= n <= 100", "grid[i][j] is either 0 or 1", "There are exactly two islands in grid"], starterCode: { python: `class Solution:\n    def shortestBridge(self, grid):\n        pass`, javascript: `function shortestBridge(grid) {\n\n}`, typescript: `function shortestBridge(grid: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int shortestBridge(int[][] grid) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int shortestBridge(vector<vector<int>>& grid) { return 0; }\n};` }, testcases: [{ input: { grid: [[0,1],[1,0]] }, expectedOutput: 1 }, { input: { grid: [[0,1,0],[0,0,0],[0,0,1]] }, expectedOutput: 2 }, { input: { grid: [[1,1,1,1,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,0,0,1],[1,1,1,1,1]] }, expectedOutput: 1 }], hiddentestcases: [{ input: { grid: [[1,0],[0,1]] }, expectedOutput: 1 }, { input: { grid: [[1,1,0],[0,0,0],[0,1,1]] }, expectedOutput: 1 }] },

  { id: 165, title: "Optimize Water Distribution in a Village", slug: "optimize-water-distribution", functionName: "minCostToSupplyWater", difficulty: "Hard", topic: "Graphs", pattern: "MST with a virtual source node", companies: ["Amazon","Google"], description: "There are n houses in a village, numbered 1 to n. For each house i, you can either build a well directly in that house at cost wells[i-1], or connect it to another house via a pipe. pipes[j] = [house1, house2, cost] represents a bidirectional pipe between house1 and house2 with the given cost. Return the minimum total cost to supply water to all houses (every house must end up with water, either from its own well or via a chain of pipes to a house that has a well).", examples: [{ input: "n = 3, wells = [1,2,2], pipes = [[1,2,1],[2,3,1]]", output: "3", explanation: "Build a well at house 1 (cost 1), then pipe 1-2 (cost 1) and pipe 2-3 (cost 1), total 3 — cheaper than any other combination." }, { input: "n = 2, wells = [1,1], pipes = [[1,2,1]]", output: "2", explanation: "Build a well at house 1 (cost 1) and a pipe to house 2 (cost 1), total 2." }], constraints: ["1 <= n <= 10^4", "wells.length == n", "0 <= wells[i] <= 10^5", "1 <= pipes.length <= 10^4", "pipes[j].length == 3", "1 <= house1_j, house2_j <= n", "0 <= cost_j <= 10^5", "house1_j != house2_j"], starterCode: { python: `class Solution:\n    def minCostToSupplyWater(self, n, wells, pipes):\n        pass`, javascript: `function minCostToSupplyWater(n, wells, pipes) {\n\n}`, typescript: `function minCostToSupplyWater(n: number, wells: number[], pipes: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int minCostToSupplyWater(int n, int[] wells, int[][] pipes) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int minCostToSupplyWater(int n, vector<int>& wells, vector<vector<int>>& pipes) { return 0; }\n};` }, testcases: [{ input: { n: 3, wells: [1,2,2], pipes: [[1,2,1],[2,3,1]] }, expectedOutput: 3 }, { input: { n: 2, wells: [1,1], pipes: [[1,2,1]] }, expectedOutput: 2 }], hiddentestcases: [{ input: { n: 1, wells: [5], pipes: [] }, expectedOutput: 5 }, { input: { n: 3, wells: [10,10,10], pipes: [[1,2,1],[1,3,1]] }, expectedOutput: 12 }] },

  { id: 166, title: "Minimum Genetic Mutation", slug: "minimum-genetic-mutation", functionName: "minMutation", difficulty: "Medium", topic: "Graphs", pattern: "BFS shortest path over strings", companies: ["Amazon","Facebook","Google"], description: "A gene string is an 8-character string made only of the characters 'A', 'C', 'G', and 'T'. A single mutation changes exactly one character in the gene string. There is also a bank of valid gene strings — every gene the string mutates into (including the final endGene) must appear in bank. Given startGene, endGene, and bank, return the minimum number of mutations needed to mutate startGene into endGene. If there is no such path, return -1. Note that startGene itself does not need to be in bank.", examples: [{ input: "startGene = \"AACCGGTT\", endGene = \"AACCGGTA\", bank = [\"AACCGGTA\"]", output: "1", explanation: "Changing the last character T to A produces endGene directly, and \"AACCGGTA\" is in bank." }, { input: "startGene = \"AACCGGTT\", endGene = \"AAACGGTA\", bank = [\"AACCGGTA\",\"AACCGCTA\",\"AAACGGTA\"]", output: "2", explanation: "AACCGGTT -> AACCGGTA -> AAACGGTA, both intermediate/final genes are in bank, so 2 mutations suffice." }, { input: "startGene = \"AAAAACCC\", endGene = \"AACCCCCC\", bank = [\"AAAACCCC\",\"AAACCCCC\",\"AACCCCCC\"]", output: "3", explanation: "AAAAACCC -> AAAACCCC -> AAACCCCC -> AACCCCCC, one character changes at a time and every step is in bank." }], constraints: ["0 <= bank.length <= 10", "startGene.length == endGene.length == bank[i].length == 8", "startGene, endGene, and bank[i] consist of only the characters 'A', 'C', 'G', and 'T'"], starterCode: { python: `class Solution:\n    def minMutation(self, startGene, endGene, bank):\n        pass`, javascript: `function minMutation(startGene, endGene, bank) {\n\n}`, typescript: `function minMutation(startGene: string, endGene: string, bank: string[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int minMutation(String startGene, String endGene, String[] bank) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int minMutation(string startGene, string endGene, vector<string>& bank) { return 0; }\n};`, c: `int minMutation(char* startGene, char* endGene, char** bank, int bankSize) {\n    return 0;\n}` }, testcases: [{ input: { startGene: "AACCGGTT", endGene: "AACCGGTA", bank: ["AACCGGTA"] }, expectedOutput: 1 }, { input: { startGene: "AACCGGTT", endGene: "AAACGGTA", bank: ["AACCGGTA","AACCGCTA","AAACGGTA"] }, expectedOutput: 2 }, { input: { startGene: "AAAAACCC", endGene: "AACCCCCC", bank: ["AAAACCCC","AAACCCCC","AACCCCCC"] }, expectedOutput: 3 }], hiddentestcases: [{ input: { startGene: "AACCGGTT", endGene: "AACCGGTA", bank: [] }, expectedOutput: -1 }, { input: { startGene: "AAAAAAAA", endGene: "AAAAAAAA", bank: [] }, expectedOutput: 0 }] },

  {
    id: 167,
    title: "Kth Smallest Element in BST",
    slug: "kth-smallest-element-in-bst",
    functionName: "kthSmallest",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "inorder traversal",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Bloomberg"],
    description: "Given the root of a binary search tree and an integer k, return the kth smallest value (1-indexed) among all values in the tree.",
    examples: [
      { input: "root = [3,1,4,null,2], k = 1", output: "1" },
      { input: "root = [5,3,6,2,4,null,null,1], k = 3", output: "3" },
    ],
    constraints: ["1 <= k <= n <= 10^4", "0 <= Node.val <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def kthSmallest(self, root, k):\n        pass`,
      javascript: `function kthSmallest(root, k) {\n\n}`,
      typescript: `function kthSmallest(root: any, k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int kthSmallest(TreeNode root, int k) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int kthSmallest(TreeNode* root, int k) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { root: [3,1,4,null,2], k: 1 }, expectedOutput: 1 },
      { input: { root: [5,3,6,2,4,null,null,1], k: 3 }, expectedOutput: 3 },
      { input: { root: [1], k: 1 }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { root: [2,1,3], k: 2 }, expectedOutput: 2 },
      { input: { root: [5,3,6,2,4], k: 4 }, expectedOutput: 5 },
    ],
  },

  {
    id: 168,
    title: "Path Sum II",
    slug: "path-sum-ii",
    functionName: "pathSum",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "DFS backtracking",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given the root of a binary tree and an integer targetSum, return all root-to-leaf paths where the sum of node values equals targetSum. Each path should be returned as a list of node values.",
    examples: [
      { input: "root = [5,4,8,11,null,13,4,7,2,null,null,5,1], targetSum = 22", output: "[[5,4,11,2],[5,8,4,5]]" },
      { input: "root = [1,2,3], targetSum = 5", output: "[]" },
    ],
    constraints: ["0 <= n <= 5000", "-1000 <= Node.val <= 1000", "-1000 <= targetSum <= 1000"],
    starterCode: {
      python: `class Solution:\n    def pathSum(self, root, targetSum):\n        pass`,
      javascript: `function pathSum(root, targetSum) {\n\n}`,
      typescript: `function pathSum(root: any, targetSum: number): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> pathSum(TreeNode root, int targetSum) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> pathSum(TreeNode* root, int targetSum) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { root: [5,4,8,11,null,13,4,7,2,null,null,5,1], targetSum: 22 }, expectedOutput: [[5,4,11,2],[5,8,4,5]] },
      { input: { root: [1,2,3], targetSum: 5 }, expectedOutput: [] },
      { input: { root: [], targetSum: 0 }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { root: [1,2], targetSum: 1 }, expectedOutput: [] },
      { input: { root: [1,2], targetSum: 3 }, expectedOutput: [[1,2]] },
    ],
  },

  {
    id: 169,
    title: "Maximum Width of Binary Tree",
    slug: "maximum-width-of-binary-tree",
    functionName: "widthOfBinaryTree",
    difficulty: "Medium",
    topic: "Trees",
    pattern: "BFS with index tracking",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given the root of a binary tree, return the maximum width of the tree. The width of one level is the length from the leftmost to the rightmost non-null node including null nodes between them.",
    examples: [
      { input: "root = [1,3,2,5,3,null,9]", output: "4" },
      { input: "root = [1,3,2,5,null,null,9,6,null,7]", output: "7" },
      { input: "root = [1,3,2,5]", output: "2" },
    ],
    constraints: ["1 <= n <= 3000", "-100 <= Node.val <= 100"],
    starterCode: {
      python: `class Solution:\n    def widthOfBinaryTree(self, root):\n        pass`,
      javascript: `function widthOfBinaryTree(root) {\n\n}`,
      typescript: `function widthOfBinaryTree(root: any): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int widthOfBinaryTree(TreeNode root) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int widthOfBinaryTree(TreeNode* root) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { root: [1,3,2,5,3,null,9] }, expectedOutput: 4 },
      { input: { root: [1,3,2,5,null,null,9,6,null,7] }, expectedOutput: 7 },
      { input: { root: [1,3,2,5] }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { root: [1] }, expectedOutput: 1 },
      { input: { root: [1,2,3] }, expectedOutput: 2 },
    ],
  },

  {
    id: 170,
    title: "Number of Ways to Reach a Position After Exactly k Steps",
    slug: "number-of-ways-k-steps",
    functionName: "numberOfWays",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "1D DP offset array",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "You are on an infinite number line at position startPos. You must perform exactly k steps — each step moves you one position left or right. Return the number of ways to reach endPos after exactly k steps modulo 10^9+7.",
    examples: [
      { input: "startPos = 1, endPos = 2, k = 3", output: "3", explanation: "1→2→3→2, 1→2→1→2, 1→0→1→2" },
      { input: "startPos = 2, endPos = 5, k = 10", output: "0" },
    ],
    constraints: ["1 <= startPos, endPos, k <= 1000"],
    starterCode: {
      python: `class Solution:\n    def numberOfWays(self, startPos, endPos, k):\n        pass`,
      javascript: `function numberOfWays(startPos, endPos, k) {\n\n}`,
      typescript: `function numberOfWays(startPos: number, endPos: number, k: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int numberOfWays(int startPos, int endPos, int k) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int numberOfWays(int startPos, int endPos, int k) {\n        return 0;\n    }\n};`,
      c: `int numberOfWays(int startPos, int endPos, int k) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { startPos: 1, endPos: 2, k: 3 }, expectedOutput: 3 },
      { input: { startPos: 2, endPos: 5, k: 10 }, expectedOutput: 0 },
      { input: { startPos: 1, endPos: 1, k: 0 }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { startPos: 0, endPos: 0, k: 2 }, expectedOutput: 2 },
      { input: { startPos: 1000, endPos: 1, k: 999 }, expectedOutput: 1 },
    ],
  },

  // ── BATCH 043: More DP + More Graphs (IDs 171-180) ────────────────────────

  { id: 171, title: "Distinct Subsequences", slug: "distinct-subsequences", functionName: "numDistinct", difficulty: "Hard", topic: "Dynamic Programming", pattern: "2D DP subsequence count", companies: ["Google","Facebook"], description: "Given two strings s and t, return the number of distinct subsequences of s which equals t.", examples: [{ input: 's = "rabbbit", t = "rabbit"', output: "3" }, { input: 's = "babgbag", t = "bag"', output: "5" }], constraints: ["1 <= s.length, t.length <= 1000", "s and t consist of English letters."], starterCode: { python: `class Solution:\n    def numDistinct(self, s, t):\n        pass`, javascript: `function numDistinct(s, t) {\n\n}`, typescript: `function numDistinct(s: string, t: string): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int numDistinct(String s, String t) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int numDistinct(string s, string t) { return 0; }\n};`, c: `int numDistinct(char* s, char* t) {\n    return 0;\n}` }, testcases: [{ input: { s: "rabbbit", t: "rabbit" }, expectedOutput: 3 }, { input: { s: "babgbag", t: "bag" }, expectedOutput: 5 }], hiddentestcases: [{ input: { s: "b", t: "b" }, expectedOutput: 1 }, { input: { s: "aabb", t: "ab" }, expectedOutput: 4 }] },

  { id: 172, title: "Interleaving String", slug: "interleaving-string", functionName: "isInterleave", difficulty: "Medium", topic: "Dynamic Programming", pattern: "2D DP interleave check", companies: ["Amazon","Google"], description: "Given strings s1, s2, s3, return true if s3 is formed by an interleaving of s1 and s2.", examples: [{ input: 's1 = "aabcc", s2 = "dbbca", s3 = "aadbbcbcac"', output: "true" }, { input: 's1 = "aabcc", s2 = "dbbca", s3 = "aadbbbaccc"', output: "false" }], constraints: ["0 <= s1.length, s2.length <= 100", "0 <= s3.length <= 200"], starterCode: { python: `class Solution:\n    def isInterleave(self, s1, s2, s3):\n        pass`, javascript: `function isInterleave(s1, s2, s3) {\n\n}`, typescript: `function isInterleave(s1: string, s2: string, s3: string): boolean {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public boolean isInterleave(String s1, String s2, String s3) { return false; }\n}`, cpp: `class Solution {\npublic:\n    bool isInterleave(string s1, string s2, string s3) { return false; }\n};`, c: `bool isInterleave(char* s1, char* s2, char* s3) {\n    return false;\n}` }, testcases: [{ input: { s1: "aabcc", s2: "dbbca", s3: "aadbbcbcac" }, expectedOutput: true }, { input: { s1: "aabcc", s2: "dbbca", s3: "aadbbbaccc" }, expectedOutput: false }, { input: { s1: "", s2: "", s3: "" }, expectedOutput: true }], hiddentestcases: [{ input: { s1: "a", s2: "b", s3: "ab" }, expectedOutput: true }, { input: { s1: "a", s2: "b", s3: "ba" }, expectedOutput: true }] },

  {
    id: 173,
    title: "Min Cost Climbing Stairs",
    slug: "min-cost-climbing-stairs",
    functionName: "minCostClimbingStairs",
    difficulty: "Easy",
    topic: "Dynamic Programming",
    pattern: "1D DP",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "You are given an integer array cost where cost[i] is the cost of the ith step on a staircase. Once you pay the cost, you can climb one or two steps. You can start from step 0 or step 1. Return the minimum cost to reach the top.",
    examples: [
      { input: "cost = [10,15,20]", output: "15" },
      { input: "cost = [1,100,1,1,1,100,1,1,100,1]", output: "6" },
    ],
    constraints: ["2 <= cost.length <= 1000", "0 <= cost[i] <= 999"],
    starterCode: {
      python: `class Solution:\n    def minCostClimbingStairs(self, cost):\n        pass`,
      javascript: `function minCostClimbingStairs(cost) {\n\n}`,
      typescript: `function minCostClimbingStairs(cost: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int minCostClimbingStairs(int[] cost) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int minCostClimbingStairs(vector<int>& cost) {\n        return 0;\n    }\n};`,
      c: `int minCostClimbingStairs(int* cost, int costSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { cost: [10,15,20] }, expectedOutput: 15 },
      { input: { cost: [1,100,1,1,1,100,1,1,100,1] }, expectedOutput: 6 },
      { input: { cost: [0,0] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { cost: [1,2,3] }, expectedOutput: 2 },
      { input: { cost: [10,15] }, expectedOutput: 10 },
    ],
  },

  {
    id: 174,
    title: "Triangle",
    slug: "triangle",
    functionName: "minimumTotal",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "bottom-up DP",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given a triangle array, return the minimum path sum from top to bottom. For each step, you may move to an adjacent number in the row below. Use O(n) extra space.",
    examples: [
      { input: "triangle = [[2],[3,4],[6,5,7],[4,1,8,3]]", output: "11", explanation: "Path: 2→3→5→1 = 11" },
      { input: "triangle = [[-10]]", output: "-10" },
    ],
    constraints: ["1 <= triangle.length <= 200", "triangle[0].length == 1", "triangle[i].length == triangle[i-1].length + 1", "-10^4 <= triangle[i][j] <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def minimumTotal(self, triangle):\n        pass`,
      javascript: `function minimumTotal(triangle) {\n\n}`,
      typescript: `function minimumTotal(triangle: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int minimumTotal(List<List<Integer>> triangle) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int minimumTotal(vector<vector<int>>& triangle) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { triangle: [[2],[3,4],[6,5,7],[4,1,8,3]] }, expectedOutput: 11 },
      { input: { triangle: [[-10]] }, expectedOutput: -10 },
    ],
    hiddentestcases: [
      { input: { triangle: [[-1],[2,3],[1,-1,-3]] }, expectedOutput: -1 },
    ],
  },

  {
    id: 175,
    title: "Perfect Squares",
    slug: "perfect-squares",
    functionName: "numSquares",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "BFS / DP with squares",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "Given an integer n, return the least number of perfect square numbers (1, 4, 9, 16, ...) that sum to n.",
    examples: [
      { input: "n = 12", output: "3", explanation: "12 = 4+4+4" },
      { input: "n = 13", output: "2", explanation: "13 = 4+9" },
    ],
    constraints: ["1 <= n <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def numSquares(self, n):\n        pass`,
      javascript: `function numSquares(n) {\n\n}`,
      typescript: `function numSquares(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int numSquares(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int numSquares(int n) {\n        return 0;\n    }\n};`,
      c: `int numSquares(int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { n: 12 }, expectedOutput: 3 },
      { input: { n: 13 }, expectedOutput: 2 },
      { input: { n: 1 }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { n: 4 }, expectedOutput: 1 },
      { input: { n: 7 }, expectedOutput: 4 },
    ],
  },

  {
    id: 176,
    title: "Graph Valid Tree",
    slug: "graph-valid-tree",
    functionName: "validTree",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "union find / BFS cycle detection",
    sourceType: "core",
    companies: ["LinkedIn", "Google"],
    description: "Given n nodes labeled 0 to n-1 and a list of undirected edges, return true if the edges form a valid tree (connected and no cycles).",
    examples: [
      { input: "n = 5, edges = [[0,1],[0,2],[0,3],[1,4]]", output: "true" },
      { input: "n = 5, edges = [[0,1],[1,2],[2,3],[1,3],[1,4]]", output: "false" },
    ],
    constraints: ["1 <= n <= 2000", "0 <= edges.length <= 5000", "edges[i].length == 2", "0 <= ai, bi < n", "ai != bi", "No repeated edges."],
    starterCode: {
      python: `class Solution:\n    def validTree(self, n, edges):\n        pass`,
      javascript: `function validTree(n, edges) {\n\n}`,
      typescript: `function validTree(n: number, edges: number[][]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean validTree(int n, int[][] edges) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool validTree(int n, vector<vector<int>>& edges) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { n: 5, edges: [[0,1],[0,2],[0,3],[1,4]] }, expectedOutput: true },
      { input: { n: 5, edges: [[0,1],[1,2],[2,3],[1,3],[1,4]] }, expectedOutput: false },
      { input: { n: 1, edges: [] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { n: 2, edges: [] }, expectedOutput: false },
      { input: { n: 3, edges: [[0,1],[1,2],[0,2]] }, expectedOutput: false },
    ],
  },

  {
    id: 177,
    title: "Accounts Merge",
    slug: "accounts-merge",
    functionName: "accountsMerge",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "union find on emails",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given a list of accounts where each account has a name and emails, merge accounts that share at least one email. Return merged accounts with name and sorted emails.",
    examples: [
      { input: 'accounts = [["John","johnsmith@mail.com","john_newyork@mail.com"],["John","johnsmith@mail.com","john00@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]', output: '[["John","john00@mail.com","john_newyork@mail.com","johnsmith@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]]' },
    ],
    constraints: ["1 <= accounts.length <= 1000", "2 <= accounts[i].length <= 10", "1 <= accounts[i][j].length <= 30"],
    starterCode: {
      python: `class Solution:\n    def accountsMerge(self, accounts):\n        pass`,
      javascript: `function accountsMerge(accounts) {\n\n}`,
      typescript: `function accountsMerge(accounts: string[][]): string[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<String>> accountsMerge(List<List<String>> accounts) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<string>> accountsMerge(vector<vector<string>>& accounts) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { accounts: [["John","johnsmith@mail.com","john_newyork@mail.com"],["John","johnsmith@mail.com","john00@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]] }, expectedOutput: [["John","john00@mail.com","john_newyork@mail.com","johnsmith@mail.com"],["Mary","mary@mail.com"],["John","johnnybravo@mail.com"]] },
    ],
    hiddentestcases: [
      { input: { accounts: [["Gabe","Gabe0@m.co","Gabe3@m.co","Gabe1@m.co"],["Kevin","Kevin3@m.co","Kevin5@m.co"],["Ethan","Ethan5@m.co"]] }, expectedOutput: [["Gabe","Gabe0@m.co","Gabe1@m.co","Gabe3@m.co"],["Kevin","Kevin3@m.co","Kevin5@m.co"],["Ethan","Ethan5@m.co"]] },
    ],
  },

  {
    id: 178,
    title: "Keys and Rooms",
    slug: "keys-and-rooms",
    functionName: "canVisitAllRooms",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "DFS reachability",
    sourceType: "core",
    companies: ["Amazon"],
    description: "There are n rooms. Room 0 is unlocked. Each room i has a list of keys to other rooms. Return true if you can visit every room starting from room 0.",
    examples: [
      { input: "rooms = [[1],[2],[3],[]]", output: "true" },
      { input: "rooms = [[1,3],[3,0,1],[2],[0]]", output: "false" },
    ],
    constraints: ["2 <= n <= 1000", "0 <= rooms[i].length <= 1000", "1 <= sum(rooms[i].length) <= 3000", "0 <= rooms[i][j] < n", "rooms[i][j] != i"],
    starterCode: {
      python: `class Solution:\n    def canVisitAllRooms(self, rooms):\n        pass`,
      javascript: `function canVisitAllRooms(rooms) {\n\n}`,
      typescript: `function canVisitAllRooms(rooms: number[][]): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean canVisitAllRooms(List<List<Integer>> rooms) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool canVisitAllRooms(vector<vector<int>>& rooms) {\n        return false;\n    }\n};`,
    },
    testcases: [
      { input: { rooms: [[1],[2],[3],[]] }, expectedOutput: true },
      { input: { rooms: [[1,3],[3,0,1],[2],[0]] }, expectedOutput: false },
      { input: { rooms: [[1],[0]] }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { rooms: [[2,3],[],[2],[1,3]] }, expectedOutput: false },
    ],
  },

  {
    id: 179,
    title: "Find the Town Judge",
    slug: "find-the-town-judge",
    functionName: "findJudge",
    difficulty: "Easy",
    topic: "Graphs",
    pattern: "in-degree / out-degree",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "In a town of n people, the town judge trusts nobody but is trusted by everyone else. Given trust[i] = [ai, bi] meaning ai trusts bi, return the label of the town judge if they exist, or -1 otherwise.",
    examples: [
      { input: "n = 2, trust = [[1,2]]", output: "2" },
      { input: "n = 3, trust = [[1,3],[2,3]]", output: "3" },
      { input: "n = 3, trust = [[1,3],[2,3],[3,1]]", output: "-1" },
    ],
    constraints: ["1 <= n <= 1000", "0 <= trust.length <= 10^4", "trust[i].length == 2", "All trust pairs are distinct."],
    starterCode: {
      python: `class Solution:\n    def findJudge(self, n, trust):\n        pass`,
      javascript: `function findJudge(n, trust) {\n\n}`,
      typescript: `function findJudge(n: number, trust: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findJudge(int n, int[][] trust) {\n        return -1;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findJudge(int n, vector<vector<int>>& trust) {\n        return -1;\n    }\n};`,
    },
    testcases: [
      { input: { n: 2, trust: [[1,2]] }, expectedOutput: 2 },
      { input: { n: 3, trust: [[1,3],[2,3]] }, expectedOutput: 3 },
      { input: { n: 3, trust: [[1,3],[2,3],[3,1]] }, expectedOutput: -1 },
    ],
    hiddentestcases: [
      { input: { n: 1, trust: [] }, expectedOutput: 1 },
      { input: { n: 4, trust: [[1,3],[1,4],[2,3],[2,4],[4,3]] }, expectedOutput: 3 },
    ],
  },

  {
    id: 180,
    title: "All Paths From Source to Target",
    slug: "all-paths-source-to-target",
    functionName: "allPathsSourceTarget",
    // List of paths may be returned in any order (each path's own node
    // sequence still matters) — audit P0-3.
    comparisonMode: "unordered",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "DFS backtracking on DAG",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given a directed acyclic graph (DAG) of n nodes, find all possible paths from node 0 to node n-1 and return them in any order. The graph is given as adjacency list graph[i] = list of nodes i can go to.",
    examples: [
      { input: "graph = [[1,2],[3],[3],[]]", output: "[[0,1,3],[0,2,3]]" },
      { input: "graph = [[4,3,1],[3,2,4],[3],[4],[]]", output: "[[0,4],[0,3,4],[0,1,3,4],[0,1,2,3,4],[0,1,4]]" },
    ],
    constraints: ["n == graph.length", "2 <= n <= 15", "0 <= graph[i][j] < n", "graph[i][j] != i (no self-loops)", "All elements of graph[i] are unique.", "The input graph is guaranteed to be a DAG."],
    starterCode: {
      python: `class Solution:\n    def allPathsSourceTarget(self, graph):\n        pass`,
      javascript: `function allPathsSourceTarget(graph) {\n\n}`,
      typescript: `function allPathsSourceTarget(graph: number[][]): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> allPathsSourceTarget(int[][] graph) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> allPathsSourceTarget(vector<vector<int>>& graph) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { graph: [[1,2],[3],[3],[]] }, expectedOutput: [[0,1,3],[0,2,3]] },
      { input: { graph: [[4,3,1],[3,2,4],[3],[4],[]] }, expectedOutput: [[0,4],[0,3,4],[0,1,3,4],[0,1,2,3,4],[0,1,4]] },
    ],
    hiddentestcases: [
      { input: { graph: [[1],[]] }, expectedOutput: [[0,1]] },
      { input: { graph: [[1,2,3],[3],[3],[]] }, expectedOutput: [[0,1,3],[0,2,3],[0,3]] },
    ],
  },

  // ── BATCH 044: Backtracking II + Binary Search II (IDs 181-190) ───────────

  { id: 181, title: "Subsets II", slug: "subsets-ii", functionName: "subsetsWithDup", difficulty: "Medium", topic: "Backtracking", pattern: "DFS with dedup sort", companies: ["Amazon","Facebook"], description: "Given an integer array nums that may contain duplicates, return all possible subsets (the power set). The solution must not contain duplicate subsets.", examples: [{ input: "nums = [1,2,2]", output: "[[],[1],[1,2],[1,2,2],[2],[2,2]]" }, { input: "nums = [0]", output: "[[],[0]]" }], constraints: ["1 <= nums.length <= 10", "-10 <= nums[i] <= 10"], starterCode: { python: `class Solution:\n    def subsetsWithDup(self, nums):\n        pass`, javascript: `function subsetsWithDup(nums) {\n\n}`, typescript: `function subsetsWithDup(nums: number[]): number[][] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public List<List<Integer>> subsetsWithDup(int[] nums) { return new ArrayList<>(); }\n}`, cpp: `class Solution {\npublic:\n    vector<vector<int>> subsetsWithDup(vector<int>& nums) { return {}; }\n};` }, testcases: [{ input: { nums: [1,2,2] }, expectedOutput: [[],[1],[1,2],[1,2,2],[2],[2,2]] }, { input: { nums: [0] }, expectedOutput: [[],[0]] }], hiddentestcases: [{ input: { nums: [1,1] }, expectedOutput: [[],[1],[1,1]] }, { input: { nums: [4,4,4,1,4] }, expectedOutput: [[],[1],[1,4],[1,4,4],[1,4,4,4],[1,4,4,4,4],[4],[4,4],[4,4,4],[4,4,4,4]] }] },

  {
    id: 182,
    title: "Combination Sum II",
    slug: "combination-sum-ii",
    functionName: "combinationSum2",
    difficulty: "Medium",
    topic: "Backtracking",
    pattern: "DFS with deduplication",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given a collection of candidate integers (may contain duplicates) and a target, return all unique combinations that sum to target. Each number may only be used once in the combination.",
    examples: [
      { input: "candidates = [10,1,2,7,6,1,5], target = 8", output: "[[1,1,6],[1,2,5],[1,7],[2,6]]" },
      { input: "candidates = [2,5,2,1,2], target = 5", output: "[[1,2,2],[5]]" },
    ],
    constraints: ["1 <= candidates.length <= 100", "1 <= candidates[i] <= 50", "1 <= target <= 30"],
    starterCode: {
      python: `class Solution:\n    def combinationSum2(self, candidates, target):\n        pass`,
      javascript: `function combinationSum2(candidates, target) {\n\n}`,
      typescript: `function combinationSum2(candidates: number[], target: number): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> combinationSum2(int[] candidates, int target) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> combinationSum2(vector<int>& candidates, int target) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { candidates: [10,1,2,7,6,1,5], target: 8 }, expectedOutput: [[1,1,6],[1,2,5],[1,7],[2,6]] },
      { input: { candidates: [2,5,2,1,2], target: 5 }, expectedOutput: [[1,2,2],[5]] },
    ],
    hiddentestcases: [
      { input: { candidates: [1,1,1,1], target: 2 }, expectedOutput: [[1,1]] },
      { input: { candidates: [3,1,3,5,1,1], target: 8 }, expectedOutput: [[1,1,1,5],[1,1,3,3],[3,5]] },
    ],
  },

  { id: 183, title: "N-Queens II", slug: "n-queens-ii", functionName: "totalNQueens", difficulty: "Hard", topic: "Backtracking", pattern: "constraint backtracking count-only", companies: ["Amazon","Microsoft"], description: "The n-queens puzzle is the problem of placing n queens on an n x n chessboard such that no two queens attack each other (no two queens share the same row, column, or diagonal). Given an integer n, return the number of distinct solutions to the n-queens puzzle.", examples: [{ input: "n = 4", output: "2", explanation: "There are exactly 2 distinct ways to place 4 non-attacking queens on a 4x4 board." }, { input: "n = 1", output: "1", explanation: "A single queen on a 1x1 board trivially doesn't attack anything." }, { input: "n = 2", output: "0", explanation: "No arrangement of 2 non-attacking queens exists on a 2x2 board." }], constraints: ["1 <= n <= 9"], starterCode: { python: `class Solution:\n    def totalNQueens(self, n):\n        pass`, javascript: `function totalNQueens(n) {\n\n}`, typescript: `function totalNQueens(n: number): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int totalNQueens(int n) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int totalNQueens(int n) { return 0; }\n};`, c: `int totalNQueens(int n) {\n    return 0;\n}` }, testcases: [{ input: { n: 4 }, expectedOutput: 2 }, { input: { n: 1 }, expectedOutput: 1 }, { input: { n: 2 }, expectedOutput: 0 }], hiddentestcases: [{ input: { n: 3 }, expectedOutput: 0 }, { input: { n: 5 }, expectedOutput: 10 }] },

  { id: 184, title: "Letter Combinations of a Phone Number", slug: "letter-combinations-phone-number", functionName: "letterCombinations", difficulty: "Medium", topic: "Backtracking", pattern: "DFS digit mapping", companies: ["Amazon","Facebook","Google","Microsoft"], description: "Given a string containing digits 2-9, return all possible letter combinations that the number could represent (phone keypad mapping). Return an empty list for empty input.", examples: [{ input: 'digits = "23"', output: '["ad","ae","af","bd","be","bf","cd","ce","cf"]' }, { input: 'digits = ""', output: "[]" }, { input: 'digits = "2"', output: '["a","b","c"]' }], constraints: ["0 <= digits.length <= 4", "digits[i] is a digit in ['2','9']."], starterCode: { python: `class Solution:\n    def letterCombinations(self, digits):\n        pass`, javascript: `function letterCombinations(digits) {\n\n}`, typescript: `function letterCombinations(digits: string): string[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public List<String> letterCombinations(String digits) { return new ArrayList<>(); }\n}`, cpp: `class Solution {\npublic:\n    vector<string> letterCombinations(string digits) { return {}; }\n};` }, testcases: [{ input: { digits: "23" }, expectedOutput: ["ad","ae","af","bd","be","bf","cd","ce","cf"] }, { input: { digits: "" }, expectedOutput: [] }, { input: { digits: "2" }, expectedOutput: ["a","b","c"] }], hiddentestcases: [{ input: { digits: "9" }, expectedOutput: ["w","x","y","z"] }, { input: { digits: "29" }, expectedOutput: ["aw","ax","ay","az","bw","bx","by","bz","cw","cx","cy","cz"] }] },

  { id: 185, title: "Permutations II", slug: "permutations-ii", comparisonMode: "unordered", functionName: "permuteUnique", difficulty: "Medium", topic: "Backtracking", pattern: "DFS with used array + dedup", companies: ["Amazon","Microsoft"], description: "Given a collection of numbers that might contain duplicates, return all possible unique permutations in any order.", examples: [{ input: "nums = [1,1,2]", output: "[[1,1,2],[1,2,1],[2,1,1]]" }, { input: "nums = [1,2,3]", output: "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]" }], constraints: ["1 <= nums.length <= 8", "-10 <= nums[i] <= 10"], starterCode: { python: `class Solution:\n    def permuteUnique(self, nums):\n        pass`, javascript: `function permuteUnique(nums) {\n\n}`, typescript: `function permuteUnique(nums: number[]): number[][] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public List<List<Integer>> permuteUnique(int[] nums) { return new ArrayList<>(); }\n}`, cpp: `class Solution {\npublic:\n    vector<vector<int>> permuteUnique(vector<int>& nums) { return {}; }\n};` }, testcases: [{ input: { nums: [1,1,2] }, expectedOutput: [[1,1,2],[1,2,1],[2,1,1]] }, { input: { nums: [1,2,3] }, expectedOutput: [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]] }], hiddentestcases: [{ input: { nums: [0,1] }, expectedOutput: [[0,1],[1,0]] }, { input: { nums: [1,1,1] }, expectedOutput: [[1,1,1]] }] },

  { id: 186, title: "First Bad Version", slug: "first-bad-version", functionName: "firstBadVersion", difficulty: "Easy", topic: "Binary Search", pattern: "leftmost binary search", companies: ["Facebook","Amazon"], description: "You are a product manager with n versions. isBadVersion(version) returns whether a version is bad. All versions after the first bad one are also bad. Find the first bad version using minimum API calls.", examples: [{ input: "n = 5, bad = 4", output: "4" }, { input: "n = 1, bad = 1", output: "1" }], constraints: ["1 <= bad <= n <= 2^31 - 1"], starterCode: { python: `class Solution:\n    def firstBadVersion(self, n):\n        pass`, javascript: `function solution(isBadVersion) {\n    return function(n) {\n\n    };\n}`, typescript: `function solution(isBadVersion: any): any {\n    throw new Error("Not implemented");\n}`, java: `class Solution extends VersionControl {\n    public int firstBadVersion(int n) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int firstBadVersion(int n) { return 0; }\n};` }, testcases: [{ input: { n: 5, bad: 4 }, expectedOutput: 4 }, { input: { n: 1, bad: 1 }, expectedOutput: 1 }], hiddentestcases: [{ input: { n: 2126753390, bad: 1702766719 }, expectedOutput: 1702766719 }, { input: { n: 100, bad: 1 }, expectedOutput: 1 }] },

  { id: 187, title: "Peak Index in a Mountain Array", slug: "peak-index-mountain-array", functionName: "peakIndexInMountainArray", difficulty: "Medium", topic: "Binary Search", pattern: "binary search on slope", companies: ["Amazon","Google"], description: "An array arr is a mountain if arr[0] < arr[1] < ... < arr[i] > arr[i+1] > ... > arr[n-1]. Return the index i where arr[i] is the peak. Solve in O(log n).", examples: [{ input: "arr = [0,1,0]", output: "1" }, { input: "arr = [0,2,1,0]", output: "1" }, { input: "arr = [0,10,5,2]", output: "1" }], constraints: ["3 <= arr.length <= 10^5", "0 <= arr[i] <= 10^6", "arr is a mountain array."], starterCode: { python: `class Solution:\n    def peakIndexInMountainArray(self, arr):\n        pass`, javascript: `function peakIndexInMountainArray(arr) {\n\n}`, typescript: `function peakIndexInMountainArray(arr: number[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int peakIndexInMountainArray(int[] arr) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int peakIndexInMountainArray(vector<int>& arr) { return 0; }\n};`, c: `int peakIndexInMountainArray(int* arr, int arrSize) {\n    return 0;\n}` }, testcases: [{ input: { arr: [0,1,0] }, expectedOutput: 1 }, { input: { arr: [0,2,1,0] }, expectedOutput: 1 }, { input: { arr: [0,10,5,2] }, expectedOutput: 1 }], hiddentestcases: [{ input: { arr: [3,5,3,2,0] }, expectedOutput: 1 }, { input: { arr: [0,1,2,3,4,5,4,3,2,1] }, expectedOutput: 5 }] },

  {
    id: 188,
    title: "Search in Rotated Sorted Array II",
    slug: "search-in-rotated-sorted-array-ii",
    functionName: "search",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search with duplicates",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given an integer array nums sorted in ascending order (with possible duplicates) and rotated at some pivot, and an integer target, return true if target is in nums. O(log n) is desired but may not be achievable with duplicates.",
    examples: [
      { input: "nums = [2,5,6,0,0,1,2], target = 0", output: "true" },
      { input: "nums = [2,5,6,0,0,1,2], target = 3", output: "false" },
    ],
    constraints: ["1 <= nums.length <= 5000", "-10^4 <= nums[i] <= 10^4", "nums is sorted and rotated.", "-10^4 <= target <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def search(self, nums, target):\n        pass`,
      javascript: `function search(nums, target) {\n\n}`,
      typescript: `function search(nums: number[], target: number): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean search(int[] nums, int target) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool search(vector<int>& nums, int target) {\n        return false;\n    }\n};`,
      c: `bool search(int* nums, int numsSize, int target) {\n    return false;\n}`,
    },
    testcases: [
      { input: { nums: [2,5,6,0,0,1,2], target: 0 }, expectedOutput: true },
      { input: { nums: [2,5,6,0,0,1,2], target: 3 }, expectedOutput: false },
      { input: { nums: [1], target: 1 }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { nums: [1,0,1,1,1], target: 0 }, expectedOutput: true },
      { input: { nums: [3,1,1], target: 3 }, expectedOutput: true },
    ],
  },

  {
    id: 189,
    title: "Find K Closest Elements",
    slug: "find-k-closest-elements",
    functionName: "findClosestElements",
    difficulty: "Medium",
    topic: "Binary Search",
    pattern: "binary search on left bound",
    sourceType: "core",
    companies: ["Google", "Facebook", "Amazon"],
    description: "Given a sorted integer array arr, two integers k and x, return the k closest integers to x in the array. The result should be sorted in ascending order. If two integers are equally close to x, the smaller one is preferred.",
    examples: [
      { input: "arr = [1,2,3,4,5], k = 4, x = 3", output: "[1,2,3,4]" },
      { input: "arr = [1,2,3,4,5], k = 4, x = -1", output: "[1,2,3,4]" },
    ],
    constraints: ["1 <= k <= arr.length", "1 <= arr.length <= 10^4", "arr is sorted in ascending order.", "-10^4 <= arr[i], x <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def findClosestElements(self, arr, k, x):\n        pass`,
      javascript: `function findClosestElements(arr, k, x) {\n\n}`,
      typescript: `function findClosestElements(arr: number[], k: number, x: number): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<Integer> findClosestElements(int[] arr, int k, int x) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> findClosestElements(vector<int>& arr, int k, int x) {\n        return {};\n    }\n};`,
      c: `int* findClosestElements(int* arr, int arrSize, int k, int x, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { arr: [1,2,3,4,5], k: 4, x: 3 }, expectedOutput: [1,2,3,4] },
      { input: { arr: [1,2,3,4,5], k: 4, x: -1 }, expectedOutput: [1,2,3,4] },
      { input: { arr: [1,3], k: 1, x: 2 }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { arr: [1,2,3,4,5], k: 4, x: 100 }, expectedOutput: [2,3,4,5] },
      { input: { arr: [0,0,1,2,3,3,4,7,7,8], k: 3, x: 5 }, expectedOutput: [3,3,4] },
    ],
  },

  { id: 190, title: "Count of Smaller Numbers After Self", slug: "count-smaller-numbers-after-self", functionName: "countSmaller", difficulty: "Hard", topic: "Binary Search", pattern: "BIT / merge sort", companies: ["Google","Amazon","Facebook"], description: "Given an integer array nums, return an integer array counts where counts[i] is the number of elements to the right of nums[i] that are smaller than nums[i].", examples: [{ input: "nums = [5,2,6,1]", output: "[2,1,1,0]" }, { input: "nums = [-1]", output: "[0]" }, { input: "nums = [-1,-1]", output: "[0,0]" }], constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"], starterCode: { python: `class Solution:\n    def countSmaller(self, nums):\n        pass`, javascript: `function countSmaller(nums) {\n\n}`, typescript: `function countSmaller(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public List<Integer> countSmaller(int[] nums) { return new ArrayList<>(); }\n}`, cpp: `class Solution {\npublic:\n    vector<int> countSmaller(vector<int>& nums) { return {}; }\n};`, c: `int* countSmaller(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}` }, testcases: [{ input: { nums: [5,2,6,1] }, expectedOutput: [2,1,1,0] }, { input: { nums: [-1] }, expectedOutput: [0] }, { input: { nums: [-1,-1] }, expectedOutput: [0,0] }], hiddentestcases: [{ input: { nums: [1,9,7,8,5] }, expectedOutput: [0,3,1,1,0] }] },

  // ── BATCH 045: Hash Maps + Heap II (IDs 191-200) ──────────────────────────

  { id: 191, title: "Two Sum III — Data Structure Design", slug: "two-sum-iii-data-structure", functionName: "TwoSum", operationSequence: { enabled: true, resultMode: "all" }, difficulty: "Easy", topic: "Hash Maps", pattern: "frequency map", companies: ["LinkedIn"], description: "Design a TwoSum class that supports add(number) and find(value). find(value) returns true if there exist any two numbers whose sum equals value.", examples: [{ input: '["TwoSum","add","add","add","find","find"]\n[[],[1],[3],[5],[4],[7]]', output: "[null,null,null,null,true,false]" }], constraints: ["At most 10^4 calls to add and find.", "-2^31 <= number <= 2^31 - 1", "-2^63 <= value <= 2^63 - 1"], starterCode: { python: `class TwoSum:\n    def __init__(self):\n        pass\n    def add(self, number):\n        pass\n    def find(self, value):\n        pass`, javascript: `class TwoSum {\n  constructor() {}\n  add(number) {}\n  find(value) { return false; }\n}`, typescript: `class TwoSum {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  add(number: number): void {\n    throw new Error("Not implemented");\n  }\n  find(value: number): boolean {\n    throw new Error("Not implemented");\n  }\n}`, java: `class TwoSum {\n    public TwoSum() {}\n    public void add(int number) {}\n    public boolean find(int value) { return false; }\n}`, cpp: `class TwoSum {\npublic:\n    TwoSum() {}\n    void add(int number) {}\n    bool find(int value) { return false; }\n};` }, testcases: [{ input: { ops: ["add","add","add","find","find"], vals: [[1],[3],[5],[4],[7]] }, expectedOutput: [null,null,null,true,false] }], hiddentestcases: [{ input: { ops: ["add","find"], vals: [[0],[0]] }, expectedOutput: [null,false] }, { input: { ops: ["add","add","find"], vals: [[3],[3],[6]] }, expectedOutput: [null,null,true] }] },

  { id: 192, title: "Top K Frequent Words", slug: "top-k-frequent-words", functionName: "topKFrequent", difficulty: "Medium", topic: "Hash Maps", pattern: "frequency map + heap", companies: ["Amazon","Facebook","Bloomberg"], description: "Given an array of strings words and an integer k, return the k most frequent strings. Return the answer sorted by frequency (highest first). For ties, sort lexicographically.", examples: [{ input: 'words = ["i","love","leetcode","i","love","coding"], k = 2', output: '["i","love"]' }, { input: 'words = ["the","day","is","sunny","the","the","the","sunny","is","is"], k = 4', output: '["the","is","sunny","day"]' }], constraints: ["1 <= words.length <= 500", "1 <= words[i].length <= 10", "k is in [1, unique word count]"], starterCode: { python: `class Solution:\n    def topKFrequent(self, words, k):\n        pass`, javascript: `function topKFrequent(words, k) {\n\n}`, typescript: `function topKFrequent(words: string[], k: number): string[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public List<String> topKFrequent(String[] words, int k) { return new ArrayList<>(); }\n}`, cpp: `class Solution {\npublic:\n    vector<string> topKFrequent(vector<string>& words, int k) { return {}; }\n};` }, testcases: [{ input: { words: ["i","love","leetcode","i","love","coding"], k: 2 }, expectedOutput: ["i","love"] }, { input: { words: ["the","day","is","sunny","the","the","the","sunny","is","is"], k: 4 }, expectedOutput: ["the","is","sunny","day"] }], hiddentestcases: [{ input: { words: ["a","aa","aaa"], k: 1 }, expectedOutput: ["a"] }, { input: { words: ["a","b","a"], k: 2 }, expectedOutput: ["a","b"] }] },

  { id: 193, title: "Longest Substring with At Most Two Distinct Characters", slug: "longest-substring-two-distinct", functionName: "lengthOfLongestSubstringTwoDistinct", difficulty: "Medium", topic: "Sliding Window", pattern: "variable window frequency map", companies: ["Amazon","Facebook"], description: "Given a string s, return the length of the longest substring that contains at most two distinct characters.", examples: [{ input: 's = "eceba"', output: "3", explanation: '"ece"' }, { input: 's = "ccaabbb"', output: "5", explanation: '"aabbb"' }], constraints: ["1 <= s.length <= 10^5", "s consists of English letters."], starterCode: { python: `class Solution:\n    def lengthOfLongestSubstringTwoDistinct(self, s):\n        pass`, javascript: `function lengthOfLongestSubstringTwoDistinct(s) {\n\n}`, typescript: `function lengthOfLongestSubstringTwoDistinct(s: string): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int lengthOfLongestSubstringTwoDistinct(String s) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int lengthOfLongestSubstringTwoDistinct(string s) { return 0; }\n};`, c: `int lengthOfLongestSubstringTwoDistinct(char* s) {\n    return 0;\n}` }, testcases: [{ input: { s: "eceba" }, expectedOutput: 3 }, { input: { s: "ccaabbb" }, expectedOutput: 5 }], hiddentestcases: [{ input: { s: "a" }, expectedOutput: 1 }, { input: { s: "abcabcabc" }, expectedOutput: 2 }] },

  {
    id: 194,
    title: "Contiguous Array",
    slug: "contiguous-array",
    functionName: "findMaxLength",
    difficulty: "Medium",
    topic: "Hash Maps",
    pattern: "prefix sum balance hash map",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given a binary array nums, return the maximum length of a contiguous subarray with an equal number of 0 and 1.",
    examples: [
      { input: "nums = [0,1]", output: "2" },
      { input: "nums = [0,1,0]", output: "2" },
    ],
    constraints: ["1 <= nums.length <= 10^5", "nums[i] is either 0 or 1."],
    starterCode: {
      python: `class Solution:\n    def findMaxLength(self, nums):\n        pass`,
      javascript: `function findMaxLength(nums) {\n\n}`,
      typescript: `function findMaxLength(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findMaxLength(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findMaxLength(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int findMaxLength(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [0,1] }, expectedOutput: 2 },
      { input: { nums: [0,1,0] }, expectedOutput: 2 },
      { input: { nums: [0,0,1,0,0,0,1,1] }, expectedOutput: 6 },
    ],
    hiddentestcases: [
      { input: { nums: [0,0] }, expectedOutput: 0 },
      { input: { nums: [0,1,0,1] }, expectedOutput: 4 },
    ],
  },

  {
    id: 195,
    title: "4Sum II",
    slug: "4sum-ii",
    functionName: "fourSumCount",
    difficulty: "Medium",
    topic: "Hash Maps",
    pattern: "two-sum complement counting",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given four integer arrays nums1, nums2, nums3, nums4 of length n, return the number of tuples (i, j, k, l) such that nums1[i] + nums2[j] + nums3[k] + nums4[l] == 0.",
    examples: [
      { input: "nums1 = [1,2], nums2 = [-2,-1], nums3 = [-1,2], nums4 = [0,2]", output: "2" },
      { input: "nums1 = [0], nums2 = [0], nums3 = [0], nums4 = [0]", output: "1" },
    ],
    constraints: ["n == nums1.length == nums2.length == nums3.length == nums4.length", "1 <= n <= 200", "-2^28 <= nums1[i], nums2[j], nums3[k], nums4[l] <= 2^28"],
    starterCode: {
      python: `class Solution:\n    def fourSumCount(self, nums1, nums2, nums3, nums4):\n        pass`,
      javascript: `function fourSumCount(nums1, nums2, nums3, nums4) {\n\n}`,
      typescript: `function fourSumCount(nums1: number[], nums2: number[], nums3: number[], nums4: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int fourSumCount(int[] nums1, int[] nums2, int[] nums3, int[] nums4) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int fourSumCount(vector<int>& nums1, vector<int>& nums2, vector<int>& nums3, vector<int>& nums4) {\n        return 0;\n    }\n};`,
      c: `int fourSumCount(int* nums1, int nums1Size, int* nums2, int nums2Size, int* nums3, int nums3Size, int* nums4, int nums4Size) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums1: [1,2], nums2: [-2,-1], nums3: [-1,2], nums4: [0,2] }, expectedOutput: 2 },
      { input: { nums1: [0], nums2: [0], nums3: [0], nums4: [0] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { nums1: [-1,1], nums2: [-1,1], nums3: [-1,1], nums4: [-1,1] }, expectedOutput: 6 },
    ],
  },

  {
    id: 196,
    title: "Find K Pairs with Smallest Sums",
    slug: "find-k-pairs-with-smallest-sums",
    functionName: "kSmallestPairs",
    // List of pairs may be returned in any order (each pair's own order
    // still matters) — audit P0-3.
    comparisonMode: "unordered",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "min heap with index pairs",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given two sorted integer arrays nums1 and nums2 in non-decreasing order and an integer k, return the k pairs (u, v) with the smallest sums (one element from each array). Return results in any order.",
    examples: [
      { input: "nums1 = [1,7,11], nums2 = [2,4,6], k = 3", output: "[[1,2],[1,4],[1,6]]" },
      { input: "nums1 = [1,1,2], nums2 = [1,2,3], k = 2", output: "[[1,1],[1,1]]" },
    ],
    constraints: ["1 <= nums1.length, nums2.length <= 10^5", "-10^9 <= nums1[i], nums2[j] <= 10^9", "nums1 and nums2 are sorted.", "1 <= k <= 10^4", "k <= nums1.length * nums2.length"],
    starterCode: {
      python: `class Solution:\n    def kSmallestPairs(self, nums1, nums2, k):\n        pass`,
      javascript: `function kSmallestPairs(nums1, nums2, k) {\n\n}`,
      typescript: `function kSmallestPairs(nums1: number[], nums2: number[], k: number): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<List<Integer>> kSmallestPairs(int[] nums1, int[] nums2, int k) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> kSmallestPairs(vector<int>& nums1, vector<int>& nums2, int k) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { nums1: [1,7,11], nums2: [2,4,6], k: 3 }, expectedOutput: [[1,2],[1,4],[1,6]] },
      { input: { nums1: [1,1,2], nums2: [1,2,3], k: 2 }, expectedOutput: [[1,1],[1,1]] },
    ],
    hiddentestcases: [
      { input: { nums1: [1,2], nums2: [3], k: 3 }, expectedOutput: [[1,3],[2,3]] },
    ],
  },

  {
    id: 197,
    title: "Ugly Number II",
    slug: "ugly-number-ii",
    functionName: "nthUglyNumber",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "min heap or DP three pointers",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "An ugly number is a positive integer whose prime factors are limited to 2, 3, and 5. Given an integer n, return the nth ugly number.",
    examples: [
      { input: "n = 10", output: "12", explanation: "[1,2,3,4,5,6,8,9,10,12] are the first 10 ugly numbers." },
      { input: "n = 1", output: "1" },
    ],
    constraints: ["1 <= n <= 1690"],
    starterCode: {
      python: `class Solution:\n    def nthUglyNumber(self, n):\n        pass`,
      javascript: `function nthUglyNumber(n) {\n\n}`,
      typescript: `function nthUglyNumber(n: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int nthUglyNumber(int n) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int nthUglyNumber(int n) {\n        return 0;\n    }\n};`,
      c: `int nthUglyNumber(int n) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { n: 10 }, expectedOutput: 12 },
      { input: { n: 1 }, expectedOutput: 1 },
      { input: { n: 7 }, expectedOutput: 8 },
    ],
    hiddentestcases: [
      { input: { n: 15 }, expectedOutput: 24 },
      { input: { n: 1690 }, expectedOutput: 2123366400 },
    ],
  },

  {
    id: 198,
    title: "IPO",
    slug: "ipo",
    functionName: "findMaximizedCapital",
    difficulty: "Hard",
    topic: "Heap",
    pattern: "greedy with two heaps",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "You have w initial capital and can complete at most k projects. Each project i has profit[i] and requires capital[i] to start. After completing a project, its profit adds to your capital. Return maximized capital after completing at most k projects.",
    examples: [
      { input: "k = 2, w = 0, profits = [1,2,3], capital = [0,1,1]", output: "4" },
      { input: "k = 3, w = 0, profits = [1,2,3], capital = [0,1,2]", output: "6" },
    ],
    constraints: ["1 <= k <= 10^5", "0 <= w <= 10^9", "n == profits.length == capital.length", "1 <= n <= 10^5", "0 <= profits[i] <= 10^4", "0 <= capital[i] <= 10^9"],
    starterCode: {
      python: `class Solution:\n    def findMaximizedCapital(self, k, w, profits, capital):\n        pass`,
      javascript: `function findMaximizedCapital(k, w, profits, capital) {\n\n}`,
      typescript: `function findMaximizedCapital(k: number, w: number, profits: number[], capital: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findMaximizedCapital(int k, int w, int[] profits, int[] capital) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findMaximizedCapital(int k, int w, vector<int>& profits, vector<int>& capital) {\n        return 0;\n    }\n};`,
      c: `int findMaximizedCapital(int k, int w, int* profits, int profitsSize, int* capital, int capitalSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { k: 2, w: 0, profits: [1,2,3], capital: [0,1,1] }, expectedOutput: 4 },
      { input: { k: 3, w: 0, profits: [1,2,3], capital: [0,1,2] }, expectedOutput: 6 },
    ],
    hiddentestcases: [
      { input: { k: 1, w: 0, profits: [1,2,3], capital: [1,1,2] }, expectedOutput: 0 },
      { input: { k: 11, w: 11, profits: [1,2,3], capital: [11,12,13] }, expectedOutput: 17 },
    ],
  },

  {
    id: 199,
    title: "Single Thread CPU",
    slug: "single-thread-cpu",
    functionName: "getOrder",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "event simulation with min heap",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "You have n tasks with enqueueTime[i] and processingTime[i]. The CPU picks the task with shortest processing time available at the current time (breaking ties by index). Return the order in which tasks are processed.",
    examples: [
      { input: "tasks = [[1,2],[2,4],[3,2],[4,1]]", output: "[0,2,3,1]" },
      { input: "tasks = [[7,10],[7,12],[7,5],[7,4],[7,2]]", output: "[4,3,2,0,1]" },
    ],
    constraints: ["tasks.length == n", "1 <= n <= 10^5", "1 <= enqueueTime[i], processingTime[i] <= 10^9"],
    starterCode: {
      python: `class Solution:\n    def getOrder(self, tasks):\n        pass`,
      javascript: `function getOrder(tasks) {\n\n}`,
      typescript: `function getOrder(tasks: number[][]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] getOrder(int[][] tasks) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> getOrder(vector<vector<int>>& tasks) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { tasks: [[1,2],[2,4],[3,2],[4,1]] }, expectedOutput: [0,2,3,1] },
      { input: { tasks: [[7,10],[7,12],[7,5],[7,4],[7,2]] }, expectedOutput: [4,3,2,0,1] },
    ],
    hiddentestcases: [
      { input: { tasks: [[1,1],[2,2],[4,4]] }, expectedOutput: [0,1,2] },
    ],
  },

  {
    id: 200,
    title: "Reorganize String",
    slug: "reorganize-string",
    functionName: "reorganizeString",
    difficulty: "Medium",
    topic: "Heap",
    pattern: "max heap greedy",
    sourceType: "core",
    companies: ["Amazon", "Google", "Facebook"],
    description: "Given a string s, rearrange the characters of s so that no two adjacent characters are the same. Return any such rearrangement, or an empty string if not possible.",
    examples: [
      { input: 's = "aab"', output: '"aba"' },
      { input: 's = "aaab"', output: '""' },
    ],
    constraints: ["1 <= s.length <= 500", "s consists of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def reorganizeString(self, s):\n        pass`,
      javascript: `function reorganizeString(s) {\n\n}`,
      typescript: `function reorganizeString(s: string): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String reorganizeString(String s) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string reorganizeString(string s) {\n        return "";\n    }\n};`,
      c: `char* reorganizeString(char* s) {\n    return "";\n}`,
    },
    testcases: [
      { input: { s: "aab" }, expectedOutput: "aba" },
      { input: { s: "aaab" }, expectedOutput: "" },
      { input: { s: "a" }, expectedOutput: "a" },
    ],
    hiddentestcases: [
      { input: { s: "aaabb" }, expectedOutput: "ababa" },
      { input: { s: "aaaabbb" }, expectedOutput: "abababa" },
    ],
  },

  // ── BATCH 046: Trie II + More Strings (IDs 201-210) ───────────────────────

  { id: 201, title: "Palindromic Substrings", slug: "palindromic-substrings", functionName: "countSubstrings", difficulty: "Medium", topic: "Dynamic Programming", pattern: "expand around center", companies: ["Facebook","Amazon"], description: "Given a string s, return the number of palindromic substrings in it. A string is a palindrome when it reads the same backward as forward.", examples: [{ input: 's = "abc"', output: "3", explanation: "a, b, c" }, { input: 's = "aaa"', output: "6", explanation: "a, a, a, aa, aa, aaa" }], constraints: ["1 <= s.length <= 1000", "s consists of lowercase English letters."], starterCode: { python: `class Solution:\n    def countSubstrings(self, s):\n        pass`, javascript: `function countSubstrings(s) {\n\n}`, typescript: `function countSubstrings(s: string): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int countSubstrings(String s) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int countSubstrings(string s) { return 0; }\n};`, c: `int countSubstrings(char* s) {\n    return 0;\n}` }, testcases: [{ input: { s: "abc" }, expectedOutput: 3 }, { input: { s: "aaa" }, expectedOutput: 6 }, { input: { s: "a" }, expectedOutput: 1 }], hiddentestcases: [{ input: { s: "aba" }, expectedOutput: 4 }, { input: { s: "abba" }, expectedOutput: 6 }] },

  {
    id: 202,
    title: "Implement Trie II (Prefix Tree)",
    slug: "implement-trie-ii",
    functionName: "Trie",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Medium",
    topic: "Trie",
    pattern: "trie with per-word counts",
    sourceType: "core",
    companies: ["Amazon", "Google", "Microsoft", "Facebook"],
    description: "Implement a Trie class that supports: insert(word) — inserts word into the trie; countWordsEqualTo(word) — returns the number of instances of word that have been inserted; countWordsStartingWith(prefix) — returns the number of previously inserted strings that have prefix as a prefix; and erase(word) — removes one instance of word from the trie (word is guaranteed to be present when erase is called).",
    examples: [
      { input: '["Trie","insert","insert","countWordsEqualTo","countWordsStartingWith","erase","countWordsEqualTo","countWordsStartingWith","erase","countWordsStartingWith"]\n[[],["apple"],["apple"],["apple"],["app"],["apple"],["apple"],["app"],["apple"],["app"]]', output: "[null,null,null,2,2,null,1,1,null,0]" },
    ],
    constraints: ["1 <= word.length, prefix.length <= 2000", "word and prefix consist only of lowercase English letters.", "At most 3 * 10^4 calls total to insert, countWordsEqualTo, countWordsStartingWith, and erase.", "erase(word) is only called on a word that is present in the trie."],
    starterCode: {
      python: `class Trie:\n    def __init__(self):\n        pass\n\n    def insert(self, word):\n        pass\n\n    def countWordsEqualTo(self, word):\n        pass\n\n    def countWordsStartingWith(self, prefix):\n        pass\n\n    def erase(self, word):\n        pass`,
      javascript: `class Trie {\n  constructor() {}\n  insert(word) {}\n  countWordsEqualTo(word) { return 0; }\n  countWordsStartingWith(prefix) { return 0; }\n  erase(word) {}\n}`,
      typescript: `class Trie {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  insert(word: string): void {\n    throw new Error("Not implemented");\n  }\n  countWordsEqualTo(word: string): number {\n    throw new Error("Not implemented");\n  }\n  countWordsStartingWith(prefix: string): number {\n    throw new Error("Not implemented");\n  }\n  erase(word: string): void {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class Trie {\n    public Trie() {}\n    public void insert(String word) {}\n    public int countWordsEqualTo(String word) { return 0; }\n    public int countWordsStartingWith(String prefix) { return 0; }\n    public void erase(String word) {}\n}`,
      cpp: `class Trie {\npublic:\n    Trie() {}\n    void insert(string word) {}\n    int countWordsEqualTo(string word) { return 0; }\n    int countWordsStartingWith(string prefix) { return 0; }\n    void erase(string word) {}\n};`,
    },
    testcases: [
      { input: { ops: ["insert","insert","countWordsEqualTo","countWordsStartingWith","erase","countWordsEqualTo","countWordsStartingWith","erase","countWordsStartingWith"], vals: [["apple"],["apple"],["apple"],["app"],["apple"],["apple"],["app"],["apple"],["app"]] }, expectedOutput: [null,null,2,2,null,1,1,null,0] },
    ],
    hiddentestcases: [
      { input: { ops: ["insert","countWordsEqualTo","countWordsStartingWith"], vals: [["bag"],["bag"],["ba"]] }, expectedOutput: [null,1,1] },
    ],
  },

  {
    id: 203,
    title: "Map Sum Pairs",
    slug: "map-sum-pairs",
    functionName: "MapSum",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Medium",
    topic: "Trie",
    pattern: "trie with subtree value sums",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Design a MapSum class with: insert(key, val) — inserts the key-val pair (if key already existed, the previous key-value pair is overridden); and sum(prefix) — returns the sum of all the values whose keys start with prefix.",
    examples: [
      { input: '["MapSum","insert","sum","insert","sum"]\n[[],["apple",3],["ap"],["app",2],["ap"]]', output: "[null,null,3,null,5]" },
    ],
    constraints: ["1 <= key.length, prefix.length <= 50", "key and prefix consist of only lowercase English letters.", "1 <= val <= 1000", "At most 50 calls will be made to insert and sum."],
    starterCode: {
      python: `class MapSum:\n    def __init__(self):\n        pass\n\n    def insert(self, key, val):\n        pass\n\n    def sum(self, prefix):\n        pass`,
      javascript: `class MapSum {\n  constructor() {}\n  insert(key, val) {}\n  sum(prefix) { return 0; }\n}`,
      typescript: `class MapSum {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  insert(key: string, val: number): void {\n    throw new Error("Not implemented");\n  }\n  sum(prefix: string): number {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MapSum {\n    public MapSum() {}\n    public void insert(String key, int val) {}\n    public int sum(String prefix) { return 0; }\n}`,
      cpp: `class MapSum {\npublic:\n    MapSum() {}\n    void insert(string key, int val) {}\n    int sum(string prefix) { return 0; }\n};`,
    },
    testcases: [
      { input: { ops: ["insert","sum","insert","sum"], vals: [["apple",3],["ap"],["app",2],["ap"]] }, expectedOutput: [null,3,null,5] },
    ],
    hiddentestcases: [
      { input: { ops: ["insert","sum","insert","sum"], vals: [["apple",3],["apple"],["apple",5],["apple"]] }, expectedOutput: [null,3,null,5] },
    ],
  },

  {
    id: 204,
    title: "Longest Word in Dictionary",
    slug: "longest-word-in-dictionary",
    functionName: "longestWord",
    difficulty: "Medium",
    topic: "Trie",
    pattern: "trie BFS/DFS level traversal",
    sourceType: "core",
    companies: ["Google"],
    description: "Given an array of strings words, return the longest word in words that can be built one character at a time by other words in words. If there is more than one answer, return the lexicographically smallest one.",
    examples: [
      { input: 'words = ["w","wo","wor","worl","world"]', output: '"world"' },
      { input: 'words = ["a","banana","app","appl","ap","apply","apple"]', output: '"apple"' },
    ],
    constraints: ["1 <= words.length <= 1000", "1 <= words[i].length <= 30", "words[i] consists of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def longestWord(self, words):\n        pass`,
      javascript: `function longestWord(words) {\n\n}`,
      typescript: `function longestWord(words: string[]): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String longestWord(String[] words) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string longestWord(vector<string>& words) {\n        return "";\n    }\n};`,
      c: `char* longestWord(char** words, int wordsSize) {\n    return "";\n}`,
    },
    testcases: [
      { input: { words: ["w","wo","wor","worl","world"] }, expectedOutput: "world" },
      { input: { words: ["a","banana","app","appl","ap","apply","apple"] }, expectedOutput: "apple" },
    ],
    hiddentestcases: [
      { input: { words: ["yo","ew","fc","zrc","yodn","fcm","qm","qmo","fcmz","z","ewq","yod","ewqz","y"] }, expectedOutput: "yodn" },
    ],
  },

  { id: 205, title: "Maximum Width Ramp", slug: "maximum-width-ramp", functionName: "maxWidthRamp", difficulty: "Medium", topic: "Stacks", pattern: "monotonic stack two pass", companies: ["Google","Amazon"], description: "A ramp in an integer array nums is a pair (i, j) for which i < j and nums[i] <= nums[j]. The width of such a ramp is j - i. Return the maximum width of a ramp in nums, or 0 if none exists.", examples: [{ input: "nums = [6,0,8,2,1,5]", output: "4", explanation: "ramp (1,5): 0 <= 5" }, { input: "nums = [9,8,1,0,1,9,4,0,4,1]", output: "7" }], constraints: ["2 <= nums.length <= 5 * 10^4", "0 <= nums[i] <= 5 * 10^4"], starterCode: { python: `class Solution:\n    def maxWidthRamp(self, nums):\n        pass`, javascript: `function maxWidthRamp(nums) {\n\n}`, typescript: `function maxWidthRamp(nums: number[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int maxWidthRamp(int[] nums) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int maxWidthRamp(vector<int>& nums) { return 0; }\n};`, c: `int maxWidthRamp(int* nums, int numsSize) {\n    return 0;\n}` }, testcases: [{ input: { nums: [6,0,8,2,1,5] }, expectedOutput: 4 }, { input: { nums: [9,8,1,0,1,9,4,0,4,1] }, expectedOutput: 7 }], hiddentestcases: [{ input: { nums: [1,0] }, expectedOutput: 0 }, { input: { nums: [0,1] }, expectedOutput: 1 }] },

  {
    id: 206,
    title: "Isomorphic Strings",
    slug: "isomorphic-strings",
    functionName: "isIsomorphic",
    difficulty: "Easy",
    topic: "Hash Maps",
    pattern: "bidirectional character map",
    sourceType: "core",
    companies: ["LinkedIn", "Amazon"],
    description: "Given two strings s and t, determine if they are isomorphic. Two strings are isomorphic if characters in s can be replaced to get t, preserving order. No two characters may map to the same character, but a character may map to itself.",
    examples: [
      { input: 's = "egg", t = "add"', output: "true" },
      { input: 's = "foo", t = "bar"', output: "false" },
      { input: 's = "paper", t = "title"', output: "true" },
    ],
    constraints: ["1 <= s.length <= 5 * 10^4", "t.length == s.length", "s and t consist of any valid ASCII character."],
    starterCode: {
      python: `class Solution:\n    def isIsomorphic(self, s, t):\n        pass`,
      javascript: `function isIsomorphic(s, t) {\n\n}`,
      typescript: `function isIsomorphic(s: string, t: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isIsomorphic(String s, String t) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isIsomorphic(string s, string t) {\n        return false;\n    }\n};`,
      c: `bool isIsomorphic(char* s, char* t) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "egg", t: "add" }, expectedOutput: true },
      { input: { s: "foo", t: "bar" }, expectedOutput: false },
      { input: { s: "paper", t: "title" }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { s: "badc", t: "baba" }, expectedOutput: false },
      { input: { s: "ab", t: "aa" }, expectedOutput: false },
    ],
  },

  {
    id: 207,
    title: "Ransom Note",
    slug: "ransom-note",
    functionName: "canConstruct",
    difficulty: "Easy",
    topic: "Hash Maps",
    pattern: "frequency count",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given two strings ransomNote and magazine, return true if ransomNote can be constructed by using the letters from magazine. Each letter in magazine can only be used once.",
    examples: [
      { input: 'ransomNote = "a", magazine = "b"', output: "false" },
      { input: 'ransomNote = "aa", magazine = "ab"', output: "false" },
      { input: 'ransomNote = "aa", magazine = "aab"', output: "true" },
    ],
    constraints: ["1 <= ransomNote.length, magazine.length <= 10^5", "Both strings consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def canConstruct(self, ransomNote, magazine):\n        pass`,
      javascript: `function canConstruct(ransomNote, magazine) {\n\n}`,
      typescript: `function canConstruct(ransomNote: string, magazine: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean canConstruct(String ransomNote, String magazine) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool canConstruct(string ransomNote, string magazine) {\n        return false;\n    }\n};`,
      c: `bool canConstruct(char* ransomNote, char* magazine) {\n    return false;\n}`,
    },
    testcases: [
      { input: { ransomNote: "a", magazine: "b" }, expectedOutput: false },
      { input: { ransomNote: "aa", magazine: "ab" }, expectedOutput: false },
      { input: { ransomNote: "aa", magazine: "aab" }, expectedOutput: true },
    ],
    hiddentestcases: [
      { input: { ransomNote: "fihjjjjei", magazine: "hjibagacbhadfaefdjaeaebgi" }, expectedOutput: true },
    ],
  },

  {
    id: 208,
    title: "Find All Anagrams in a String",
    slug: "find-all-anagrams-in-string",
    functionName: "findAnagrams",
    // Description says "you may return the answer in any order" — audit P0-3.
    comparisonMode: "unordered",
    difficulty: "Medium",
    topic: "Sliding Window",
    pattern: "fixed window frequency map",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Given two strings s and p, return an array of all the start indices of p's anagrams in s. You may return the answer in any order.",
    examples: [
      { input: 's = "cbaebabacd", p = "abc"', output: "[0,6]" },
      { input: 's = "abab", p = "ab"', output: "[0,1,2]" },
    ],
    constraints: ["1 <= s.length, p.length <= 3 * 10^4", "s and p consist of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def findAnagrams(self, s, p):\n        pass`,
      javascript: `function findAnagrams(s, p) {\n\n}`,
      typescript: `function findAnagrams(s: string, p: string): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<Integer> findAnagrams(String s, String p) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> findAnagrams(string s, string p) {\n        return {};\n    }\n};`,
      c: `int* findAnagrams(char* s, char* p, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { s: "cbaebabacd", p: "abc" }, expectedOutput: [0,6] },
      { input: { s: "abab", p: "ab" }, expectedOutput: [0,1,2] },
      { input: { s: "aa", p: "bb" }, expectedOutput: [] },
    ],
    hiddentestcases: [
      { input: { s: "baa", p: "aa" }, expectedOutput: [1] },
      { input: { s: "aaacb", p: "acb" }, expectedOutput: [2] },
    ],
  },

  { id: 209, title: "Max Consecutive Ones III", slug: "max-consecutive-ones-iii", functionName: "longestOnes", difficulty: "Medium", topic: "Sliding Window", pattern: "variable window with flip budget", companies: ["Amazon","Google"], description: "Given a binary array nums and an integer k, return the maximum number of consecutive 1's in the array if you can flip at most k 0's to 1's.", examples: [{ input: "nums = [1,1,1,0,0,0,1,1,1,1,0], k = 2", output: "6", explanation: "Flip the two 0's at indices 3 and 4 to get [1,1,1,1,1,1,1,1,1,1,0], which has 6 consecutive 1's starting at index 5." }, { input: "nums = [0,0,1,1,0,0,1,1,1,0,1,1,0,0,0,1,1,1,1], k = 3", output: "10", explanation: "Flip the three 0's at indices 4,5,9 to get a run of 10 consecutive 1's." }, { input: "nums = [0], k = 0", output: "0", explanation: "No flips allowed and there are no 1's, so the longest run of 1's is 0." }], constraints: ["1 <= nums.length <= 10^5", "nums[i] is either 0 or 1", "0 <= k <= nums.length"], starterCode: { python: `class Solution:\n    def longestOnes(self, nums, k):\n        pass`, javascript: `function longestOnes(nums, k) {\n\n}`, typescript: `function longestOnes(nums: number[], k: number): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int longestOnes(int[] nums, int k) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int longestOnes(vector<int>& nums, int k) { return 0; }\n};`, c: `int longestOnes(int* nums, int numsSize, int k) {\n    return 0;\n}` }, testcases: [{ input: { nums: [1,1,1,0,0,0,1,1,1,1,0], k: 2 }, expectedOutput: 6 }, { input: { nums: [0,0,1,1,0,0,1,1,1,0,1,1,0,0,0,1,1,1,1], k: 3 }, expectedOutput: 10 }, { input: { nums: [0], k: 0 }, expectedOutput: 0 }], hiddentestcases: [{ input: { nums: [1,1,1,1], k: 0 }, expectedOutput: 4 }, { input: { nums: [0,0,0,0], k: 2 }, expectedOutput: 2 }] },

  { id: 210, title: "Course Schedule II", slug: "course-schedule-ii", functionName: "findOrder", difficulty: "Medium", topic: "Graphs", pattern: "topological sort DFS/BFS", companies: ["Amazon","Facebook","Microsoft","Google"], description: "Given numCourses and prerequisites where prerequisites[i] = [ai, bi] means you must take bi before ai, return an ordering of courses you can take to finish all courses. Return empty array if impossible.", examples: [{ input: "numCourses = 2, prerequisites = [[1,0]]", output: "[0,1]" }, { input: "numCourses = 4, prerequisites = [[1,0],[2,1],[3,2]]", output: "[0,1,2,3]", explanation: "A strict chain: 0 before 1, 1 before 2, 2 before 3 — only one valid order exists." }, { input: "numCourses = 1, prerequisites = []", output: "[0]" }], constraints: ["1 <= numCourses <= 2000", "0 <= prerequisites.length <= numCourses * (numCourses-1)"], starterCode: { python: `class Solution:\n    def findOrder(self, numCourses, prerequisites):\n        pass`, javascript: `function findOrder(numCourses, prerequisites) {\n\n}`, typescript: `function findOrder(numCourses: number, prerequisites: number[][]): number[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int[] findOrder(int numCourses, int[][] prerequisites) { return new int[]{}; }\n}`, cpp: `class Solution {\npublic:\n    vector<int> findOrder(int numCourses, vector<vector<int>>& prerequisites) { return {}; }\n};` }, testcases: [{ input: { numCourses: 2, prerequisites: [[1,0]] }, expectedOutput: [0,1] }, { input: { numCourses: 4, prerequisites: [[1,0],[2,1],[3,2]] }, expectedOutput: [0,1,2,3] }, { input: { numCourses: 1, prerequisites: [] }, expectedOutput: [0] }], hiddentestcases: [{ input: { numCourses: 2, prerequisites: [[1,0],[0,1]] }, expectedOutput: [] }, { input: { numCourses: 3, prerequisites: [[0,1],[0,2],[1,2]] }, expectedOutput: [2,1,0] }] },

  // ── BATCH 047: Mixed Interview Favorites (IDs 211-220) ────────────────────

  { id: 211, title: "Longest Turbulent Subarray", slug: "longest-turbulent-subarray", functionName: "maxTurbulenceSize", difficulty: "Medium", topic: "Dynamic Programming", pattern: "state DP alternating", companies: ["Amazon"], description: "A subarray [arr[l], arr[l+1], ..., arr[r]] is turbulent if comparisons strictly alternate. Return the maximum length of a turbulent subarray.", examples: [{ input: "arr = [9,4,2,10,7,8,8,1,9]", output: "5", explanation: "[4,2,10,7,8]" }, { input: "arr = [4,8,12,16]", output: "2" }, { input: "arr = [100]", output: "1" }], constraints: ["1 <= arr.length <= 4 * 10^4", "0 <= arr[i] <= 10^9"], starterCode: { python: `class Solution:\n    def maxTurbulenceSize(self, arr):\n        pass`, javascript: `function maxTurbulenceSize(arr) {\n\n}`, typescript: `function maxTurbulenceSize(arr: number[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int maxTurbulenceSize(int[] arr) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int maxTurbulenceSize(vector<int>& arr) { return 0; }\n};`, c: `int maxTurbulenceSize(int* arr, int arrSize) {\n    return 0;\n}` }, testcases: [{ input: { arr: [9,4,2,10,7,8,8,1,9] }, expectedOutput: 5 }, { input: { arr: [4,8,12,16] }, expectedOutput: 2 }, { input: { arr: [100] }, expectedOutput: 1 }], hiddentestcases: [{ input: { arr: [0,1,0,1,0] }, expectedOutput: 5 }, { input: { arr: [9,9] }, expectedOutput: 1 }] },

  { id: 212, title: "Minimum Path Sum", slug: "minimum-path-sum", functionName: "minPathSum", difficulty: "Medium", topic: "Dynamic Programming", pattern: "2D DP grid", companies: ["Amazon","Google","Facebook"], description: "Given an m x n grid filled with non-negative numbers, find a path from top left to bottom right which minimizes the sum of all numbers along its path. You can only move right or down.", examples: [{ input: "grid = [[1,3,1],[1,5,1],[4,2,1]]", output: "7", explanation: "1→3→1→1→1" }, { input: "grid = [[1,2,3],[4,5,6]]", output: "12" }], constraints: ["m == grid.length", "n == grid[i].length", "1 <= m, n <= 200", "0 <= grid[i][j] <= 200"], starterCode: { python: `class Solution:\n    def minPathSum(self, grid):\n        pass`, javascript: `function minPathSum(grid) {\n\n}`, typescript: `function minPathSum(grid: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int minPathSum(int[][] grid) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int minPathSum(vector<vector<int>>& grid) { return 0; }\n};` }, testcases: [{ input: { grid: [[1,3,1],[1,5,1],[4,2,1]] }, expectedOutput: 7 }, { input: { grid: [[1,2,3],[4,5,6]] }, expectedOutput: 12 }], hiddentestcases: [{ input: { grid: [[1]] }, expectedOutput: 1 }, { input: { grid: [[1,2],[1,1]] }, expectedOutput: 3 }] },

  { id: 213, title: "Dungeon Game", slug: "dungeon-game", functionName: "calculateMinimumHP", difficulty: "Hard", topic: "Dynamic Programming", pattern: "2D DP reverse", companies: ["Amazon","Google"], description: "A knight must rescue the princess at dungeon[m-1][n-1], starting at dungeon[0][0]. Each room has a value (positive=health gain, negative=health loss). Knight dies if health <= 0 at any point. Return minimum initial health needed.", examples: [{ input: "dungeon = [[-2,-3,3],[-5,-10,1],[10,30,-5]]", output: "7" }, { input: "dungeon = [[0]]", output: "1" }], constraints: ["m == dungeon.length", "n == dungeon[i].length", "1 <= m, n <= 200", "-1000 <= dungeon[i][j] <= 1000"], starterCode: { python: `class Solution:\n    def calculateMinimumHP(self, dungeon):\n        pass`, javascript: `function calculateMinimumHP(dungeon) {\n\n}`, typescript: `function calculateMinimumHP(dungeon: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int calculateMinimumHP(int[][] dungeon) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int calculateMinimumHP(vector<vector<int>>& dungeon) { return 0; }\n};` }, testcases: [{ input: { dungeon: [[-2,-3,3],[-5,-10,1],[10,30,-5]] }, expectedOutput: 7 }, { input: { dungeon: [[0]] }, expectedOutput: 1 }], hiddentestcases: [{ input: { dungeon: [[-1,-30]] }, expectedOutput: 32 }, { input: { dungeon: [[1,-3,3],[-5,10,1]] }, expectedOutput: 5 }] },

  { id: 214, title: "Cherry Pickup", slug: "cherry-pickup", functionName: "cherryPickup", difficulty: "Hard", topic: "Dynamic Programming", pattern: "3D DP two robots", companies: ["Google","Amazon"], description: "You have an n x n grid with -1 (thorn), 0 (empty), 1 (cherry). Walk from (0,0) to (n-1,n-1) picking cherries, then return via the same rules. Cherries can only be picked once. Return maximum cherries collected.", examples: [{ input: "grid = [[0,1,-1],[1,0,-1],[1,1,1]]", output: "5" }, { input: "grid = [[1,1,-1],[1,-1,1],[-1,1,1]]", output: "0" }], constraints: ["n == grid.length == grid[i].length", "1 <= n <= 50", "grid[i][j] is -1, 0, or 1."], starterCode: { python: `class Solution:\n    def cherryPickup(self, grid):\n        pass`, javascript: `function cherryPickup(grid) {\n\n}`, typescript: `function cherryPickup(grid: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int cherryPickup(int[][] grid) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int cherryPickup(vector<vector<int>>& grid) { return 0; }\n};` }, testcases: [{ input: { grid: [[0,1,-1],[1,0,-1],[1,1,1]] }, expectedOutput: 5 }, { input: { grid: [[1,1,-1],[1,-1,1],[-1,1,1]] }, expectedOutput: 0 }], hiddentestcases: [{ input: { grid: [[1]] }, expectedOutput: 1 }, { input: { grid: [[1,1],[1,1]] }, expectedOutput: 4 }] },

  { id: 215, title: "Stone Game", slug: "stone-game", functionName: "stoneGame", difficulty: "Medium", topic: "Dynamic Programming", pattern: "game theory DP", companies: ["Amazon","Facebook"], description: "Alice and Bob play a game with piles of stones. Each turn, a player takes the entire leftmost or rightmost pile. Scores accumulate. Alice always goes first. Both play optimally. Return true if Alice wins (her score > Bob's score). Alice always wins — but prove it with DP.", examples: [{ input: "piles = [5,3,4,5]", output: "true" }, { input: "piles = [3,7,2,3]", output: "true" }], constraints: ["2 <= piles.length <= 500", "piles.length is even.", "1 <= piles[i] <= 500", "sum of piles is odd."], starterCode: { python: `class Solution:\n    def stoneGame(self, piles):\n        pass`, javascript: `function stoneGame(piles) {\n\n}`, typescript: `function stoneGame(piles: number[]): boolean {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public boolean stoneGame(int[] piles) { return false; }\n}`, cpp: `class Solution {\npublic:\n    bool stoneGame(vector<int>& piles) { return false; }\n};`, c: `bool stoneGame(int* piles, int pilesSize) {\n    return false;\n}` }, testcases: [{ input: { piles: [5,3,4,5] }, expectedOutput: true }, { input: { piles: [3,7,2,3] }, expectedOutput: true }], hiddentestcases: [{ input: { piles: [1,2] }, expectedOutput: true }, { input: { piles: [1,100,3,5] }, expectedOutput: true }] },

  { id: 216, title: "Single Number III", slug: "single-number-iii", functionName: "singleNumber", difficulty: "Medium", topic: "Bit Manipulation", pattern: "XOR split on differing bit", companies: ["Amazon","Facebook"], description: "Given an integer array nums in which exactly two elements appear only once and all others appear exactly twice, return the two elements that appear only once. You must use O(1) extra space.", examples: [{ input: "nums = [1,2,1,3,2,5]", output: "[3,5]" }, { input: "nums = [-1,0]", output: "[-1,0]" }, { input: "nums = [0,1]", output: "[1,0]" }], constraints: ["2 <= nums.length <= 3 * 10^4", "-2^31 <= nums[i] <= 2^31 - 1", "Each integer appears exactly twice except for two."], starterCode: { python: `class Solution:\n    def singleNumber(self, nums):\n        pass`, javascript: `function singleNumber(nums) {\n\n}`, typescript: `function singleNumber(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int[] singleNumber(int[] nums) { return new int[]{}; }\n}`, cpp: `class Solution {\npublic:\n    vector<int> singleNumber(vector<int>& nums) { return {}; }\n};`, c: `int* singleNumber(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}` }, testcases: [{ input: { nums: [1,2,1,3,2,5] }, expectedOutput: [3,5] }, { input: { nums: [-1,0] }, expectedOutput: [-1,0] }, { input: { nums: [0,1] }, expectedOutput: [1,0] }], hiddentestcases: [{ input: { nums: [2,4,2,5,5,6] }, expectedOutput: [4,6] }] },

  { id: 217, title: "Total Hamming Distance", slug: "total-hamming-distance", functionName: "totalHammingDistance", difficulty: "Medium", topic: "Bit Manipulation", pattern: "count set bits per position", companies: ["Facebook","Amazon"], description: "The Hamming distance between two integers is the number of positions at which the corresponding bits are different. Given an integer array nums, return the sum of Hamming distances between all pairs of integers in nums.", examples: [{ input: "nums = [4,14,2]", output: "6" }, { input: "nums = [4,14,4]", output: "4" }], constraints: ["1 <= nums.length <= 10^4", "0 <= nums[i] <= 10^9"], starterCode: { python: `class Solution:\n    def totalHammingDistance(self, nums):\n        pass`, javascript: `function totalHammingDistance(nums) {\n\n}`, typescript: `function totalHammingDistance(nums: number[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int totalHammingDistance(int[] nums) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int totalHammingDistance(vector<int>& nums) { return 0; }\n};`, c: `int totalHammingDistance(int* nums, int numsSize) {\n    return 0;\n}` }, testcases: [{ input: { nums: [4,14,2] }, expectedOutput: 6 }, { input: { nums: [4,14,4] }, expectedOutput: 4 }], hiddentestcases: [{ input: { nums: [0,0] }, expectedOutput: 0 }, { input: { nums: [1,2,3] }, expectedOutput: 4 }] },

  { id: 218, title: "Bitwise AND of Numbers Range", slug: "bitwise-and-numbers-range", functionName: "rangeBitwiseAnd", difficulty: "Medium", topic: "Bit Manipulation", pattern: "common prefix bit shift", companies: ["Amazon","Google"], description: "Given two integers left and right representing a range [left, right], return the bitwise AND of all numbers in this range.", examples: [{ input: "left = 5, right = 7", output: "4" }, { input: "left = 0, right = 0", output: "0" }, { input: "left = 1, right = 2147483647", output: "0" }], constraints: ["0 <= left <= right <= 2^31 - 1"], starterCode: { python: `class Solution:\n    def rangeBitwiseAnd(self, left, right):\n        pass`, javascript: `function rangeBitwiseAnd(left, right) {\n\n}`, typescript: `function rangeBitwiseAnd(left: number, right: number): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int rangeBitwiseAnd(int left, int right) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int rangeBitwiseAnd(int left, int right) { return 0; }\n};`, c: `int rangeBitwiseAnd(int left, int right) {\n    return 0;\n}` }, testcases: [{ input: { left: 5, right: 7 }, expectedOutput: 4 }, { input: { left: 0, right: 0 }, expectedOutput: 0 }, { input: { left: 1, right: 2147483647 }, expectedOutput: 0 }], hiddentestcases: [{ input: { left: 3, right: 3 }, expectedOutput: 3 }, { input: { left: 4, right: 7 }, expectedOutput: 4 }] },

  { id: 219, title: "Largest Number", slug: "largest-number", functionName: "largestNumber", difficulty: "Medium", topic: "Greedy", pattern: "custom comparator sort", companies: ["Amazon","Facebook","Microsoft"], description: "Given a list of non-negative integers nums, arrange them such that they form the largest number and return it as a string. Note: The result may be very large, so return a string instead of an integer.", examples: [{ input: "nums = [10,2]", output: '"210"' }, { input: "nums = [3,30,34,5,9]", output: '"9534330"' }], constraints: ["1 <= nums.length <= 100", "0 <= nums[i] <= 10^9"], starterCode: { python: `class Solution:\n    def largestNumber(self, nums):\n        pass`, javascript: `function largestNumber(nums) {\n\n}`, typescript: `function largestNumber(nums: number[]): string {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public String largestNumber(int[] nums) { return ""; }\n}`, cpp: `class Solution {\npublic:\n    string largestNumber(vector<int>& nums) { return ""; }\n};`, c: `char* largestNumber(int* nums, int numsSize) {\n    return "";\n}` }, testcases: [{ input: { nums: [10,2] }, expectedOutput: "210" }, { input: { nums: [3,30,34,5,9] }, expectedOutput: "9534330" }, { input: { nums: [0,0] }, expectedOutput: "0" }], hiddentestcases: [{ input: { nums: [1] }, expectedOutput: "1" }, { input: { nums: [824,938,1399,5607,6973,5703,9609,4398,8247] }, expectedOutput: "9609938824824769735703560743981399" }] },

  {
    id: 220,
    title: "Single Number II",
    slug: "single-number-ii",
    functionName: "singleNumber",
    difficulty: "Medium",
    topic: "Bit Manipulation",
    pattern: "count bits mod 3",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "Given an integer array nums where every element appears exactly three times except for one, which appears exactly once. Find the single element and return it. Your solution must have O(1) extra space complexity and O(n) time complexity.",
    examples: [
      { input: "nums = [2,2,3,2]", output: "3" },
      { input: "nums = [0,1,0,1,0,1,99]", output: "99" },
    ],
    constraints: ["1 <= nums.length <= 3 * 10^4", "-2^31 <= nums[i] <= 2^31 - 1", "Each element appears exactly three times except for one."],
    starterCode: {
      python: `class Solution:\n    def singleNumber(self, nums):\n        pass`,
      javascript: `function singleNumber(nums) {\n\n}`,
      typescript: `function singleNumber(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int singleNumber(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int singleNumber(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int singleNumber(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [2,2,3,2] }, expectedOutput: 3 },
      { input: { nums: [0,1,0,1,0,1,99] }, expectedOutput: 99 },
    ],
    hiddentestcases: [
      { input: { nums: [-2,-2,1,-2] }, expectedOutput: 1 },
      { input: { nums: [43,16,45,89,45,-2147483648,45,16,16,43,43,89,89] }, expectedOutput: -2147483648 },
    ],
  },

  // ── BATCH 048: Stacks II + Queues (IDs 221-230) ───────────────────────────

  { id: 221, title: "Next Greater Element I", slug: "next-greater-element-i", functionName: "nextGreaterElement", difficulty: "Easy", topic: "Stacks", pattern: "monotonic stack with hash map", companies: ["Amazon","Microsoft"], description: "The next greater element of some element x in an array is the first greater element to the right. Given two arrays nums1 and nums2 (nums1 is a subset of nums2), return an array of the next greater element for each element in nums1. Return -1 if no greater element exists.", examples: [{ input: "nums1 = [4,1,2], nums2 = [1,3,4,2]", output: "[-1,3,-1]" }, { input: "nums1 = [2,4], nums2 = [1,2,3,4]", output: "[3,-1]" }], constraints: ["1 <= nums1.length <= nums2.length <= 1000", "0 <= nums1[i], nums2[i] <= 10^4", "All integers in nums2 are unique."], starterCode: { python: `class Solution:\n    def nextGreaterElement(self, nums1, nums2):\n        pass`, javascript: `function nextGreaterElement(nums1, nums2) {\n\n}`, typescript: `function nextGreaterElement(nums1: number[], nums2: number[]): number[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int[] nextGreaterElement(int[] nums1, int[] nums2) { return new int[]{}; }\n}`, cpp: `class Solution {\npublic:\n    vector<int> nextGreaterElement(vector<int>& nums1, vector<int>& nums2) { return {}; }\n};`, c: `int* nextGreaterElement(int* nums1, int nums1Size, int* nums2, int nums2Size, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}` }, testcases: [{ input: { nums1: [4,1,2], nums2: [1,3,4,2] }, expectedOutput: [-1,3,-1] }, { input: { nums1: [2,4], nums2: [1,2,3,4] }, expectedOutput: [3,-1] }], hiddentestcases: [{ input: { nums1: [1,3,5,2,4], nums2: [6,5,4,3,2,1,7] }, expectedOutput: [7,7,7,7,7] }] },

  { id: 222, title: "Next Greater Element II", slug: "next-greater-element-ii", functionName: "nextGreaterElements", difficulty: "Medium", topic: "Stacks", pattern: "circular monotonic stack", companies: ["Amazon","Facebook"], description: "Given a circular integer array nums, return the next greater number for every element. The next greater number of a number x is the first greater number to its traversal order next in the circular array.", examples: [{ input: "nums = [1,2,1]", output: "[2,-1,2]" }, { input: "nums = [1,2,3,4,3]", output: "[2,3,4,-1,4]" }], constraints: ["1 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"], starterCode: { python: `class Solution:\n    def nextGreaterElements(self, nums):\n        pass`, javascript: `function nextGreaterElements(nums) {\n\n}`, typescript: `function nextGreaterElements(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int[] nextGreaterElements(int[] nums) { return new int[]{}; }\n}`, cpp: `class Solution {\npublic:\n    vector<int> nextGreaterElements(vector<int>& nums) { return {}; }\n};`, c: `int* nextGreaterElements(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}` }, testcases: [{ input: { nums: [1,2,1] }, expectedOutput: [2,-1,2] }, { input: { nums: [1,2,3,4,3] }, expectedOutput: [2,3,4,-1,4] }], hiddentestcases: [{ input: { nums: [5,4,3,2,1] }, expectedOutput: [-1,5,5,5,5] }, { input: { nums: [1] }, expectedOutput: [-1] }] },

  { id: 223, title: "Trapping Rain Water II", slug: "trapping-rain-water-ii", functionName: "trapRainWater", difficulty: "Hard", topic: "Heap", pattern: "min heap BFS from border", companies: ["Amazon","Google"], description: "Given an m x n matrix of non-negative integers representing heights, compute how much water it can trap after raining (3D version).", examples: [{ input: "heightMap = [[1,4,3,1,3,2],[3,2,1,3,2,4],[2,3,3,2,3,1]]", output: "4" }, { input: "heightMap = [[3,3,3,3,3],[3,2,2,2,3],[3,2,1,2,3],[3,2,2,2,3],[3,3,3,3,3]]", output: "10" }], constraints: ["m == heightMap.length", "n == heightMap[i].length", "1 <= m, n <= 200", "0 <= heightMap[i][j] <= 2 * 10^4"], starterCode: { python: `class Solution:\n    def trapRainWater(self, heightMap):\n        pass`, javascript: `function trapRainWater(heightMap) {\n\n}`, typescript: `function trapRainWater(heightMap: number[][]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int trapRainWater(int[][] heightMap) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int trapRainWater(vector<vector<int>>& heightMap) { return 0; }\n};` }, testcases: [{ input: { heightMap: [[1,4,3,1,3,2],[3,2,1,3,2,4],[2,3,3,2,3,1]] }, expectedOutput: 4 }, { input: { heightMap: [[3,3,3,3,3],[3,2,2,2,3],[3,2,1,2,3],[3,2,2,2,3],[3,3,3,3,3]] }, expectedOutput: 10 }], hiddentestcases: [{ input: { heightMap: [[1,1],[1,1]] }, expectedOutput: 0 }] },

  {
    id: 224,
    title: "Maximal Rectangle",
    slug: "maximal-rectangle",
    functionName: "maximalRectangle",
    difficulty: "Hard",
    topic: "Stacks",
    pattern: "histogram stack per row",
    sourceType: "core",
    companies: ["Amazon", "Microsoft"],
    description: "Given a rows x cols binary matrix filled with '0's and '1's, find the largest rectangle containing only '1's and return its area.",
    examples: [
      { input: 'matrix = [["1","0","1","0","0"],["1","0","1","1","1"],["1","1","1","1","1"],["1","0","0","1","0"]]', output: "6" },
      { input: 'matrix = [["0"]]', output: "0" },
      { input: 'matrix = [["1"]]', output: "1" },
    ],
    constraints: ["rows == matrix.length", "cols == matrix[i].length", "1 <= rows, cols <= 200", "matrix[i][j] is '0' or '1'."],
    starterCode: {
      python: `class Solution:\n    def maximalRectangle(self, matrix):\n        pass`,
      javascript: `function maximalRectangle(matrix) {\n\n}`,
      typescript: `function maximalRectangle(matrix: string[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maximalRectangle(char[][] matrix) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maximalRectangle(vector<vector<char>>& matrix) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { matrix: [["1","0","1","0","0"],["1","0","1","1","1"],["1","1","1","1","1"],["1","0","0","1","0"]] }, expectedOutput: 6 },
      { input: { matrix: [["0"]] }, expectedOutput: 0 },
      { input: { matrix: [["1"]] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { matrix: [["1","1"],["1","1"]] }, expectedOutput: 4 },
      { input: { matrix: [["1","0"],["0","1"]] }, expectedOutput: 1 },
    ],
  },

  { id: 225, title: "Decode String", slug: "decode-string", functionName: "decodeString", difficulty: "Medium", topic: "Stacks", pattern: "stack string expansion", companies: ["Amazon","Facebook","Google"], description: 'Given an encoded string, return its decoded string. The encoding rule is k[encoded_string], where the encoded_string is repeated exactly k times. You may assume k is always positive. Input is always valid.', examples: [{ input: 's = "3[a]2[bc]"', output: '"aaabcbc"' }, { input: 's = "3[a2[c]]"', output: '"accaccacc"' }, { input: 's = "2[abc]3[cd]ef"', output: '"abcabccdcdcdef"' }], constraints: ["1 <= s.length <= 30", "s consists of lowercase letters, digits, and '[]'.", "All integers are in range [1,300]."], starterCode: { python: `class Solution:\n    def decodeString(self, s):\n        pass`, javascript: `function decodeString(s) {\n\n}`, typescript: `function decodeString(s: string): string {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public String decodeString(String s) { return ""; }\n}`, cpp: `class Solution {\npublic:\n    string decodeString(string s) { return ""; }\n};`, c: `char* decodeString(char* s) {\n    return "";\n}` }, testcases: [{ input: { s: "3[a]2[bc]" }, expectedOutput: "aaabcbc" }, { input: { s: "3[a2[c]]" }, expectedOutput: "accaccacc" }, { input: { s: "2[abc]3[cd]ef" }, expectedOutput: "abcabccdcdcdef" }], hiddentestcases: [{ input: { s: "100[leetcode]" }, expectedOutput: "leetcode".repeat(100) }, { input: { s: "1[a]" }, expectedOutput: "a" }] },

  { id: 226, title: "Online Stock Span", slug: "online-stock-span", functionName: "StockSpanner", operationSequence: { enabled: true, resultMode: "all" }, difficulty: "Medium", topic: "Stacks", pattern: "monotonic stack span count", companies: ["Amazon","Google"], description: "Design an algorithm to collect stock prices and return the span of the stock's price for the current day. The span is the maximum number of consecutive days (starting from today and going backward) for which the stock price was <= today's price.", examples: [{ input: '["StockSpanner","next","next","next","next","next","next","next"]\n[[],[100],[80],[60],[70],[60],[75],[85]]', output: "[null,1,1,1,2,1,4,6]" }], constraints: ["0 <= price <= 10^5", "At most 10^4 calls to next."], starterCode: { python: `class StockSpanner:\n    def __init__(self):\n        pass\n    def next(self, price):\n        pass`, javascript: `class StockSpanner {\n  constructor() {}\n  next(price) { return 0; }\n}`, typescript: `class StockSpanner {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  next(price: number): number {\n    throw new Error("Not implemented");\n  }\n}`, java: `class StockSpanner {\n    public StockSpanner() {}\n    public int next(int price) { return 0; }\n}`, cpp: `class StockSpanner {\npublic:\n    StockSpanner() {}\n    int next(int price) { return 0; }\n};` }, testcases: [{ input: { ops: ["next","next","next","next","next","next","next"], vals: [[100],[80],[60],[70],[60],[75],[85]] }, expectedOutput: [1,1,1,2,1,4,6] }], hiddentestcases: [{ input: { ops: ["next","next","next"], vals: [[1],[1],[1]] }, expectedOutput: [1,2,3] }] },

  {
    id: 227,
    title: "Minimum Stack",
    slug: "minimum-stack",
    functionName: "MinStack",
    // Operation-sequence contract (audit P0-2) — see backend/utils/operationSequenceDriver.js.
    operationSequence: { enabled: true, resultMode: "all" },
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "auxiliary min stack",
    sourceType: "core",
    companies: ["Amazon", "Bloomberg", "Google", "Facebook"],
    description: "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time. Implement MinStack with push(val), pop(), top(), and getMin() — all in O(1).",
    examples: [
      { input: '["MinStack","push","push","push","getMin","pop","top","getMin"]\n[[],[-2],[0],[-3],[],[],[],[]]', output: "[null,null,null,null,-3,null,0,-2]" },
    ],
    constraints: ["-2^31 <= val <= 2^31 - 1", "pop, top, getMin called only when stack is non-empty.", "At most 3 * 10^4 calls."],
    starterCode: {
      python: `class MinStack:\n    def __init__(self):\n        pass\n    def push(self, val):\n        pass\n    def pop(self):\n        pass\n    def top(self):\n        pass\n    def getMin(self):\n        pass`,
      javascript: `class MinStack {\n  constructor() {}\n  push(val) {}\n  pop() {}\n  top() {}\n  getMin() {}\n}`,
      typescript: `class MinStack {\n  constructor() {\n    throw new Error("Not implemented");\n  }\n  push(val: number): void {\n    throw new Error("Not implemented");\n  }\n  pop(): void {\n    throw new Error("Not implemented");\n  }\n  top(): number {\n    throw new Error("Not implemented");\n  }\n  getMin(): number {\n    throw new Error("Not implemented");\n  }\n}`,
      java: `class MinStack {\n    public MinStack() {}\n    public void push(int val) {}\n    public void pop() {}\n    public int top() { return 0; }\n    public int getMin() { return 0; }\n}`,
      cpp: `class MinStack {\npublic:\n    MinStack() {}\n    void push(int val) {}\n    void pop() {}\n    int top() { return 0; }\n    int getMin() { return 0; }\n};`,
    },
    testcases: [
      { input: { ops: ["push","push","push","getMin","pop","top","getMin"], vals: [[-2],[0],[-3],[],[],[],[]] }, expectedOutput: [null,null,null,-3,null,0,-2] },
    ],
    hiddentestcases: [
      { input: { ops: ["push","push","getMin","pop","getMin"], vals: [[2],[1],[],[],[]] }, expectedOutput: [null,null,1,null,2] },
    ],
  },

  { id: 228, title: "Minimum Cost For Tickets", slug: "minimum-cost-for-tickets", functionName: "mincostTickets", difficulty: "Medium", topic: "Dynamic Programming", pattern: "1D DP travel days", companies: ["Amazon","Google"], description: "You travel on some days in a year [1, 365]. Train tickets cost costs[0] for 1 day, costs[1] for 7 days, costs[2] for 30 days. Return the minimum cost to travel every day in the given days array.", examples: [{ input: "days = [1,4,6,7,8,20], costs = [2,7,15]", output: "11" }, { input: "days = [1,2,3,4,5,6,7,8,9,10,30,31], costs = [2,7,15]", output: "17" }], constraints: ["1 <= days.length <= 365", "1 <= days[i] <= 365", "days is sorted in strictly increasing order.", "costs.length == 3", "1 <= costs[i] <= 1000"], starterCode: { python: `class Solution:\n    def mincostTickets(self, days, costs):\n        pass`, javascript: `function mincostTickets(days, costs) {\n\n}`, typescript: `function mincostTickets(days: number[], costs: number[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int mincostTickets(int[] days, int[] costs) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int mincostTickets(vector<int>& days, vector<int>& costs) { return 0; }\n};`, c: `int mincostTickets(int* days, int daysSize, int* costs, int costsSize) {\n    return 0;\n}` }, testcases: [{ input: { days: [1,4,6,7,8,20], costs: [2,7,15] }, expectedOutput: 11 }, { input: { days: [1,2,3,4,5,6,7,8,9,10,30,31], costs: [2,7,15] }, expectedOutput: 17 }], hiddentestcases: [{ input: { days: [1], costs: [10,20,30] }, expectedOutput: 10 }, { input: { days: [1,2,3,4,5,6,7], costs: [1,2,10] }, expectedOutput: 7 }] },

  {
    id: 229,
    title: "Asteroid Collision",
    slug: "asteroid-collision",
    functionName: "asteroidCollision",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "collision simulation stack",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "We have an array of asteroids. Positive integers move right, negative move left. When two asteroids meet, the smaller one explodes. Equal ones both explode. Return the state after all collisions. Left-moving and right-moving asteroids in opposite directions collide.",
    examples: [
      { input: "asteroids = [5,10,-5]", output: "[5,10]", explanation: "10 and -5 collide → 10 survives." },
      { input: "asteroids = [8,-8]", output: "[]", explanation: "Both explode." },
      { input: "asteroids = [10,2,-5]", output: "[10]" },
    ],
    constraints: ["2 <= asteroids.length <= 10^4", "-1000 <= asteroids[i] <= 1000", "asteroids[i] != 0"],
    starterCode: {
      python: `class Solution:\n    def asteroidCollision(self, asteroids):\n        pass`,
      javascript: `function asteroidCollision(asteroids) {\n\n}`,
      typescript: `function asteroidCollision(asteroids: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] asteroidCollision(int[] asteroids) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> asteroidCollision(vector<int>& asteroids) {\n        return {};\n    }\n};`,
      c: `int* asteroidCollision(int* asteroids, int asteroidsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { asteroids: [5,10,-5] }, expectedOutput: [5,10] },
      { input: { asteroids: [8,-8] }, expectedOutput: [] },
      { input: { asteroids: [10,2,-5] }, expectedOutput: [10] },
    ],
    hiddentestcases: [
      { input: { asteroids: [-2,-1,1,2] }, expectedOutput: [-2,-1,1,2] },
      { input: { asteroids: [1,-2,-2,-2] }, expectedOutput: [-2,-2,-2] },
    ],
  },

  {
    id: 230,
    title: "Remove K Digits",
    slug: "remove-k-digits",
    functionName: "removeKdigits",
    difficulty: "Medium",
    topic: "Stacks",
    pattern: "monotonic stack digit removal",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "Given a string num representing a non-negative integer and an integer k, remove k digits from the number so that the new number is the smallest possible. Return the result as a string. Remove leading zeros.",
    examples: [
      { input: 'num = "1432219", k = 3', output: '"1219"' },
      { input: 'num = "10200", k = 1', output: '"200"' },
      { input: 'num = "10", k = 2', output: '"0"' },
    ],
    constraints: ["1 <= k <= num.length <= 10^5", "num consists of only digits.", "num does not have any leading zeros except for the zero itself."],
    starterCode: {
      python: `class Solution:\n    def removeKdigits(self, num, k):\n        pass`,
      javascript: `function removeKdigits(num, k) {\n\n}`,
      typescript: `function removeKdigits(num: string, k: number): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String removeKdigits(String num, int k) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string removeKdigits(string num, int k) {\n        return "";\n    }\n};`,
      c: `char* removeKdigits(char* num, int k) {\n    return "";\n}`,
    },
    testcases: [
      { input: { num: "1432219", k: 3 }, expectedOutput: "1219" },
      { input: { num: "10200", k: 1 }, expectedOutput: "200" },
      { input: { num: "10", k: 2 }, expectedOutput: "0" },
    ],
    hiddentestcases: [
      { input: { num: "9", k: 1 }, expectedOutput: "0" },
      { input: { num: "112", k: 1 }, expectedOutput: "11" },
    ],
  },

  // ── BATCH 049: Advanced DP + Greedy (IDs 231-240) ─────────────────────────

  {
    id: 231,
    title: "Wildcard Matching",
    slug: "wildcard-matching",
    functionName: "isMatch",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "2D DP string matching",
    sourceType: "core",
    companies: ["Facebook", "Google", "Amazon"],
    description: "Given an input string s and a pattern p, implement wildcard pattern matching with '?' (matches any single character) and '*' (matches any sequence including empty). The matching must cover the entire input string.",
    examples: [
      { input: 's = "aa", p = "a"', output: "false" },
      { input: 's = "aa", p = "*"', output: "true" },
      { input: 's = "cb", p = "?a"', output: "false" },
    ],
    constraints: ["0 <= s.length, p.length <= 2000", "s contains only lowercase English letters.", "p contains only lowercase English letters, '?', or '*'."],
    starterCode: {
      python: `class Solution:\n    def isMatch(self, s, p):\n        pass`,
      javascript: `function isMatch(s, p) {\n\n}`,
      typescript: `function isMatch(s: string, p: string): boolean {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public boolean isMatch(String s, String p) {\n        return false;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    bool isMatch(string s, string p) {\n        return false;\n    }\n};`,
      c: `bool isMatch(char* s, char* p) {\n    return false;\n}`,
    },
    testcases: [
      { input: { s: "aa", p: "a" }, expectedOutput: false },
      { input: { s: "aa", p: "*" }, expectedOutput: true },
      { input: { s: "cb", p: "?a" }, expectedOutput: false },
    ],
    hiddentestcases: [
      { input: { s: "adceb", p: "*a*b" }, expectedOutput: true },
      { input: { s: "acdcb", p: "a*c?b" }, expectedOutput: false },
    ],
  },

  { id: 232, title: "Minimum Remove to Make Valid Parentheses", slug: "minimum-remove-valid-parentheses", functionName: "minRemoveToMakeValid", difficulty: "Medium", topic: "Stacks", pattern: "stack index tracking removal", companies: ["Facebook","Amazon","Google"], description: "Given a string s consisting of '(', ')' and lowercase English letters, remove the minimum number of parentheses to make the resulting string valid. Return any valid result.", examples: [{ input: 's = "lee(t(c)o)de)"', output: '"lee(t(c)o)de"' }, { input: 's = "a)b(c)d"', output: '"ab(c)d"' }, { input: 's = "))(("', output: '""' }], constraints: ["1 <= s.length <= 10^5", "s[i] is either '(' , ')' or a lowercase English letter."], starterCode: { python: `class Solution:\n    def minRemoveToMakeValid(self, s):\n        pass`, javascript: `function minRemoveToMakeValid(s) {\n\n}`, typescript: `function minRemoveToMakeValid(s: string): string {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public String minRemoveToMakeValid(String s) { return ""; }\n}`, cpp: `class Solution {\npublic:\n    string minRemoveToMakeValid(string s) { return ""; }\n};`, c: `char* minRemoveToMakeValid(char* s) {\n    return "";\n}` }, testcases: [{ input: { s: "lee(t(c)o)de)" }, expectedOutput: "lee(t(c)o)de" }, { input: { s: "a)b(c)d" }, expectedOutput: "ab(c)d" }, { input: { s: "))((" }, expectedOutput: "" }], hiddentestcases: [{ input: { s: "(a(b(c)d)" }, expectedOutput: "a(b(c)d)" }, { input: { s: "a" }, expectedOutput: "a" }] },

  {
    id: 233,
    title: "Best Time to Buy and Sell Stock III",
    slug: "best-time-to-buy-sell-stock-iii",
    functionName: "maxProfit",
    difficulty: "Hard",
    topic: "Dynamic Programming",
    pattern: "state machine DP",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google"],
    description: "Given an array prices where prices[i] is the price of stock on day i, find the maximum profit using at most two transactions. You may not engage in multiple transactions simultaneously (must sell before buying again).",
    examples: [
      { input: "prices = [3,3,5,0,0,3,1,4]", output: "6", explanation: "Buy on day 4, sell on day 6. Buy on day 7, sell on day 8. Profit = 3+3 = 6." },
      { input: "prices = [1,2,3,4,5]", output: "4" },
      { input: "prices = [7,6,4,3,1]", output: "0" },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^5"],
    starterCode: {
      python: `class Solution:\n    def maxProfit(self, prices):\n        pass`,
      javascript: `function maxProfit(prices) {\n\n}`,
      typescript: `function maxProfit(prices: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maxProfit(int[] prices) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maxProfit(vector<int>& prices) {\n        return 0;\n    }\n};`,
      c: `int maxProfit(int* prices, int pricesSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { prices: [3,3,5,0,0,3,1,4] }, expectedOutput: 6 },
      { input: { prices: [1,2,3,4,5] }, expectedOutput: 4 },
      { input: { prices: [7,6,4,3,1] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { prices: [1] }, expectedOutput: 0 },
      { input: { prices: [1,2,4,2,5,7,2,4,9,0,9] }, expectedOutput: 15 },
    ],
  },

  {
    id: 234,
    title: "Maximal Square",
    slug: "maximal-square",
    functionName: "maximalSquare",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    pattern: "2D DP min of neighbors",
    sourceType: "core",
    companies: ["Facebook", "Amazon", "Airbnb"],
    description: "Given an m x n binary matrix filled with '0's and '1's, find the largest square containing only '1's and return its area.",
    examples: [
      { input: 'matrix = [["1","0","1","0","0"],["1","0","1","1","1"],["1","1","1","1","1"],["1","0","0","1","0"]]', output: "4" },
      { input: 'matrix = [["0","1"],["1","0"]]', output: "1" },
      { input: 'matrix = [["0"]]', output: "0" },
    ],
    constraints: ["m == matrix.length", "n == matrix[i].length", "1 <= m, n <= 300", "matrix[i][j] is '0' or '1'."],
    starterCode: {
      python: `class Solution:\n    def maximalSquare(self, matrix):\n        pass`,
      javascript: `function maximalSquare(matrix) {\n\n}`,
      typescript: `function maximalSquare(matrix: string[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int maximalSquare(char[][] matrix) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int maximalSquare(vector<vector<char>>& matrix) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { matrix: [["1","0","1","0","0"],["1","0","1","1","1"],["1","1","1","1","1"],["1","0","0","1","0"]] }, expectedOutput: 4 },
      { input: { matrix: [["0","1"],["1","0"]] }, expectedOutput: 1 },
      { input: { matrix: [["0"]] }, expectedOutput: 0 },
    ],
    hiddentestcases: [
      { input: { matrix: [["1"]] }, expectedOutput: 1 },
      { input: { matrix: [["1","1","1","1"],["1","1","1","1"],["1","1","1","1"]] }, expectedOutput: 9 },
    ],
  },

  {
    id: 235,
    title: "Candy",
    slug: "candy",
    functionName: "candy",
    difficulty: "Hard",
    topic: "Greedy",
    pattern: "two-pass greedy",
    sourceType: "core",
    companies: ["Amazon", "Google"],
    description: "There are n children standing in a line. Each child is assigned a rating value. Give each child at least 1 candy. Children with a higher rating than their adjacent neighbor get more candy. Return the minimum number of candies you must give.",
    examples: [
      { input: "ratings = [1,0,2]", output: "5", explanation: "[2,1,2]" },
      { input: "ratings = [1,2,2]", output: "4", explanation: "[1,2,1]" },
    ],
    constraints: ["n == ratings.length", "1 <= n <= 2 * 10^4", "0 <= ratings[i] <= 2 * 10^4"],
    starterCode: {
      python: `class Solution:\n    def candy(self, ratings):\n        pass`,
      javascript: `function candy(ratings) {\n\n}`,
      typescript: `function candy(ratings: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int candy(int[] ratings) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int candy(vector<int>& ratings) {\n        return 0;\n    }\n};`,
      c: `int candy(int* ratings, int ratingsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { ratings: [1,0,2] }, expectedOutput: 5 },
      { input: { ratings: [1,2,2] }, expectedOutput: 4 },
      { input: { ratings: [1] }, expectedOutput: 1 },
    ],
    hiddentestcases: [
      { input: { ratings: [1,3,2,2,1] }, expectedOutput: 7 },
      { input: { ratings: [0,1,2,5,3,2,7] }, expectedOutput: 15 },
    ],
  },

  {
    id: 236,
    title: "Partition Labels",
    slug: "partition-labels",
    functionName: "partitionLabels",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "last occurrence greedy",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "You are given a string s. We want to partition this string into as many parts as possible so that each letter appears in at most one part. Return a list of integers representing the size of these parts.",
    examples: [
      { input: 's = "ababcbacadefegdehijhklij"', output: "[9,7,8]" },
      { input: 's = "eccbbbbdec"', output: "[10]" },
    ],
    constraints: ["1 <= s.length <= 500", "s consists of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def partitionLabels(self, s):\n        pass`,
      javascript: `function partitionLabels(s) {\n\n}`,
      typescript: `function partitionLabels(s: string): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public List<Integer> partitionLabels(String s) {\n        return new ArrayList<>();\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> partitionLabels(string s) {\n        return {};\n    }\n};`,
      c: `int* partitionLabels(char* s, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}`,
    },
    testcases: [
      { input: { s: "ababcbacadefegdehijhklij" }, expectedOutput: [9,7,8] },
      { input: { s: "eccbbbbdec" }, expectedOutput: [10] },
      { input: { s: "a" }, expectedOutput: [1] },
    ],
    hiddentestcases: [
      { input: { s: "abcde" }, expectedOutput: [1,1,1,1,1] },
      { input: { s: "eaaaabaaec" }, expectedOutput: [9,1] },
    ],
  },

  {
    id: 237,
    title: "Boats to Save People",
    slug: "boats-to-save-people",
    functionName: "numRescueBoats",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "two pointer greedy",
    sourceType: "core",
    companies: ["Amazon", "Facebook"],
    description: "You are given an array people where people[i] is the weight of the ith person and an infinite number of boats where each boat can carry at most limit weight (at most 2 people per boat). Return the minimum number of boats needed.",
    examples: [
      { input: "people = [1,2], limit = 3", output: "1" },
      { input: "people = [3,2,2,1], limit = 3", output: "3" },
      { input: "people = [3,5,3,4], limit = 5", output: "4" },
    ],
    constraints: ["1 <= people.length <= 5 * 10^4", "1 <= people[i] <= limit <= 3 * 10^4"],
    starterCode: {
      python: `class Solution:\n    def numRescueBoats(self, people, limit):\n        pass`,
      javascript: `function numRescueBoats(people, limit) {\n\n}`,
      typescript: `function numRescueBoats(people: number[], limit: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int numRescueBoats(int[] people, int limit) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int numRescueBoats(vector<int>& people, int limit) {\n        return 0;\n    }\n};`,
      c: `int numRescueBoats(int* people, int peopleSize, int limit) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { people: [1,2], limit: 3 }, expectedOutput: 1 },
      { input: { people: [3,2,2,1], limit: 3 }, expectedOutput: 3 },
      { input: { people: [3,5,3,4], limit: 5 }, expectedOutput: 4 },
    ],
    hiddentestcases: [
      { input: { people: [2,2], limit: 6 }, expectedOutput: 1 },
      { input: { people: [5,1,4,2], limit: 6 }, expectedOutput: 2 },
    ],
  },

  {
    id: 238,
    title: "Queue Reconstruction by Height",
    slug: "queue-reconstruction-by-height",
    functionName: "reconstructQueue",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "sort + insert by k",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "You are given an array people where people[i] = [hi, ki] means person i has height hi and exactly ki people in front who have height >= hi. Reconstruct and return the queue. Answer is guaranteed to exist.",
    examples: [
      { input: "people = [[7,0],[4,4],[7,1],[5,0],[6,1],[5,2]]", output: "[[5,0],[7,0],[5,2],[6,1],[4,4],[7,1]]" },
      { input: "people = [[6,0],[5,0],[4,0],[3,2],[2,2],[1,4]]", output: "[[4,0],[5,0],[2,2],[3,2],[1,4],[6,0]]" },
    ],
    constraints: ["1 <= people.length <= 2000", "0 <= hi <= 10^6", "0 <= ki < people.length", "Guaranteed unique [hi, ki] pairs."],
    starterCode: {
      python: `class Solution:\n    def reconstructQueue(self, people):\n        pass`,
      javascript: `function reconstructQueue(people) {\n\n}`,
      typescript: `function reconstructQueue(people: number[][]): number[][] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[][] reconstructQueue(int[][] people) {\n        return new int[][]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<vector<int>> reconstructQueue(vector<vector<int>>& people) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { people: [[7,0],[4,4],[7,1],[5,0],[6,1],[5,2]] }, expectedOutput: [[5,0],[7,0],[5,2],[6,1],[4,4],[7,1]] },
      { input: { people: [[6,0],[5,0],[4,0],[3,2],[2,2],[1,4]] }, expectedOutput: [[4,0],[5,0],[2,2],[3,2],[1,4],[6,0]] },
    ],
    hiddentestcases: [
      { input: { people: [[7,0],[4,4]] }, expectedOutput: [[7,0],[4,4]] },
    ],
  },

  {
    id: 239,
    title: "Wiggle Subsequence",
    slug: "wiggle-subsequence",
    functionName: "wiggleMaxLength",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "sign change greedy",
    sourceType: "core",
    companies: ["Amazon"],
    description: "A wiggle sequence is one where the differences between successive numbers strictly alternate between positive and negative. Given an integer array nums, return the length of the longest wiggle subsequence.",
    examples: [
      { input: "nums = [1,7,4,9,2,5]", output: "6", explanation: "Differences: 6,-3,5,-7,3 — all alternate." },
      { input: "nums = [1,17,5,10,13,15,10,5,16,8]", output: "7" },
      { input: "nums = [1,2,3,4,5,6,7,8,9]", output: "2" },
    ],
    constraints: ["1 <= nums.length <= 1000", "0 <= nums[i] <= 1000"],
    starterCode: {
      python: `class Solution:\n    def wiggleMaxLength(self, nums):\n        pass`,
      javascript: `function wiggleMaxLength(nums) {\n\n}`,
      typescript: `function wiggleMaxLength(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int wiggleMaxLength(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int wiggleMaxLength(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int wiggleMaxLength(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1,7,4,9,2,5] }, expectedOutput: 6 },
      { input: { nums: [1,17,5,10,13,15,10,5,16,8] }, expectedOutput: 7 },
      { input: { nums: [1,2,3,4,5,6,7,8,9] }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { nums: [0,0] }, expectedOutput: 1 },
      { input: { nums: [3,3,3,2,5] }, expectedOutput: 3 },
    ],
  },

  {
    id: 240,
    title: "Minimum Number of Arrows to Burst Balloons",
    slug: "minimum-arrows-burst-balloons",
    functionName: "findMinArrowShots",
    difficulty: "Medium",
    topic: "Greedy",
    pattern: "sort by end + greedy overlap",
    sourceType: "core",
    companies: ["Facebook", "Amazon"],
    description: "Balloons are represented as intervals [xstart, xend]. An arrow shot at x bursts all balloons where xstart <= x <= xend. Return the minimum number of arrows needed to burst all balloons.",
    examples: [
      { input: "points = [[10,16],[2,8],[1,6],[7,12]]", output: "2" },
      { input: "points = [[1,2],[3,4],[5,6],[7,8]]", output: "4" },
      { input: "points = [[1,2],[2,3],[3,4],[4,5]]", output: "2" },
    ],
    constraints: ["1 <= points.length <= 10^5", "points[i].length == 2", "-2^31 <= xstart < xend <= 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def findMinArrowShots(self, points):\n        pass`,
      javascript: `function findMinArrowShots(points) {\n\n}`,
      typescript: `function findMinArrowShots(points: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findMinArrowShots(int[][] points) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findMinArrowShots(vector<vector<int>>& points) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { points: [[10,16],[2,8],[1,6],[7,12]] }, expectedOutput: 2 },
      { input: { points: [[1,2],[3,4],[5,6],[7,8]] }, expectedOutput: 4 },
      { input: { points: [[1,2],[2,3],[3,4],[4,5]] }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { points: [[1,2]] }, expectedOutput: 1 },
      { input: { points: [[-2147483646,-2147483645],[2147483646,2147483647]] }, expectedOutput: 2 },
    ],
  },

  // ── BATCH 050: Final 10 — Hard + Company Specials (IDs 241-250) ───────────

  { id: 241, title: "Squares of a Sorted Array", slug: "squares-of-sorted-array", functionName: "sortedSquares", difficulty: "Easy", topic: "Two Pointers", pattern: "two pointer merge from ends", companies: ["Google","Amazon","Facebook"], description: "Given an integer array nums sorted in non-decreasing order, return an array of the squares of each number sorted in non-decreasing order.", examples: [{ input: "nums = [-4,-1,0,3,10]", output: "[0,1,9,16,100]" }, { input: "nums = [-7,-3,2,3,11]", output: "[4,9,9,49,121]" }], constraints: ["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4", "nums is sorted in non-decreasing order."], starterCode: { python: `class Solution:\n    def sortedSquares(self, nums):\n        pass`, javascript: `function sortedSquares(nums) {\n\n}`, typescript: `function sortedSquares(nums: number[]): number[] {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int[] sortedSquares(int[] nums) { return new int[]{}; }\n}`, cpp: `class Solution {\npublic:\n    vector<int> sortedSquares(vector<int>& nums) { return {}; }\n};`, c: `int* sortedSquares(int* nums, int numsSize, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}` }, testcases: [{ input: { nums: [-4,-1,0,3,10] }, expectedOutput: [0,1,9,16,100] }, { input: { nums: [-7,-3,2,3,11] }, expectedOutput: [4,9,9,49,121] }], hiddentestcases: [{ input: { nums: [-3,-1,0,1,3] }, expectedOutput: [0,1,1,9,9] }, { input: { nums: [1] }, expectedOutput: [1] }] },

  { id: 242, title: "Subarray Product Less Than K", slug: "subarray-product-less-than-k", functionName: "numSubarrayProductLessThanK", difficulty: "Medium", topic: "Sliding Window", pattern: "variable window with running product", companies: ["Amazon","Facebook","Google"], description: "Given an array of positive integers nums and an integer k, return the number of contiguous subarrays where the product of all the elements in the subarray is strictly less than k.", examples: [{ input: "nums = [10,5,2,6], k = 100", output: "8", explanation: "The 8 subarrays with product less than 100 are [10], [5], [2], [6], [10,5], [5,2], [2,6], [5,2,6]. Note that [10,5,2] is not included because its product is 100, which is not strictly less than 100." }, { input: "nums = [1,2,3], k = 0", output: "0", explanation: "No product of positive integers can be less than 0, so there are no valid subarrays." }, { input: "nums = [1], k = 2", output: "1", explanation: "The only subarray is [1], with product 1, which is less than 2." }], constraints: ["1 <= nums.length <= 3 * 10^4", "1 <= nums[i] <= 1000", "0 <= k <= 10^6"], starterCode: { python: `class Solution:\n    def numSubarrayProductLessThanK(self, nums, k):\n        pass`, javascript: `function numSubarrayProductLessThanK(nums, k) {\n\n}`, typescript: `function numSubarrayProductLessThanK(nums: number[], k: number): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int numSubarrayProductLessThanK(int[] nums, int k) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int numSubarrayProductLessThanK(vector<int>& nums, int k) { return 0; }\n};`, c: `int numSubarrayProductLessThanK(int* nums, int numsSize, int k) {\n    return 0;\n}` }, testcases: [{ input: { nums: [10,5,2,6], k: 100 }, expectedOutput: 8 }, { input: { nums: [1,2,3], k: 0 }, expectedOutput: 0 }, { input: { nums: [1], k: 2 }, expectedOutput: 1 }], hiddentestcases: [{ input: { nums: [1,1,1], k: 1 }, expectedOutput: 0 }, { input: { nums: [100], k: 100 }, expectedOutput: 0 }] },

  {
    id: 243,
    title: "Alien Dictionary",
    slug: "alien-dictionary",
    functionName: "alienOrder",
    difficulty: "Hard",
    topic: "Graphs",
    pattern: "topological sort on characters",
    sourceType: "core",
    companies: ["Facebook", "Google", "Airbnb", "Amazon"],
    description: "You are given a sorted list of words from an alien language. Derive the order of characters in the alien alphabet. Return a string of unique characters in the correct order. If invalid, return ''. If multiple orders possible, return any.",
    examples: [
      { input: 'words = ["wrt","wrf","er","ett","rftt"]', output: '"wertf"' },
      { input: 'words = ["z","x"]', output: '"zx"' },
      { input: 'words = ["z","x","z"]', output: '""' },
    ],
    constraints: ["1 <= words.length <= 100", "1 <= words[i].length <= 100", "words[i] consists of lowercase English letters."],
    starterCode: {
      python: `class Solution:\n    def alienOrder(self, words):\n        pass`,
      javascript: `function alienOrder(words) {\n\n}`,
      typescript: `function alienOrder(words: string[]): string {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public String alienOrder(String[] words) {\n        return "";\n    }\n}`,
      cpp: `class Solution {\npublic:\n    string alienOrder(vector<string>& words) {\n        return "";\n    }\n};`,
      c: `char* alienOrder(char** words, int wordsSize) {\n    return "";\n}`,
    },
    testcases: [
      { input: { words: ["wrt","wrf","er","ett","rftt"] }, expectedOutput: "wertf" },
      { input: { words: ["z","x"] }, expectedOutput: "zx" },
      { input: { words: ["z","x","z"] }, expectedOutput: "" },
    ],
    hiddentestcases: [
      { input: { words: ["z","z"] }, expectedOutput: "z" },
      { input: { words: ["a","b","c","d"] }, expectedOutput: "abcd" },
    ],
  },

  { id: 244, title: "Jump Game VII", slug: "jump-game-vii", functionName: "canReach", difficulty: "Medium", topic: "Graphs", pattern: "BFS with sliding window", companies: ["Amazon","Google"], description: "Given a string s of 0s and 1s, you start at index 0. You can jump from index i to i+j where minJump <= j <= maxJump, only if s[i+j] == '0'. Return true if you can reach index s.length-1. s[0] == '0' and s[s.length-1] == '0'.", examples: [{ input: 's = "011010", minJump = 2, maxJump = 3', output: "true" }, { input: 's = "01101110", minJump = 2, maxJump = 3', output: "false" }], constraints: ["2 <= s.length <= 10^5", "s[i] is '0' or '1'.", "s[0] == '0'", "1 <= minJump <= maxJump < s.length"], starterCode: { python: `class Solution:\n    def canReach(self, s, minJump, maxJump):\n        pass`, javascript: `function canReach(s, minJump, maxJump) {\n\n}`, typescript: `function canReach(s: string, minJump: number, maxJump: number): boolean {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public boolean canReach(String s, int minJump, int maxJump) { return false; }\n}`, cpp: `class Solution {\npublic:\n    bool canReach(string s, int minJump, int maxJump) { return false; }\n};`, c: `bool canReach(char* s, int minJump, int maxJump) {\n    return false;\n}` }, testcases: [{ input: { s: "011010", minJump: 2, maxJump: 3 }, expectedOutput: true }, { input: { s: "01101110", minJump: 2, maxJump: 3 }, expectedOutput: false }], hiddentestcases: [{ input: { s: "00", minJump: 1, maxJump: 1 }, expectedOutput: true }, { input: { s: "0000000000", minJump: 3, maxJump: 7 }, expectedOutput: true }] },

  {
    id: 245,
    title: "Walls and Gates",
    slug: "walls-and-gates",
    functionName: "wallsAndGates",
    difficulty: "Medium",
    topic: "Graphs",
    pattern: "multi-source BFS",
    sourceType: "core",
    companies: ["Facebook", "Google"],
    description: "You are given an m×n grid rooms initialized with -1 (wall), 0 (gate), or INF (empty room, value 2^31-1). Fill each empty room with the distance to its nearest gate. If impossible, leave as INF.",
    examples: [
      { input: "rooms = [[INF,-1,0,INF],[INF,INF,INF,-1],[INF,-1,INF,-1],[0,-1,INF,INF]]", output: "[[3,-1,0,1],[2,2,1,-1],[1,-1,2,-1],[0,-1,3,4]]" },
      { input: "rooms = [[-1]]", output: "[[-1]]" },
    ],
    constraints: ["m == rooms.length", "n == rooms[i].length", "1 <= m, n <= 250", "rooms[i][j] is -1, 0, or 2^31 - 1"],
    starterCode: {
      python: `class Solution:\n    def wallsAndGates(self, rooms):\n        pass`,
      javascript: `function wallsAndGates(rooms) {\n\n}`,
      typescript: `function wallsAndGates(rooms: number[][]): void {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public void wallsAndGates(int[][] rooms) {\n        \n    }\n}`,
      cpp: `class Solution {\npublic:\n    void wallsAndGates(vector<vector<int>>& rooms) {\n        \n    }\n};`,
    },
    testcases: [
      { input: { rooms: [[2147483647,-1,0,2147483647],[2147483647,2147483647,2147483647,-1],[2147483647,-1,2147483647,-1],[0,-1,2147483647,2147483647]] }, expectedOutput: [[3,-1,0,1],[2,2,1,-1],[1,-1,2,-1],[0,-1,3,4]] },
      { input: { rooms: [[-1]] }, expectedOutput: [[-1]] },
    ],
    hiddentestcases: [
      { input: { rooms: [[0,-1],[2147483647,2147483647]] }, expectedOutput: [[0,-1],[1,2]] },
    ],
  },

  {
    id: 246,
    title: "Swim in Rising Water",
    slug: "swim-in-rising-water",
    functionName: "swimInWater",
    difficulty: "Hard",
    topic: "Graphs",
    pattern: "Dijkstra minimax path",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "You are given an n×n integer matrix grid where grid[i][j] represents the elevation at that point. Rain falls; at time t, you can swim to adjacent cells where elevation <= t. Return the minimum time until you can reach grid[n-1][n-1] from grid[0][0].",
    examples: [
      { input: "grid = [[0,2],[1,3]]", output: "3" },
      { input: "grid = [[0,1,2,3,4],[24,23,22,21,5],[12,13,14,15,16],[11,17,18,19,20],[10,9,8,7,6]]", output: "16" },
    ],
    constraints: ["n == grid.length == grid[i].length", "1 <= n <= 50", "0 <= grid[i][j] < n^2", "Each value in grid is unique."],
    starterCode: {
      python: `class Solution:\n    def swimInWater(self, grid):\n        pass`,
      javascript: `function swimInWater(grid) {\n\n}`,
      typescript: `function swimInWater(grid: number[][]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int swimInWater(int[][] grid) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int swimInWater(vector<vector<int>>& grid) {\n        return 0;\n    }\n};`,
    },
    testcases: [
      { input: { grid: [[0,2],[1,3]] }, expectedOutput: 3 },
      { input: { grid: [[0,1,2,3,4],[24,23,22,21,5],[12,13,14,15,16],[11,17,18,19,20],[10,9,8,7,6]] }, expectedOutput: 16 },
    ],
    hiddentestcases: [
      { input: { grid: [[0]] }, expectedOutput: 0 },
      { input: { grid: [[3,2],[0,1]] }, expectedOutput: 3 },
    ],
  },

  {
    id: 247,
    title: "Find the Duplicate Number",
    slug: "find-the-duplicate-number",
    functionName: "findDuplicate",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "Floyd cycle detection",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Google"],
    description: "Given an array nums containing n+1 integers where each integer is in [1, n], prove that at least one duplicate must exist. Find and return the duplicate without modifying the array and using only O(1) extra space.",
    examples: [
      { input: "nums = [1,3,4,2,2]", output: "2" },
      { input: "nums = [3,1,3,4,2]", output: "3" },
      { input: "nums = [3,3,3,3,3]", output: "3" },
    ],
    constraints: ["1 <= n <= 10^5", "nums.length == n + 1", "1 <= nums[i] <= n", "All integers except one appear once."],
    starterCode: {
      python: `class Solution:\n    def findDuplicate(self, nums):\n        pass`,
      javascript: `function findDuplicate(nums) {\n\n}`,
      typescript: `function findDuplicate(nums: number[]): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int findDuplicate(int[] nums) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int findDuplicate(vector<int>& nums) {\n        return 0;\n    }\n};`,
      c: `int findDuplicate(int* nums, int numsSize) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [1,3,4,2,2] }, expectedOutput: 2 },
      { input: { nums: [3,1,3,4,2] }, expectedOutput: 3 },
      { input: { nums: [3,3,3,3,3] }, expectedOutput: 3 },
    ],
    hiddentestcases: [
      { input: { nums: [1,1] }, expectedOutput: 1 },
      { input: { nums: [2,2,2,2,2] }, expectedOutput: 2 },
    ],
  },

  {
    id: 248,
    title: "Minimum Interval to Include Each Query",
    slug: "minimum-interval-to-include-each-query",
    functionName: "minInterval",
    difficulty: "Hard",
    topic: "Heap",
    pattern: "offline queries + sorted sweep + min heap",
    sourceType: "core",
    companies: ["Google", "Amazon"],
    description: "You are given a 2D integer array intervals where intervals[i] = [li, ri] and a 1D integer array queries. For each query qi, find the size (ri - li + 1) of the smallest interval [li, ri] such that li <= qi <= ri. Return -1 if no such interval exists.",
    examples: [
      { input: "intervals = [[1,4],[2,4],[3,6],[4,4]], queries = [2,3,4,5]", output: "[3,3,1,4]" },
      { input: "intervals = [[2,3],[2,5],[1,8],[20,25]], queries = [2,19,5,22]", output: "[2,-1,4,6]" },
    ],
    constraints: ["1 <= intervals.length <= 10^5", "1 <= queries.length <= 10^5", "queries[i] and interval values are in [1, 10^7]"],
    starterCode: {
      python: `class Solution:\n    def minInterval(self, intervals, queries):\n        pass`,
      javascript: `function minInterval(intervals, queries) {\n\n}`,
      typescript: `function minInterval(intervals: number[][], queries: number[]): number[] {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int[] minInterval(int[][] intervals, int[] queries) {\n        return new int[]{};\n    }\n}`,
      cpp: `class Solution {\npublic:\n    vector<int> minInterval(vector<vector<int>>& intervals, vector<int>& queries) {\n        return {};\n    }\n};`,
    },
    testcases: [
      { input: { intervals: [[1,4],[2,4],[3,6],[4,4]], queries: [2,3,4,5] }, expectedOutput: [3,3,1,4] },
      { input: { intervals: [[2,3],[2,5],[1,8],[20,25]], queries: [2,19,5,22] }, expectedOutput: [2,-1,4,6] },
    ],
    hiddentestcases: [
      { input: { intervals: [[1,100]], queries: [50] }, expectedOutput: [100] },
    ],
  },

  { id: 249, title: "Number of Longest Increasing Subsequence", slug: "number-of-lis", functionName: "findNumberOfLIS", difficulty: "Medium", topic: "Dynamic Programming", pattern: "DP length + count arrays", companies: ["Facebook","Amazon"], description: "Given an integer array nums, return the number of longest increasing subsequences. Notice that the sequence has to be strictly increasing.", examples: [{ input: "nums = [1,3,5,4,7]", output: "2", explanation: "Two LIS: [1,3,5,7] and [1,3,4,7]" }, { input: "nums = [2,2,2,2,2]", output: "5" }], constraints: ["1 <= nums.length <= 2000", "-10^6 <= nums[i] <= 10^6"], starterCode: { python: `class Solution:\n    def findNumberOfLIS(self, nums):\n        pass`, javascript: `function findNumberOfLIS(nums) {\n\n}`, typescript: `function findNumberOfLIS(nums: number[]): number {\n    throw new Error("Not implemented");\n}`, java: `class Solution {\n    public int findNumberOfLIS(int[] nums) { return 0; }\n}`, cpp: `class Solution {\npublic:\n    int findNumberOfLIS(vector<int>& nums) { return 0; }\n};`, c: `int findNumberOfLIS(int* nums, int numsSize) {\n    return 0;\n}` }, testcases: [{ input: { nums: [1,3,5,4,7] }, expectedOutput: 2 }, { input: { nums: [2,2,2,2,2] }, expectedOutput: 5 }, { input: { nums: [1,2,4,3,5,4,7,2] }, expectedOutput: 3 }], hiddentestcases: [{ input: { nums: [1] }, expectedOutput: 1 }, { input: { nums: [1,2,3,1,2,3] }, expectedOutput: 4 }] },

  {
    id: 250,
    title: "3Sum Closest",
    slug: "3sum-closest",
    functionName: "threeSumClosest",
    difficulty: "Medium",
    topic: "Two Pointers",
    pattern: "sort + two pointer closest",
    sourceType: "core",
    companies: ["Amazon", "Facebook", "Bloomberg", "Microsoft"],
    description: "Given an integer array nums of length n and an integer target, find three integers in nums such that the sum is closest to target. Return the sum of the three integers. Exactly one answer exists.",
    examples: [
      { input: "nums = [-1,2,1,-4], target = 1", output: "2", explanation: "-1+2+1=2 is closest to 1." },
      { input: "nums = [0,0,0], target = 1", output: "0" },
    ],
    constraints: ["3 <= nums.length <= 500", "-1000 <= nums[i] <= 1000", "-10^4 <= target <= 10^4"],
    starterCode: {
      python: `class Solution:\n    def threeSumClosest(self, nums, target):\n        pass`,
      javascript: `function threeSumClosest(nums, target) {\n\n}`,
      typescript: `function threeSumClosest(nums: number[], target: number): number {\n    throw new Error("Not implemented");\n}`,
      java: `class Solution {\n    public int threeSumClosest(int[] nums, int target) {\n        return 0;\n    }\n}`,
      cpp: `class Solution {\npublic:\n    int threeSumClosest(vector<int>& nums, int target) {\n        return 0;\n    }\n};`,
      c: `int threeSumClosest(int* nums, int numsSize, int target) {\n    return 0;\n}`,
    },
    testcases: [
      { input: { nums: [-1,2,1,-4], target: 1 }, expectedOutput: 2 },
      { input: { nums: [0,0,0], target: 1 }, expectedOutput: 0 },
      { input: { nums: [1,1,1,0], target: -100 }, expectedOutput: 2 },
    ],
    hiddentestcases: [
      { input: { nums: [1,2,5,10,11], target: 12 }, expectedOutput: 13 },
      { input: { nums: [-1,2,1,-4], target: 0 }, expectedOutput: -1 },
    ],
  },


];

// Merge metadata into each problem.
// All fields have safe defaults so problems with missing metadata entries still work.
// pattern prefers the metadata value (allows override) but falls back to p.pattern from raw data.
const problems = rawProblems.map((p) => {
  const meta = problemMetadata[p.slug] ?? {};
  return {
    ...p,
    pattern:         meta.pattern         ?? p.pattern ?? "",
    estimatedTime:   meta.estimatedTime   ?? "",
    companies:       meta.companies       ?? [],
    relatedProblems: meta.relatedProblems ?? [],
    hints:           meta.hints           ?? [],
  };
});

export default problems;