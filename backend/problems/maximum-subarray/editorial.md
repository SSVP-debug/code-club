## Approach

Use Kadane's algorithm. At each position, decide whether the current subarray should continue or whether a new subarray should start at the current value.

Maintain two values:

- `currentSum`: the largest sum of a subarray that ends at the current position.
- `bestSum`: the largest subarray sum seen anywhere so far.

For each number `x`, update `currentSum` as `max(x, currentSum + x)`. If the previous running sum is negative, keeping it would only make the new subarray smaller, so starting fresh at `x` is better. Then update `bestSum = max(bestSum, currentSum)`.

Initialize both values from the first element rather than from zero. This is important when every number is negative; the answer must still be the largest single element.

## Complexity

- Time: **O(n)** because the array is scanned once.
- Space: **O(1)** because only two running sums are maintained.

## Example walkthrough

For `nums = [-2,1,-3,4,-1,2,1,-5,4]`:

1. Start with `-2` as both the current and best sum.
2. At `1`, starting a new subarray gives `1`, which is better than `-2 + 1`.
3. The running sum then grows through `-3, 4, -1, 2, 1` to `6`.
4. The subarray producing that sum is `[4,-1,2,1]`.
5. Later values do not produce a sum larger than `6`, so the answer is `6`.

The key idea is that a negative prefix can never help a future subarray, so Kadane's algorithm discards it as soon as continuing it becomes worse than restarting.