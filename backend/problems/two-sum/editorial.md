## Approach

For each number `x`, we need another number equal to `target - x`. A hash map lets us check whether that complement has already appeared in constant expected time.

Scan the array from left to right. Before storing the current value, check whether its complement is already in the map. If it is, return the stored index and the current index. Otherwise store the current value with its index.

Because the statement guarantees exactly one solution, the first matching pair is the required answer.

## Complexity

- Time: **O(n)** expected, because each value is inserted and looked up once in the hash map.
- Space: **O(n)** for the map in the worst case.

## Example walkthrough

For `nums = [2,7,11,15]` and `target = 9`:

1. See `2`; its complement is `7`. Store `2 -> 0`.
2. See `7`; its complement is `2`. The map contains `2` at index `0`.
3. Return `[0,1]`.

The important detail is to check the complement **before** inserting the current element, so the same array position is never used twice.