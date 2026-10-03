# Editorial

## Approach: Sort + Two Pointers

We need to count the unique triplets whose values sum to zero. A direct three-loop solution would take `O(n³)` time, which is too slow for `n` up to 3000.

First, sort the array. Then fix one value at index `i` and search for two values after it whose sum is `-nums[i]`. Because the remaining values are sorted, two pointers can find this pair in one linear scan:

1. Set `left = i + 1` and `right = n - 1`.
2. Compute `sum = nums[i] + nums[left] + nums[right]`.
3. If `sum` is zero, one unique triplet has been found. Increment the count and move both pointers.
4. If `sum` is too small, move `left` right to increase the sum.
5. If `sum` is too large, move `right` left to decrease the sum.
6. Skip equal values when choosing the fixed element and after finding a matching pair so the same triplet is not counted more than once.

## Walkthrough

For `nums = [-1,0,1,2,-1,-4]`, sorting gives:

`[-4,-1,-1,0,1,2]`

Take `-4` as the fixed value. The two-pointer search cannot produce a pair that sums to `4`.

Next, take `-1`. The two-pointer scan eventually finds `[-1,0,1]` and `[-1,-1,2]`. The repeated `-1` fixed value is then skipped, so those same values are not counted again.

The final count is `2`.

For `[0,0,0]`, sorting changes nothing. The first fixed `0` finds `0 + 0 + 0 = 0`, so the count becomes `1`. Duplicate skipping prevents the same triplet from being counted again.

## Why This Works

After sorting, increasing `left` cannot decrease the triplet sum, and decreasing `right` cannot increase it. Therefore:

- If the sum is below zero, moving `left` right is the useful direction to increase the sum.
- If the sum is above zero, moving `right` left is the useful direction to decrease the sum.
- If the sum is zero, the current three values form a valid triplet.

Duplicate skipping ensures equal choices are not counted repeatedly. Since every possible fixed value is considered and the two-pointer scan checks the relevant pairs for that fixed value, every unique zero-sum triplet is counted exactly once.

## Complexity

- **Time:** `O(n²)` after sorting, with `O(n log n)` for the sort.
- **Auxiliary space:** `O(1)` beyond the sorting implementation's working space, excluding result storage.

## Common Mistakes

- Using three nested loops and getting `O(n³)` time.
- Forgetting to sort before using the two-pointer technique.
- Not skipping duplicate fixed values, which counts the same triplet multiple times.
- Not skipping duplicates after finding a valid triplet.
- Moving only one pointer after a matching pair instead of advancing both.
- Assuming the task returns the triplets themselves; this Code Club problem asks for their **count**.