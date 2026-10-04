# Editorial

## Approach: Depth-First Search

The graph is a directed acyclic graph, and every required path starts at node `0` and ends at node `n - 1`. A depth-first search can build one path at a time.

Keep a `path` containing the nodes currently being explored. Start with `[0]`. For every neighbor of the current node, append it to the path, recursively explore it, then remove it when returning. When the current node is `n - 1`, copy the path into the answer.

Because the graph is acyclic, DFS cannot get trapped in a cycle.

## Walkthrough

For a graph such as `[[1,2],[3],[3],[]]`, start with `[0]`.

- Follow `0 -> 1 -> 3`, so `[0,1,3]` is recorded.
- Backtrack to `0`, then follow `0 -> 2 -> 3`, so `[0,2,3]` is recorded.

The result contains both paths.

## Why This Works

At every node, DFS explores every outgoing edge. The current `path` contains exactly the sequence of nodes from `0` to that node. When DFS reaches `n - 1`, that sequence is therefore a complete valid path.

Backtracking removes the last node before exploring the next branch, so each possible route is explored independently and every path is recorded exactly once.

## Complexity

Let `P` be the number of paths and `L` their average length.

- **Time:** `O(P × L)` to enumerate and copy the paths, plus graph traversal overhead.
- **Auxiliary space:** `O(L)` for the recursion stack and current path, excluding the returned paths.
- **Output space:** `O(P × L)` for all returned paths.

## Common Mistakes

- Forgetting to copy the current path before backtracking.
- Removing a node too early and corrupting the current path.
- Assuming the graph has cycles; the problem guarantees a DAG.
- Returning only one path instead of exploring every outgoing edge.
