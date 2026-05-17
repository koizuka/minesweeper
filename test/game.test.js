import test from "node:test";
import assert from "node:assert/strict";
import { applySolverActions, CELL, createGame, flagCell, neighborsOf, revealCell } from "../src/game.js";

test("first reveal generates mines outside the clicked cell and its neighbors", () => {
  const game = createGame({ width: 9, height: 9, mines: 10 }, 1234);
  const opened = revealCell(game, 40);
  const safeZone = [40, ...neighborsOf(40, opened.config)];

  assert.equal(opened.firstMove, false);
  assert.equal(opened.status, "playing");
  assert.equal(opened.cells.filter((cell) => cell.mine).length, 10);
  assert.equal(safeZone.some((index) => opened.cells[index].mine), false);
});

test("flagged cells are not revealed by a human click", () => {
  const game = createGame({ width: 9, height: 9, mines: 10 }, 4321);
  const flagged = flagCell(game, 10);
  const afterClick = revealCell(flagged, 10);

  assert.equal(afterClick.cells[10].state, CELL.FLAGGED);
  assert.equal(afterClick.firstMove, true);
});

test("solver actions flag mines and reveal safe cells without changing unrelated cells", () => {
  let game = createGame({ width: 3, height: 3, mines: 1 }, 1);
  game = {
    ...game,
    firstMove: false,
    status: "playing",
    cells: game.cells.map((cell) => ({ ...cell, mine: false, adjacent: 0 })),
  };
  game.cells[8].mine = true;
  game.cells[4].adjacent = 1;

  const next = applySolverActions(game, [
    { type: "flag", index: 8 },
    { type: "reveal", index: 4 },
  ]);

  assert.equal(next.cells[8].state, CELL.FLAGGED);
  assert.equal(next.cells[8].solverMark, "mine");
  assert.equal(next.cells[4].state, CELL.REVEALED);
  assert.equal(next.cells[0].state, CELL.HIDDEN);
});
