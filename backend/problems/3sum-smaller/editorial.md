# Editorial

## Approach: Sort + Two Pointers

We need to count index triplets whose values sum to less than `target`. Sorting turns the condition into something we can count in bulk instead of checking every triplet individually.

Sort `nums`. Fix the first element at index `i`, then use `left = i + 1` and `right = n - 1` for the other two elements.

For each pair:

1. Compute `sum = nums[i] + nums[left] + nums[right]`.
2. If `sum < target`, then every index from `left + 1` through `right` also forms a valid triplet with `i` and `left`, because the array is sorted. Add `right - left` to the answer, then increment `left`.
3. Otherwise the sum is too large, so decrement `right` to make the sum smaller.

The key optimization is the bulk count in step 2. One pointer position represents many valid triplets at once.

## Walkthrough

For `nums = [-2,0,1,3]` and `target = 2`, the sorted array is already `[-2,0,1,3]`.

Fix `-2`:

- `left = 0`, `right = 3` gives `-2 + 0 + 3 = 1`, which is less than `2`. Therefore both `[-2,0,1]` and `[-2,0,3]` are valid. Add `3 - 1 = 2` to the count.
- The remaining pointer movements do not produce additional valid triplets.

The final count is `2`.

## Why This Works

When `nums[i] + nums[left] + nums[right] < target`, every value between `left + 1` and `right` is at most `nums[right]`. Replacing `nums[right]` with any of those values cannot increase the sum, so all `right - left` choices are valid.

When the sum is not smaller than the target, the current pair is invalid. Decreasing `right` is the correct way to reduce the sum because the array is sorted. Repeating this process counts every valid triplet exactly once for its fixed first and second indices.

## Complexity

- **Time:** `O(n²)` after `O(n log n)` sorting.
- **Auxiliary space:** `O(1)` beyond the sorting implementation, ignoring the input array's sort-space requirements.

## Common Mistakes

- Adding only `1` when a valid `sum < target` is found instead of counting all `right - left` choices.
- Forgetting to sort before using the two-pointer counting argument.
- Using `<= target` when the requirement is strictly less than `target`.
- Using three nested loops, which takes `O(n³)` time.
