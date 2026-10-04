# Editorial

## Approach: Union-Find on Emails

Two accounts belong to the same person when they share an email address, directly or through a chain of other accounts. The important detail is that the account names alone are not enough to identify a person; shared emails create the connections.

Treat each email as a node in a graph. For every account, connect its first email to every other email in that account using a Disjoint Set Union (DSU), also called Union-Find.

After all accounts are processed:

1. Find the representative parent of every email.
2. Group emails by that representative.
3. Sort the emails inside each group.
4. Prepend the account name and return the merged accounts.

A map from email to name lets us recover the person's name when constructing the result.

## Walkthrough

Consider the canonical example:

- Account 1: `John`, `johnsmith@mail.com`, `john_newyork@mail.com`
- Account 2: `John`, `johnsmith@mail.com`, `john00@mail.com`
- Account 3: `Mary`, `mary@mail.com`
- Account 4: `John`, `johnnybravo@mail.com`

The first two accounts share `johnsmith@mail.com`, so Union-Find places all three John emails from those accounts into one connected component. Mary's email and John's `johnnybravo@mail.com` remain separate components.

The merged result is therefore:

- `John` with `john00@mail.com`, `john_newyork@mail.com`, `johnsmith@mail.com`
- `Mary` with `mary@mail.com`
- `John` with `johnnybravo@mail.com`

## Why This Works

Union-Find maintains connected components under repeated merges. Whenever two accounts share an email, connecting their emails joins their components. If two accounts are connected through several intermediate accounts, the repeated unions still place every email in the same component.

After all unions are complete, two emails have the same representative exactly when they are connected through shared-email relationships. Grouping by that representative therefore produces exactly the required merged accounts.

Sorting each component's emails gives the required deterministic output order within every merged account.

## Complexity

Let `E` be the total number of email entries across all accounts.

- **Time:** Approximately `O(E α(E) + E log E)` where `α` is the inverse Ackermann function. The Union-Find work is nearly linear; sorting the collected emails dominates when large components are present.
- **Auxiliary space:** `O(E)` for the DSU structures, email mappings, and grouped result.

## Common Mistakes

- Grouping only by account name; two different people can have the same name.
- Merging only directly overlapping accounts and missing transitive connections.
- Forgetting to sort emails inside each merged account.
- Using an email as a unique account identifier without connecting all emails belonging to the same input account.
