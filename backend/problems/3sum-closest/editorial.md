# Editorial

## Approach: Sort + Two Pointers

The goal is to choose three numbers whose sum is closest to `target`. Sorting lets us move two pointers in a predictable direction after fixing the first number.

Sort `nums`, then fix `nums[i]` as the first value of the triplet. Set `left = i + 1` and `right = n - 1`. For each pair:

1. Compute `current = nums[i] + nums[left] + nums[right]`.
2. If `current` is closer to `target` than the best sum seen so far, update the answer.
3. If `current < target`, move `left` rightward to increase the sum.
4. If `current > target`, move `right` leftward to decrease the sum.
5. If `current == target`, the exact target has been found, so return it immediately.

Because the array is sorted, moving `left` increases the pair sum while moving `right` decreases it. This avoids checking every possible triplet.

## Walkthrough

For `nums = [-1,2,1,-4]` and `target = 1`, sort the array to `[-4,-1,1,2]`.

Fix `-4`. With `left = -1` and `right = 2`, the sum is `-3`, which is far from `1`. Moving `left` increases the sum. Eventually, the triplet `[-1,1,2]` gives `2`, whose distance from the target is `1`.

No other triplet is closer, so the answer is `2`.

## Why This Works

For each fixed first element, the two pointers examine the remaining sorted values while maintaining the direction needed to approach the target. Every examined triplet is considered as a candidate, and whenever the current sum is closer, it becomes the best answer.

If the current sum is below the target, every value at or left of `left` is no larger than `nums[left]`, so keeping `right` fixed while moving `left` is the only useful direction for increasing the sum. The symmetric argument holds when the sum is above the target. Therefore the two-pointer scan does not skip a better candidate that could be reached by moving in the opposite direction.

## Complexity

- **Time:** `O(n²)` after `O(n log n)` sorting.
- **Auxiliary space:** `O(1)` beyond the sorting implementation, ignoring the input array's sort-space requirements.

## Common Mistakes

- Using three nested loops, which takes `O(n³)` time.
- Moving the wrong pointer: a sum below the target needs a larger value, so move `left` rightward.
- Returning the first sum encountered instead of tracking the closest one.
- Forgetting that an exact target is optimal and can be returned immediately.
