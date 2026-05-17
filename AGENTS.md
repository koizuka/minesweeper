# Minesweeper Spoiled+

## Project Goal

This is a browser-playable Minesweeper variant where deterministic solver logic automatically consumes every provable move. The player should only be left with positions where the current rules cannot prove a safe or mine cell.

## Commands

- Run the app: `npm run dev`
- Run unit tests: `npm test`

The app is intentionally dependency-free at runtime. `npm run dev` uses Python's built-in HTTP server because the browser needs module loading over HTTP.

## File Map

- `src/game.js`: Minesweeper state, first-click-safe mine placement, reveal/flag behavior, solver action application.
- `src/solver.js`: Solver rules and probability analysis.
- `src/app.js`: DOM rendering, UI events, seed persistence, auto-start/new-game behavior.
- `src/styles.css`: Layout and state-specific visual styling.
- `test/game.test.js`: Unit tests for game invariants.
- `test/solver.test.js`: Unit tests for solver rules.

## Solver Architecture

Solver rules live in `solverRules` in `src/solver.js`. A rule is an object with:

- `id`: stable identifier used by the UI.
- `label`: display name.
- `description`: display text in the rules panel.
- `run(game)`: returns actions shaped as `{ type: "reveal" | "flag", index, reason }`.

`solveStep()` runs enabled rules in array order and applies only the first rule that produces actions. Rule order matters.

Current rule order:

1. `local-count`: standard adjacent count saturation.
2. `subset`: one-step subset difference reasoning.
3. `constraint-closure`: repeatedly derives subset-difference constraints and reuses them.
4. `overlap-bounds`: uses min/max mine counts across partially overlapping constraints.
5. `exact-frontier`: enumerates small connected frontier components.
6. `global-frontier`: filters frontier solutions by the board's remaining mine count when all hidden cells are constrained.
7. `global-count`: handles remaining mine count extremes.

## Seeds And Reload Behavior

`New` searches for a board that stops at `Guess` under the current rules, then stores the actual adopted seed in `localStorage`.

Reloading the browser reuses the stored seed exactly once and reruns the solver from the beginning. This is intentional: after changing solver logic, reload should show the effect on the same board, even if the board now becomes `Solved`.

## Testing Expectations

Add or update unit tests whenever solver behavior changes. Prefer small synthetic boards in `test/solver.test.js` that isolate one inference rule. Keep UI-independent logic testable through `src/game.js` and `src/solver.js`.

Before handing off changes, run:

```sh
npm test
```

## Implementation Notes

- Board coordinates discussed with users are usually 1-based `(x,y)`, while internal cell indexes are 0-based row-major.
- `neighborsOf(index, config)` is the canonical adjacency helper.
- `MAX_ENUMERATION_CELLS` limits brute-force frontier enumeration. Increase carefully and with tests.
- Avoid adding a build step unless there is a concrete need. The current app should keep working through static HTTP serving.
