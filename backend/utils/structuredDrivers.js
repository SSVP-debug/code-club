/**
 * structuredDrivers.js
 *
 * Plan 014 pilot: execution support for problems whose contract explicitly
 * uses ListNode/ListNode*. The normal scalar/array drivers remain untouched;
 * this layer is selected only when paramTypes/returnType declares a
 * linked-list structure.
 *
 * Testcase representation is deliberately unchanged: a linked list is a
 * plain JS array such as [1, 2, 2, 1]. The generated program constructs the
 * real language-native nodes before calling the student's Solution code.
 */

function hasListContract(paramTypes, returnType) {
  const values = Object.values(paramTypes || {});
  return values.some((type) => /ListNode/.test(type)) || /ListNode/.test(returnType || "");
}

function jsArrayLiteral(values) {
  return `{${values.map((v) => String(Number(v))).join(", ")}}`;
}

function javaListHelper() {
  return `
class ListNode {
  int val;
  ListNode next;
  ListNode(int val) { this.val = val; }
}

ListNode buildList(int[] values) {
  ListNode dummy = new ListNode(0);
  ListNode tail = dummy;
  for (int value : values) {
    tail.next = new ListNode(value);
    tail = tail.next;
  }
  return dummy.next;
}

String listToJson(ListNode head) {
  StringBuilder out = new StringBuilder("[");
  boolean first = true;
  while (head != null) {
    if (!first) out.append(',');
    out.append(head.val);
    first = false;
    head = head.next;
  }
  out.append(']');
  return out.toString();
}
`;
}

function cppListHelper() {
  return `
struct ListNode {
  int val;
  ListNode* next;
  ListNode(int x) : val(x), next(nullptr) {}
};

ListNode* buildList(const vector<int>& values) {
  ListNode dummy(0);
  ListNode* tail = &dummy;
  for (int value : values) {
    tail->next = new ListNode(value);
    tail = tail->next;
  }
  return dummy.next;
}

void printListJson(ListNode* head) {
  cout << "[";
  bool first = true;
  while (head != nullptr) {
    if (!first) cout << ",";
    cout << head->val;
    first = false;
    head = head->next;
  }
  cout << "]";
}
`;
}

function cListHelper() {
  return `
struct ListNode {
  int val;
  struct ListNode* next;
};

struct ListNode* buildList(const int* values, int size) {
  struct ListNode* head = NULL;
  struct ListNode* tail = NULL;
  for (int i = 0; i < size; i++) {
    struct ListNode* node = malloc(sizeof(struct ListNode));
    node->val = values[i];
    node->next = NULL;
    if (head == NULL) head = node;
    else tail->next = node;
    tail = node;
  }
  return head;
}

void printListJson(struct ListNode* head) {
  printf("[");
  int first = 1;
  while (head != NULL) {
    if (!first) printf(",");
    printf("%d", head->val);
    first = 0;
    head = head->next;
  }
  printf("]");
}
`;
}

function javaArgDeclaration(key, values) {
  return `int[] ${key}Values = new int[] ${jsArrayLiteral(values)};\n      ListNode ${key} = buildList(${key}Values);`;
}

function cppArgDeclaration(key, values) {
  return `vector<int> ${key}Values = {${values.join(", ")}};\n    ListNode* ${key} = buildList(${key}Values);`;
}

function cArgDeclaration(key, values) {
  if (values.length === 0) {
    return `int* ${key}Values = NULL;\n  int ${key}Size = 0;\n  struct ListNode* ${key} = buildList(${key}Values, ${key}Size);`;
  }
  return `int ${key}Values[] = ${jsArrayLiteral(values)};\n  int ${key}Size = ${values.length};\n  struct ListNode* ${key} = buildList(${key}Values, ${key}Size);`;
}

function isListType(type) {
  return /ListNode/.test(type || "");
}

function listArgs(args, paramTypes) {
  return args.filter(({ key }) => isListType(paramTypes[key]));
}

export function supports({ returnType, paramTypes }) {
  return hasListContract(paramTypes, returnType);
}

export function generate({ language, userCode, fn, returnType, args, paramTypes }) {
  if (!supports({ returnType, paramTypes })) return null;

  const lists = listArgs(args, paramTypes);
  if (lists.length === 0 && !isListType(returnType)) {
    throw new Error("structured list driver: a ListNode contract must identify at least one list argument or list return");
  }

  if (language === "java") {
    const declarations = lists.map(({ key, value }) => javaArgDeclaration(key, value)).join("\n      ");
    const callArgs = args.map(({ key }) => key).join(", ");
    const listReturn = returnType === "ListNode";
    const voidReturn = returnType === "void";
    if (!listReturn && !voidReturn && returnType !== "boolean" && returnType !== "bool") {
      throw new Error(`structured list driver: unsupported Java return type ${returnType}`);
    }
    const resultLine = listReturn
      ? `ListNode result = solution.${fn}(${callArgs});\n      System.out.println(listToJson(result));`
      : voidReturn
      ? `solution.${fn}(${callArgs});\n      System.out.println(listToJson(${lists[0]?.key}));`
      : `boolean result = solution.${fn}(${callArgs});\n      System.out.println(result ? "true" : "false");`;
    return `
import java.util.*;

${javaListHelper()}

${userCode}

class Main {
  public static void main(String[] args) {
    try {
      ${declarations}
      Solution solution = new Solution();
      ${resultLine}
    } catch (Exception e) {
      System.out.println("RUNTIME_ERROR:" + e.getMessage());
    }
  }
}
`;
  }

  if (language === "cpp") {
    const declarations = lists.map(({ key, value }) => cppArgDeclaration(key, value)).join("\n    ");
    const callArgs = args.map(({ key }) => key).join(", ");
    const listReturn = returnType === "ListNode*";
    const voidReturn = returnType === "void";
    if (!listReturn && !voidReturn && returnType !== "bool") {
      throw new Error(`structured list driver: unsupported C++ return type ${returnType}`);
    }
    const resultLine = listReturn
      ? `ListNode* result = solution.${fn}(${callArgs});\n    printListJson(result);\n    cout << endl;`
      : voidReturn
      ? `solution.${fn}(${callArgs});\n    printListJson(${lists[0]?.key});\n    cout << endl;`
      : `bool result = solution.${fn}(${callArgs});\n    cout << (result ? "true" : "false") << endl;`;
    return `
#include <bits/stdc++.h>
using namespace std;
${cppListHelper()}
${userCode}

int main() {
  try {
    ${declarations}
    Solution solution;
    ${resultLine}
  } catch (exception& e) {
    cout << "RUNTIME_ERROR:" << e.what();
  }
  return 0;
}
`;
  }

  if (language === "c") {
    const declarations = lists.map(({ key, value }) => cArgDeclaration(key, value)).join("\n  ");
    const callArgs = args.map(({ key }) => key).join(", ");
    const listReturn = returnType === "ListNode*";
    const voidReturn = returnType === "void";
    if (!listReturn && !voidReturn && returnType !== "bool") {
      throw new Error(`structured list driver: unsupported C return type ${returnType}`);
    }
    const resultLine = listReturn
      ? `struct ListNode* result = ${fn}(${callArgs});\n  printListJson(result);\n  printf("\\n");`
      : voidReturn
      ? `${fn}(${callArgs});\n  printListJson(${lists[0]?.key});\n  printf("\\n");`
      : `bool result = ${fn}(${callArgs});\n  printf(result ? "true\\n" : "false\\n");`;
    return `
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

${cListHelper()}

${userCode}

int main(void) {
  ${declarations}
  ${resultLine}
  return 0;
}
`;
  }

  throw new Error(`structured list driver: unsupported language ${language}`);
}
