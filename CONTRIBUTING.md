# Contributing

## Development

Run the local app:

```sh
npm run dev
```

Run tests:

```sh
npm test
```

## Solver Changes

Solver rules live in `src/solver.js` in the `solverRules` array. When adding or changing a rule:

- Keep the rule deterministic.
- Add a focused unit test in `test/solver.test.js`.
- Prefer a small synthetic board that isolates the inference.
- Keep rule order intentional because `solveStep()` applies the first rule that produces actions.

See `AGENTS.md` for more implementation notes.
