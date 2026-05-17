export const CELL = {
  HIDDEN: "hidden",
  REVEALED: "revealed",
  FLAGGED: "flagged",
};

export const LEVELS = {
  beginner: { label: "9 x 9 / 10", width: 9, height: 9, mines: 10 },
  intermediate: { label: "16 x 16 / 40", width: 16, height: 16, mines: 40 },
  expert: { label: "30 x 16 / 99", width: 30, height: 16, mines: 99 },
};

export function createGame(config, seed = Date.now()) {
  const total = config.width * config.height;
  return {
    config,
    seed,
    status: "ready",
    firstMove: true,
    cells: Array.from({ length: total }, (_, index) => ({
      index,
      state: CELL.HIDDEN,
      mine: false,
      adjacent: 0,
      solverMark: null,
    })),
    moves: 0,
    startedAt: null,
    endedAt: null,
  };
}

export function cloneGame(game) {
  return {
    ...game,
    config: { ...game.config },
    cells: game.cells.map((cell) => ({ ...cell })),
  };
}

export function neighborsOf(index, config) {
  const x = index % config.width;
  const y = Math.floor(index / config.width);
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
        neighbors.push(ny * config.width + nx);
      }
    }
  }
  return neighbors;
}

export function revealCell(game, index) {
  const next = cloneGame(game);
  if (next.status === "won" || next.status === "lost") return next;
  const cell = next.cells[index];
  if (!cell || cell.state === CELL.FLAGGED || cell.state === CELL.REVEALED) return next;

  if (next.firstMove) {
    placeMines(next, index);
    next.firstMove = false;
    next.status = "playing";
    next.startedAt = Date.now();
  }

  next.moves += 1;
  floodReveal(next, index);

  if (next.cells[index].mine) {
    next.status = "lost";
    next.endedAt = Date.now();
    next.cells.forEach((candidate) => {
      if (candidate.mine) candidate.state = CELL.REVEALED;
    });
    return next;
  }

  checkWin(next);
  return next;
}

export function flagCell(game, index, source = "human") {
  const next = cloneGame(game);
  if (next.status === "won" || next.status === "lost") return next;
  const cell = next.cells[index];
  if (!cell || cell.state === CELL.REVEALED) return next;
  cell.state = cell.state === CELL.FLAGGED ? CELL.HIDDEN : CELL.FLAGGED;
  cell.solverMark = source === "solver" && cell.state === CELL.FLAGGED ? "mine" : null;
  checkWin(next);
  return next;
}

export function applySolverActions(game, actions) {
  let next = cloneGame(game);
  for (const action of actions) {
    if (next.status === "won" || next.status === "lost") break;
    const cell = next.cells[action.index];
    if (!cell) continue;
    if (action.type === "flag" && cell.state === CELL.HIDDEN) {
      cell.state = CELL.FLAGGED;
      cell.solverMark = "mine";
    }
    if (action.type === "reveal" && cell.state === CELL.HIDDEN) {
      next = revealKnownSafe(next, action.index);
    }
  }
  checkWin(next);
  return next;
}

export function clearSolverMarks(game) {
  const next = cloneGame(game);
  next.cells.forEach((cell) => {
    if (cell.solverMark === "safe" && cell.state !== CELL.HIDDEN) cell.solverMark = null;
    if (cell.solverMark === "mine" && cell.state !== CELL.FLAGGED) cell.solverMark = null;
  });
  return next;
}

export function remainingMines(game) {
  return game.config.mines - game.cells.filter((cell) => cell.state === CELL.FLAGGED).length;
}

function revealKnownSafe(game, index) {
  const next = cloneGame(game);
  const cell = next.cells[index];
  if (!cell || cell.state !== CELL.HIDDEN) return next;
  cell.solverMark = "safe";
  floodReveal(next, index);
  return next;
}

function floodReveal(game, index) {
  const queue = [index];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const cell = game.cells[current];
    if (!cell || cell.state === CELL.FLAGGED || cell.state === CELL.REVEALED) continue;
    cell.state = CELL.REVEALED;
    if (cell.mine) continue;
    if (cell.adjacent === 0) {
      for (const neighbor of neighborsOf(current, game.config)) {
        if (game.cells[neighbor].state === CELL.HIDDEN) queue.push(neighbor);
      }
    }
  }
}

function placeMines(game, safeIndex) {
  const safeZone = new Set([safeIndex, ...neighborsOf(safeIndex, game.config)]);
  const candidates = game.cells.map((cell) => cell.index).filter((index) => !safeZone.has(index));
  const rng = mulberry32(game.seed);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.slice(0, game.config.mines).forEach((index) => {
    game.cells[index].mine = true;
  });
  game.cells.forEach((cell) => {
    cell.adjacent = neighborsOf(cell.index, game.config).filter((neighbor) => game.cells[neighbor].mine).length;
  });
}

function checkWin(game) {
  if (game.status === "lost") return;
  const unrevealed = game.cells.filter((cell) => cell.state !== CELL.REVEALED).length;
  if (unrevealed === game.config.mines) {
    game.status = "won";
    game.endedAt = Date.now();
    game.cells.forEach((cell) => {
      if (cell.mine) {
        cell.state = CELL.FLAGGED;
        cell.solverMark = cell.solverMark ?? "mine";
      }
    });
  }
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function nextRandom() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
