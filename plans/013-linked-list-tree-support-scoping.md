# 013 — ListNode / TreeNode driver support scoping

## Why this exists

Found while onboarding C (Plan 012), but **not a C-specific gap**:
neither `languageDrivers/java.js` nor `languageDrivers/cpp.js` has any
struct/object-construction or serialization logic for `ListNode*` or
`TreeNode*` either. Every problem below is currently unimplementable for
actual submission in **any** language this platform supports, not just
C. This is real, cross-cutting driver work — deliberately **not**
attempted as part of Plan 012's C-onboarding batches, and not something
one more C batch should absorb.

## Affected problems (17, all currently non-functional in every language)

`reorder-list`, `palindrome-linked-list`,
`binary-tree-level-order-traversal`, `lowest-common-ancestor-of-bst`,
`construct-binary-tree-from-preorder-inorder`,
`serialize-deserialize-binary-tree`, `binary-tree-right-side-view`,
`clone-graph`, `merge-k-sorted-lists`, `binary-search-tree-iterator`,
`add-two-numbers`, `reverse-nodes-in-k-group`,
`kth-smallest-element-in-bst`, `path-sum-ii`,
`maximum-width-of-binary-tree`, `linked-list-cycle`,
`intersection-of-two-linked-lists`.

(The last two were mis-labeled "param count mismatch" in earlier
batches' skip reasons — re-checked directly against their real cpp
signatures while writing this doc: both take `ListNode*` params
(`hasCycle(ListNode *head)`,
`getIntersectionNode(ListNode *headA, ListNode *headB)`), same root
cause as everything else on this list, not a separate issue.)

(`binary-search-tree-iterator` is additionally mis-tagged — it has real
constructor/method/testcase structure identical in shape to the 17
`operationSequence` design problems, but isn't flagged
`operationSequence.enabled: true`. Worth fixing that tag regardless of
when/whether this plan gets picked up.)

## What real support requires

For each of Java, C++, and C:

1. **A `ListNode`/`TreeNode` type the driver can construct from the JS
   testcase representation.** Testcases represent a linked list as a
   flat JS array (`[1,2,3]`) and a tree as a level-order array with
   `null` gaps (LeetCode's standard tree-serialization convention) — the
   driver needs a `buildLinkedList(array)` / `buildTree(array)` helper
   per language that allocates real nodes and wires `next`/`left`/
   `right` pointers.
2. **A serializer for the return side** — a function returning
   `ListNode*`/`TreeNode*` needs its result walked back into the same
   flat/level-order array shape testcases already use, so
   `judgeController.js`'s existing `JSON.parse`+exact-match comparison
   keeps working unchanged.
3. **Memory ownership story for C specifically** — Java/C++ have GC/RAII;
   C needs the driver-generated `main()` to `malloc` every node itself
   (mirroring how array arguments are already declared) and either
   `free` them or accept the leak for a single short-lived Judge0
   process (every other driver already accepts this same simplification
   for arrays — precedent exists, worth confirming explicitly rather
   than assuming).
4. **Decide the struct convention for C specifically** — real LeetC
   uses:
   ```c
   struct ListNode { int val; struct ListNode *next; };
   struct TreeNode { int val; struct TreeNode *left; struct TreeNode *right; };
   ```
   These need to be injected into the generated program (likely
   prepended the same way `commonIncludes` already is), with student
   starter code referencing them by the same names LeetCode itself uses
   so it reads as familiar, not platform-specific.

## Why this wasn't attempted in Plan 012

- **Genuinely cross-cutting.** Fixing this only for C would leave
  Java/C++ still broken for the same 15 problems — inconsistent with
  every other Plan 012 finding (the void-mutation bug, the 2D-array
  convention) being fixed for all three languages together once found.
- **Different category of work.** Everything Plan 012 built is either
  content (starter code) or driver capability within the existing
  scalar/array/string type universe. This needs a genuinely new type
  category (recursive pointer structures) — bigger surface area, more
  ways to get memory ownership or serialization subtly wrong, and no
  existing pattern in any of the three languages to extend rather than
  invent from scratch.
- **Deserves dedicated review**, not a rider on an already-large
  C-onboarding session. Per the project's own convention (scope new
  features explicitly, get sign-off before implementing), this is
  flagged and scoped, not built.

## Suggested next step (not started)

A dedicated plan (014, once this one's approved) covering: the exact
`buildLinkedList`/`buildTree`/serializer function signatures for all
three languages, a decision on the C memory-ownership question above,
and a small pilot batch (2-3 problems, one linked-list one tree) before
attempting the full 15 — same "prove it end-to-end before scaling"
discipline every Plan 012 batch used.
