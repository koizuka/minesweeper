import test from "node:test";
import assert from "node:assert/strict";
import { CELL, createGame } from "../src/game.js";
import { solveStep } from "../src/solver.js";

test("local-count flags every remaining neighbor when the number is saturated by unknowns", () => {
  const game = board(3, 3, 1, [
    "H H H",
    "H 6 H",
    "R F R",
  ]);

  const step = solveStep(game, ["local-count"]);

  assert.equal(step.rule.id, "local-count");
  assert.deepEqual(actionPairs(step.actions), [
    ["flag", 0],
    ["flag", 1],
    ["flag", 2],
    ["flag", 3],
    ["flag", 5],
  ]);
});

test("local-count reveals neighbors when all required mines are already flagged", () => {
  const game = board(3, 3, 1, [
    "H H H",
    "H 1 H",
    "R F R",
  ]);
  game.cells[0].state = CELL.REVEALED;
  game.cells[1].state = CELL.REVEALED;
  game.cells[2].state = CELL.REVEALED;
  game.cells[3].state = CELL.REVEALED;
  game.cells[5].state = CELL.HIDDEN;

  const step = solveStep(game, ["local-count"]);

  assert.equal(step.rule.id, "local-count");
  assert.deepEqual(actionPairs(step.actions), [["reveal", 5]]);
});

test("subset rule derives safe cells from a strict superset constraint", () => {
  const game = board(4, 2, 2, [
    "H H H H",
    "1 2 F R",
  ]);

  const step = solveStep(game, ["subset"]);

  assert.equal(step.rule.id, "subset");
  assert.deepEqual(actionPairs(step.actions), [["reveal", 2]]);
});

test("exact-frontier enumerates coupled constraints and returns cells that are true in every solution", () => {
  const game = board(5, 2, 2, [
    "H H H H H",
    "1 2 2 1 R",
  ]);

  const step = solveStep(game, ["exact-frontier"]);

  assert.equal(step.rule.id, "exact-frontier");
  assert.deepEqual(actionPairs(step.actions), [
    ["reveal", 0],
    ["flag", 1],
    ["flag", 2],
    ["reveal", 3],
    ["reveal", 4],
  ]);
});

test("constraint-closure reuses derived constraints to reveal cells beyond one subset step", () => {
  const game = board(5, 4, 3, [
    "F H H R R",
    "H 3 1 R R",
    "H 1 R R R",
    "H H H R R",
  ]);

  const step = solveStep(game, ["local-count", "subset", "constraint-closure"]);

  assert.equal(step.rule.id, "constraint-closure");
  assert.deepEqual(actionPairs(step.actions), [
    ["reveal", 15],
    ["reveal", 16],
    ["reveal", 17],
  ]);
});

test("global-frontier filters local solutions that cannot use the remaining mine count", () => {
  const game = board(5, 3, 6, [
    "H H H H R",
    "F 3 F 4 F",
    "R R R R F",
  ]);

  const step = solveStep(game, ["local-count", "subset", "constraint-closure", "exact-frontier", "global-frontier"]);

  assert.equal(step.rule.id, "global-frontier");
  assert.deepEqual(actionPairs(step.actions), [
    ["reveal", 2],
    ["flag", 3],
  ]);
});

test("global-count reveals every hidden cell when no mines remain", () => {
  const game = board(3, 2, 1, [
    "R R H",
    "R F H",
  ]);

  const step = solveStep(game, ["global-count"]);

  assert.equal(step.rule.id, "global-count");
  assert.deepEqual(actionPairs(step.actions), [
    ["reveal", 2],
    ["reveal", 5],
  ]);
});

function board(width, height, mines, rows) {
  const game = createGame({ width, height, mines }, 1);
  game.status = "playing";
  game.firstMove = false;
  const tokens = rows.flatMap((row) => row.split(/\s+/));
  assert.equal(tokens.length, width * height);
  tokens.forEach((token, index) => {
    const cell = game.cells[index];
    if (token === "H") {
      cell.state = CELL.HIDDEN;
      cell.adjacent = 0;
      return;
    }
    if (token === "F") {
      cell.state = CELL.FLAGGED;
      cell.adjacent = 0;
      return;
    }
    if (token === "R") {
      cell.state = CELL.REVEALED;
      cell.adjacent = 0;
      return;
    }
    cell.state = CELL.REVEALED;
    cell.adjacent = Number(token);
  });
  return game;
}

function actionPairs(actions) {
  return actions.map((action) => [action.type, action.index]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
}
