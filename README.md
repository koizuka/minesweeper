# Minesweeper Spoiled+

[![CI](https://github.com/koizuka/minesweeper/actions/workflows/ci.yml/badge.svg)](https://github.com/koizuka/minesweeper/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/koizuka/minesweeper/actions/workflows/pages.yml/badge.svg)](https://github.com/koizuka/minesweeper/actions/workflows/pages.yml)

A browser-playable Minesweeper variant where deterministic solver rules automatically play every provable move. The player is left with the remaining guess positions.

## Run

```sh
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Deploy

Pushes to `master` run CI and deploy the static app to GitHub Pages.

Published URL:

```text
https://koizuka.github.io/minesweeper/
```

## Test

```sh
npm test
```

The test suite uses Node's built-in `node:test` runner and covers the game logic plus solver rules.

## Gameplay

- A new board automatically opens the center cell.
- If `Auto` is enabled, the solver repeatedly applies deterministic rules until it gets stuck.
- `New` searches for a board that still leaves a `Guess` under the current rule set.
- Browser reload reuses the stored seed and reruns the solver on the same board, which makes solver improvements easy to compare.
- Enter a seed in the toolbar, or open `?seed=2036220023`, to reproduce a specific board exactly.

## Solver Rules

Rules are defined in `src/solver.js` as entries in `solverRules`.

Current rules:

- Local count saturation
- Subset reasoning
- Derived constraint closure
- Overlap bounds between partially intersecting constraints
- Covering upper bounds across multiple intersecting constraints
- Exact frontier enumeration
- Frontier enumeration filtered by remaining mine count
- Remaining mine count against cells outside the frontier
- Global remaining mine count extremes

See `AGENTS.md` for implementation notes and handoff guidance.

## License

MIT
