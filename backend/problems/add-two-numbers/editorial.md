# Add Two Numbers

## Approach

Each linked list stores a number in reverse order, so the first node contains the units digit, the next node contains the tens digit, and so on. That ordering lets us perform the addition from left to right through the lists while still processing the least significant digit first.

Keep three pieces of state:

- `carry`: the carry produced by the previous digit addition.
- `l1` and `l2`: the current nodes in the two input lists.
- `tail`: the last node in the result list.

At each step, add the current digits and the carry:

```text
sum = digit1 + digit2 + carry
```

The result digit is `sum % 10`, and the new carry is `sum // 10`.

Continue while either list still has nodes or a carry remains. If one list is shorter, treat its missing digits as `0`. After both lists are exhausted, a final carry may create one additional node.

## Walkthrough

For `l1 = [2,4,3]` and `l2 = [5,6,4]`, the lists represent `342` and `465` because the digits are reversed.

| Step | Digit from `l1` | Digit from `l2` | Carry in | Sum | Result digit | Carry out |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 5 | 0 | 7 | 7 | 0 |
| 2 | 4 | 6 | 0 | 10 | 0 | 1 |
| 3 | 3 | 4 | 1 | 8 | 8 | 0 |

The result list is `[7,0,8]`, which represents `807`.

A useful edge case is when the final addition leaves a carry. For example, adding `9` and `1` produces a result digit of `0` and a final carry of `1`, so the result becomes `[0,1]`.

## Why This Works

At every position, `sum` contains exactly the two digits at that position plus the carry from the previous position. Taking `sum % 10` stores the correct digit for the current position, while `sum // 10` passes the remaining value to the next position.

Because the input lists are stored from least significant digit to most significant digit, processing the lists in their given order is exactly the same order required for ordinary column addition. Therefore every result digit and the final carry are produced correctly.

## Complexity

Let `n` and `m` be the lengths of the two lists.

- **Time:** `O(n + m)` because each node is processed once.
- **Auxiliary space:** `O(1)` excluding the result list.
- **Output space:** `O(max(n, m) + 1)` for the result list, where the extra node is needed only when a final carry remains.

## Common Mistakes

- Forgetting to include `carry` when adding the next pair of digits.
- Stopping as soon as one input list ends instead of continuing with the remaining list.
- Forgetting that a final non-zero carry needs its own result node.
- Treating the list order as a normal left-to-right number. `[2,4,3]` represents `342`, not `243`.
