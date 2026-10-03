# Editorial

## Approach: Hash Set

We need to determine whether any value appears more than once. A hash set is a natural fit because it stores each value only once and lets us check whether a value has already been seen.

Scan the array from left to right. For each number:

1. If the number is already in the set, we have found a duplicate and can immediately return `true`.
2. Otherwise, add the number to the set and continue.

If the entire array is processed without finding an existing value in the set, every element is distinct, so return `false`.

## Walkthrough

For `nums = [1,2,3,1]`:

1. See `1` → set becomes `{1}`.
2. See `2` → set becomes `{1,2}`.
3. See `3` → set becomes `{1,2,3}`.
4. See `1` again → `1` is already in the set, so return `true`.

For `nums = [1,2,3,4]`, every value is new when encountered, so the scan finishes and returns `false`.

## Why This Works

Before processing each element, the set contains exactly the distinct values encountered earlier in the array. Therefore, if the current value is already in the set, it must have appeared at an earlier index, proving that a duplicate exists.

If no value is found in the set during the complete scan, no element appeared twice, so the array contains only distinct values.

## Complexity

- **Time:** `O(n)` expected, because each value is checked and inserted once on average.
- **Auxiliary space:** `O(n)` in the worst case when all values are distinct.

## Alternative: Sorting

Sorting the array first would place equal values next to each other, after which adjacent elements can be compared. That approach uses `O(n log n)` time and may modify the input, so the hash-set approach is preferable when linear expected time and extra memory are acceptable.

## Common Mistakes

- Comparing every pair of elements, which takes `O(n²)` time.
- Sorting the input when the solution is expected to preserve the original array.
- Returning `false` immediately after seeing a new value instead of checking the complete array.
- Forgetting that a duplicate can appear anywhere, including at the beginning or end of the array.
