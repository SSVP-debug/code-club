# Editorial

## Approach: Track the Minimum Price

We need to choose one day to buy and a later day to sell. If we scan the prices from left to right, then at each day the best buy price seen so far is the minimum price among all earlier days.

For the current price, the profit from selling today is:

`current price - minimum price seen so far`

Keep two values while scanning:

- `minPrice`: the lowest price seen so far.
- `maxProfit`: the largest profit found so far.

For each price, first update `minPrice` when a cheaper buying opportunity appears. Then calculate the profit obtained by selling at the current price and update `maxProfit`.

Because `minPrice` only comes from an earlier or current position, the buy day is always before the sell day.

## Walkthrough

For `prices = [7,1,5,3,6,4]`:

1. Start with `minPrice = 7` and `maxProfit = 0`.
2. Price `1` becomes the new minimum buying price.
3. At price `5`, selling gives `5 - 1 = 4`, so `maxProfit = 4`.
4. At price `3`, the profit is `3 - 1 = 2`, so the maximum stays `4`.
5. At price `6`, the profit is `6 - 1 = 5`, so `maxProfit = 5`.
6. Price `4` gives profit `3`, so the answer remains `5`.

For `[7,6,4,3,1]`, every later price is lower than the best earlier buying price, so no positive profit is possible and the answer is `0`.

## Why This Works

When considering a sale on the current day, the only information needed about previous days is their lowest price. Buying at any higher earlier price would produce no more profit than buying at the minimum price.

Therefore, checking the current price against the minimum price seen so far considers the best possible transaction ending on that day. Taking the largest such profit over the complete scan gives the overall maximum profit.

## Complexity

- **Time:** `O(n)` because the prices are scanned once.
- **Auxiliary space:** `O(1)` because only the minimum price and maximum profit are stored.

## Common Mistakes

- Allowing the buy day to occur after the sell day. The left-to-right scan prevents this.
- Sorting the prices. Sorting destroys the original day order, which is essential to the problem.
- Trying every pair of days. That works but takes `O(n²)` time and is unnecessary.
- Returning a negative profit when prices only decrease. The required result is `0` when no profitable transaction exists.
