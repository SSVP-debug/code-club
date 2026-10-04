# Editorial

## Approach: Stack

A collision can only happen when a right-moving asteroid is followed by a left-moving asteroid. A stack naturally represents the asteroids that have survived so far.

Process the asteroids from left to right. For a positive asteroid, push it onto the stack. For a negative asteroid, repeatedly compare it with the positive asteroid at the top of the stack:

1. If the top asteroid is smaller, it explodes, so pop it and continue checking.
2. If the two sizes are equal, both explode, so pop the top and discard the current asteroid.
3. If the top asteroid is larger, the current negative asteroid explodes and is discarded.
4. If there is no positive asteroid at the top, the current asteroid survives and is pushed.

The sign matters because two asteroids moving in the same direction never collide.

## Walkthrough

For `[-5,10]`, the asteroids move away from each other, so both survive.

For `[5,10,-5]`:

- `5` and `10` are pushed.
- `-5` meets `10`. Since `10` is larger, `-5` explodes.
- The surviving stack is `[5,10]`.

For `[8,-8]`, the two asteroids have equal size, so both explode and the final stack is empty.

## Why This Works

The stack contains exactly the asteroids that have survived all collisions involving the processed prefix. A new left-moving asteroid can only collide with a positive asteroid at the right edge of that surviving prefix, which is the stack top.

Repeatedly resolving the top collision therefore removes every asteroid that must explode. Once the current asteroid survives or no collision is possible, adding it preserves the invariant for the next input element.

## Complexity

- **Time:** `O(n)` because every asteroid is pushed at most once and popped at most once.
- **Auxiliary space:** `O(n)` in the worst case.

## Common Mistakes

- Treating every adjacent pair as a collision; direction matters.
- Forgetting that equal-sized asteroids both disappear.
- Stopping after one collision even though the current asteroid may collide with several survivors.
- Comparing absolute sizes without preserving the sign that determines direction.
