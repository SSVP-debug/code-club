## Approach

Use a stack to keep track of opening brackets that still need to be closed. When we see an opening bracket, push it. When we see a closing bracket, it must match the most recently opened bracket, so compare it with the top of the stack.

For each character:

- `(`, `{`, or `[` → push it onto the stack.
- `)`, `}`, or `]` → the stack must be non-empty, and its top must be the matching opening bracket. Otherwise the string is invalid.

After processing the whole string, the stack must be empty. Any remaining opening bracket has not been closed.

This works because brackets must close in the reverse order in which they were opened—the exact behavior provided by a stack.

## Complexity

- Time: **O(n)** because every bracket is pushed and popped at most once.
- Space: **O(n)** in the worst case when all characters are opening brackets.

## Example walkthrough

For `s = "()[]{}"`:

1. Read `(` → push it.
2. Read `)` → it matches the top `(`, so pop it.
3. Read `[` → push it, then `]` matches and removes it.
4. Read `{` → push it, then `}` matches and removes it.
5. The stack is empty, so the string is valid.

For `s = "(]"`, the closing `]` does not match the opening `(` at the top of the stack, so the string is invalid.