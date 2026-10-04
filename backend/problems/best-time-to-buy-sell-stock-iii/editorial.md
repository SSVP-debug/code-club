# Editorial

## Approach: Four Transaction States

At most two transactions means we can model four states while scanning the prices:

- `buy1`: best profit after buying the first stock.
- `sell1`: best profit after selling the first stock.
- `buy2`: best profit after buying the second stock using the profit from the first transaction.
- `sell2`: best profit after selling the second stock.

For each price `p`, update:

- `buy1 = max(buy1, -p)`
- `sell1 = max(sell1, buy1 + p)`
- `buy2 = max(buy2, sell1 - p)`
- `sell2 = max(sell2, buy2 + p)`

Initialize the buy states as very small values or use the equivalent negative-price initialization. The final answer is `sell2` (and naturally includes cases where fewer than two transactions are useful).

## Why This Works

Each state represents the best achievable profit after a specific stage of the transaction sequence. A new price can either leave a state unchanged or improve it by performing that state's action today.

Because the second purchase is allowed only after the first sale, `buy2` depends on `sell1`. Likewise, `sell2` depends on `buy2`. Therefore the four states enforce the required transaction order while keeping only the best result for each stage.

## Complexity

- **Time:** `O(n)`.
- **Auxiliary space:** `O(1)`.

## Common Mistakes

- Allowing the second purchase before the first sale.
- Resetting state values for each day instead of carrying the best result forward.
- Assuming exactly two transactions are required; the problem allows zero, one, or two.
