## Approach

The array is sorted, so we can discard half of the remaining search range after every comparison.

Maintain two pointers, `left` and `right`, covering the current candidate range. Choose `mid` between them and compare `nums[mid]` with `target`:

- If they are equal, return `mid`.
- If `nums[mid]` is smaller, every index at or left of `mid` is too small, so set `left = mid + 1`.
- If `nums[mid]` is larger, every index at or right of `mid` is too large, so set `right = mid - 1`.

Continue while `left <= right`. If the range becomes empty, the target is not present and we return `-1`.

## Complexity

- Time: **O(log n)** because the search interval is roughly halved on every iteration.
- Space: **O(1)** because only a few pointers are maintained.

## Example walkthrough

For `nums = [-1,0,3,5,9,12]` and `target = 9`:

1. Search the full range. The midpoint is `3`; `3 < 9`, so discard the left half.
2. The remaining range is `[5,9,12]`. The midpoint is `9`, which matches the target.
3. Return index `4`.

The sorted-order guarantee is what makes the halving step valid.