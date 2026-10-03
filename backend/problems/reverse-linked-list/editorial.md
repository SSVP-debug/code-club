# Reverse Linked List

## Approach

The list is represented by an array, but the intended solution models the usual singly linked-list pointer reversal. The key idea is to reverse one link at a time while keeping the rest of the list reachable.

Maintain three references:

- `prev` — the part of the list that has already been reversed.
- `curr` — the node currently being processed.
- `next` — the original next node, saved before changing `curr`'s direction.

For each node:

1. Save `curr.next` in `next`.
2. Point `curr.next` to `prev`, reversing that link.
3. Move `prev` to `curr`.
4. Move `curr` to `next`.

When `curr` becomes `null`, `prev` is the new head of the reversed list. For the array representation used by Code Club, this corresponds to returning the elements in reverse order.

## Walkthrough

For `[1,2,3,4,5]`, the reversal progresses conceptually as:

```text
1 -> 2 -> 3 -> 4 -> 5

1 <- 2    3 -> 4 -> 5

1 <- 2 <- 3    4 -> 5

1 <- 2 <- 3 <- 4    5

1 <- 2 <- 3 <- 4 <- 5
```

The final order is `[5,4,3,2,1]`. For `[1,2]`, it becomes `[2,1]`; an empty list remains empty.

## Why This Works

At every iteration, `prev` represents the already-reversed prefix and `curr` represents the first node that has not yet been processed. Saving `next` before changing the link prevents the unprocessed portion of the list from being lost. Advancing `prev` and `curr` maintains this invariant until every link has been reversed.

## Complexity

- **Time:** `O(n)`, because each node is processed once.
- **Extra space:** `O(1)` for the pointer-reversal algorithm.

The array representation may require `O(n)` space if a new reversed array is constructed, but the underlying linked-list reversal itself uses constant auxiliary space.
