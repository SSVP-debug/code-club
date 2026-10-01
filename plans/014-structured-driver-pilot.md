# 014 — Structured driver pilot: linked lists

## Goal

Close the first genuinely cross-language execution gap identified by Plan 013: `ListNode` inputs/returns are currently not executable in Java, C++, or C.

This plan starts with a small pilot before touching the full 17-problem set.

## Pilot scope

- `palindrome-linked-list` — `ListNode*` input, scalar boolean return.
- Prove the same testcase representation (`[1,2,2,1]`) can be converted into a real linked list in Java, C++, and C.
- Prove scalar results still use the existing exact-match grading path.
- Add a C starter only after the shared driver path exists; do not add placeholder C files merely to satisfy the starter validator.

## Architecture

The structured-driver layer sits above the normal scalar/array language drivers. A problem opts into it through explicit `paramTypes` / `returnType` contracts (`ListNode` / `ListNode*`). Existing language drivers remain unchanged for ordinary problems.

```text
Problem metadata
  ↓
paramTypes / returnType identify ListNode
  ↓
structured driver dispatcher
  ├─ Java: ListNode class + buildList()
  ├─ C++: ListNode struct + buildList()
  └─ C: struct ListNode + buildList()
  ↓
student Solution code
  ↓
serialize scalar / ListNode result
  ↓
existing judge comparison
```

## Explicit non-goals for this pilot

- TreeNode support.
- `vector<ListNode*>` / lists-of-lists such as `merge-k-sorted-lists`.
- Graph node support.
- Operation-sequence/design problems.
- Making C a required starter language.
- Enabling any previously skipped problem without an execution-contract check.

## Exit criteria

1. Pilot metadata explicitly declares the structural contract.
2. Java, C++, and C generated programs contain real node construction and correct call wiring.
3. Returned/printed scalar output remains JSON-compatible.
4. C starter is a real implementation contract, not a placeholder.
5. Dedicated unit tests cover all three generated programs and empty/single-node list construction.
6. CI validates the new generation path before the next structured-problem batch.

Only after this pilot is green should Plan 014 add TreeNode support and then expand the linked-list batch.