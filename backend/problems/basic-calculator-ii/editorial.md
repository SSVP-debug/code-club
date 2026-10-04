# Editorial

## Approach: Track the Previous Term

The expression contains only `+`, `-`, `*`, and `/`, with no parentheses. Multiplication and division have higher precedence than addition and subtraction.

Scan the expression from left to right while building the current number. Keep the previous term and the running result:

- `+x`: add the previous term to the result and make `x` the new previous term.
- `-x`: add the previous term to the result and make `-x` the new previous term.
- `*x`: replace the previous term with `previous * x`.
- `/x`: replace the previous term with integer division of `previous / x`, truncated toward zero.

At the end, add the final previous term to the result.

This delays each multiplication or division until its complete term is known, while addition and subtraction commit the previous term to the running total.

## Walkthrough

For `3+2*2`:

1. Read `3` after `+` → previous term is `3`.
2. Read `2` after `+` → add `3` to the result and set previous term to `2`.
3. Read `2` after `*` → replace the previous term with `2 * 2 = 4`.
4. End of expression → add `4` to the result.

The final result is `7`.

For `14-3/2`, division truncates toward zero, so `3/2` becomes `1`. The expression is therefore `14 - 1 = 13`.

## Why This Works

The previous term always represents the most recent complete multiplication/division term that has not yet been committed to the final result. Multiplication and division modify that term directly, so they take precedence over earlier additions or subtractions.

When a new `+` or `-` operator appears, the previous term is complete and can safely be added to the running result. After the scan ends, the final term is committed in the same way. Thus every operation is evaluated with the required precedence.

## Complexity

- **Time:** `O(n)` where `n` is the length of the expression.
- **Auxiliary space:** `O(1)` apart from the input string.

## Common Mistakes

- Evaluating strictly left to right and ignoring operator precedence.
- Using language-specific floor division when the problem requires truncation toward zero.
- Forgetting to process the final number after the loop ends.
- Building the current number incorrectly when it contains multiple digits.
