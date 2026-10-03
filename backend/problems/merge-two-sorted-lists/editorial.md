# Editorial

## Approach: Two Pointers

Because both input lists are already sorted, we can merge them in one pass without sorting the values again.

Keep one pointer for each list. At every step, compare the values at the two pointers and take the smaller value for the result. Advance the pointer from the list that supplied that value.

When one list is exhausted, append the remaining values from the other list. Those values are already sorted, so no additional work is needed.

This is the same merge step used inside merge sort.

## Walkthrough

For `list1 = [1,2,4]` and `list2 = [1,3,4]`:

1. Compare `1` and `1` → take the first `1`.
2. Compare `2` and `1` → take the second `1`.
3. Compare `2` and `3` → take `2`.
4. Compare `4` and `3` → take `3`.
5. Compare `4` and `4` → take `4`.
6. The second list still contains its final `4`, so append it.

The merged result is `[1,1,2,3,4,4]`.

## Correctness

At every step, the smallest value that can appear next in the merged sorted list is the smaller value currently pointed to in the two lists. Selecting that value preserves sorted order. Once one list is exhausted, every remaining value in the other list is at least as large as the values already selected, so appending the remainder is correct.

## Complexity

If the two lists contain `m` and `n` nodes:

- **Time:** `O(m + n)` because each node is processed once.
- **Extra space:** `O(m + n)` when the returned merged array is counted; the two-pointer traversal itself uses `O(1)` auxiliary pointer space.

## Edge Cases

- Both lists are empty → return `[]`.
- One list is empty → return the other list unchanged.
- Values can be equal → either equal value may be selected first.
- Negative values are handled naturally because the comparison is value-based.