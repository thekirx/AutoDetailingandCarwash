# Vercel Function Consolidation Baseline

Recorded before routing implementation on 2026-08-04.

## Command

```bash
node --test tests/*.test.js
```

## Result

- Total tests: 214
- Passed: 213
- Failed: 1
- Cancelled: 0
- Skipped: 0
- Todo: 0

The only failure is the existing credential-dependent test file `tests/pushAuth.test.js`.

```text
AssertionError [ERR_ASSERTION]: SUPABASE_SERVICE_ROLE_KEY required
    at tests/pushAuth.test.js:76:10
```

The worktree does not contain `SUPABASE_SERVICE_ROLE_KEY`. The test will remain unchanged: it will not be weakened, skipped, deleted, or modified, and no fake credential or secret will be added. After consolidation, the identical full-suite command must still report exactly 213 passes and this same single failure. Any additional failure is a regression and stops the work.
