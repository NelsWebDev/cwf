# Contributing

## Main branch pre-push tests

Install the local Git hooks once in each clone:

```sh
pnpm setup:hooks
```

Before a push that updates `main`, the pre-push hook runs the backend unit tests
(`pnpm --filter @repo/server test`). A failed test blocks the push. Pushes to other
branches do not run this check.

Git hooks are local to a clone and can be bypassed with `git push --no-verify`.
For enforcement across contributors, configure a GitHub branch protection rule
or ruleset for `main` as well.
