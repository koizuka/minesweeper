import { applySolverActions, CELL, createGame, LEVELS, remainingMines, revealCell } from "./game.js?v=20260517-3";
import { analyzeBoard, solveStep, solverRules } from "./solver.js?v=20260517-3";

const state = {
  levelId: "intermediate",
  game: createGame(LEVELS.intermediate),
  seed: null,
  enabledRules: new Set(solverRules.map((rule) => rule.id)),
  autoSolve: true,
  analysis: null,
  log: [],
};

const app = document.querySelector("#app");
const initialSeed = seedFromLocation();
resetGame(initialSeed ? { seed: initialSeed } : {});

function render() {
  state.analysis = analyzeBoard(state.game, [...state.enabledRules]);
  app.innerHTML = `
    <main class="shell state-${viewState()}">
      <section class="topbar">
        <div class="brand">
          <h1>Minesweeper Spoiled+</h1>
          <a class="github-link" href="https://github.com/koizuka/minesweeper" target="_blank" rel="noreferrer" aria-label="GitHub repository">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.4.7-4.1-1.4-4.1-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0C17.3 4.9 18.3 5.2 18.3 5.2c.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
            </svg>
          </a>
          <p>確定できる盤面はソルバーが奪い、人間は最後に残った賭けだけを打つ。</p>
        </div>
        <div class="controls">
          <select id="level" aria-label="難易度">
            ${Object.entries(LEVELS).map(([id, level]) => `<option value="${id}" ${id === state.levelId ? "selected" : ""}>${level.label}</option>`).join("")}
          </select>
          <button id="newGame" type="button">New</button>
          <form class="seed-control" id="seedForm">
            <input id="seedInput" type="text" inputmode="numeric" pattern="[0-9]*" value="${state.seed ?? ""}" aria-label="Seed" />
            <button id="loadSeed" type="submit">Seed</button>
          </form>
          <button id="solveOnce" type="button">Step</button>
          <label class="toggle"><input id="autoSolve" type="checkbox" ${state.autoSolve ? "checked" : ""}>Auto</label>
        </div>
      </section>
      <section class="workspace">
        <section class="board-wrap">
          <div class="status">
            <span>💣 ${remainingMines(state.game)}</span>
            <span>${statusText()}</span>
            <span>${state.game.moves} moves</span>
          </div>
          <div class="board" style="--cols:${state.game.config.width}; --rows:${state.game.config.height};">
            ${state.game.cells.map(renderCell).join("")}
          </div>
        </section>
        <aside class="panel rules">
          <h2>Rules</h2>
          ${solverRules.map((rule) => `
            <label class="rule">
              <input type="checkbox" data-rule="${rule.id}" ${state.enabledRules.has(rule.id) ? "checked" : ""}>
              <span>
                <strong>${rule.label}</strong>
                <small>${rule.description}</small>
              </span>
            </label>
          `).join("")}
        </aside>
        <aside class="panel insight">
          <h2>Solver</h2>
          ${renderInsight()}
          <h2>Log</h2>
          <ol class="log">${state.log.slice(0, 10).map((entry) => `<li>${entry}</li>`).join("")}</ol>
        </aside>
      </section>
    </main>
  `;
  bindEvents();
}

function renderCell(cell) {
  const probability = state.analysis?.probabilities.get(cell.index);
  const probabilityText = probability != null && cell.state === CELL.HIDDEN ? `${Math.round(probability * 100)}%` : "";
  const className = [
    "cell",
    cell.state,
    cell.mine && state.game.status === "lost" ? "mine-hit" : "",
    cell.solverMark ? `solver-${cell.solverMark}` : "",
  ].filter(Boolean).join(" ");
  const label = cell.state === CELL.REVEALED && cell.mine
    ? "✸"
    : cell.state === CELL.REVEALED && cell.adjacent > 0
      ? cell.adjacent
      : cell.state === CELL.FLAGGED
        ? flagIcon()
        : probabilityText;
  return `<button class="${className}" data-index="${cell.index}" data-n="${cell.adjacent}" type="button" aria-label="cell ${cell.index}">${label}</button>`;
}

function flagIcon() {
  return `
    <svg class="flag-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path class="flag-pole" d="M6.5 3.5v17" />
      <path class="flag-cloth" d="M7.5 4.5h10l-2.1 4 2.1 4h-10z" />
      <path class="flag-base" d="M4 20.5h8" />
    </svg>
  `;
}

function renderInsight() {
  const next = state.analysis?.nextActions ?? [];
  if (state.game.status === "ready") return `<p class="hint">最初の1手は安全地帯つきで生成されます。</p>`;
  if (state.game.status === "won") return `<p class="win">全地雷を確定しました。</p>`;
  if (state.game.status === "lost") return `<p class="lose">地雷を開きました。</p>`;
  if (next.length === 0) return `<p class="hint">確定手なし。ここからは確率を見て賭ける局面です。</p>`;
  return `
    <p class="hint">${state.analysis.nextRule.label}: ${next.length} cells</p>
    <ul class="actions">
      ${next.slice(0, 12).map((action) => `<li>${action.type === "flag" ? "Flag" : "Open"} #${action.index}</li>`).join("")}
    </ul>
  `;
}

function bindEvents() {
  document.querySelector("#newGame").addEventListener("click", () => resetGame({ freshSeed: true }));
  document.querySelector("#seedForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const seed = normalizeSeed(document.querySelector("#seedInput").value);
    if (!seed) return;
    resetGame({ seed });
  });
  const seedInput = document.querySelector("#seedInput");
  seedInput.addEventListener("pointerdown", (event) => {
    if (document.activeElement === event.currentTarget) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.select();
  });
  seedInput.addEventListener("focus", (event) => {
    event.target.select();
  });
  document.querySelector("#solveOnce").addEventListener("click", () => runSolverStep());
  document.querySelector("#level").addEventListener("change", (event) => {
    state.levelId = event.target.value;
    resetGame();
  });
  document.querySelector("#autoSolve").addEventListener("change", (event) => {
    state.autoSolve = event.target.checked;
    maybeAutoSolve();
  });
  document.querySelectorAll("[data-rule]").forEach((input) => {
    input.addEventListener("change", (event) => {
      if (event.target.checked) state.enabledRules.add(event.target.dataset.rule);
      else state.enabledRules.delete(event.target.dataset.rule);
      maybeAutoSolve();
      render();
    });
  });
  document.querySelectorAll(".cell").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      state.game = revealCell(state.game, index);
      state.log.unshift(`Human opened #${index}`);
      maybeAutoSolve();
      render();
    });
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
  });
}

function resetGame(options = {}) {
  const config = LEVELS[state.levelId];
  const seed = options.seed ?? (options.freshSeed ? createSeed() : seedForLevel(state.levelId));
  const round = options.seed
    ? startAndSpoil(config, state.enabledRules, seed)
    : options.freshSeed || !hasStoredSeed(state.levelId)
    ? createGuessRound(config, state.enabledRules, seed)
    : startAndSpoil(config, state.enabledRules, seed);
  state.seed = round.seed;
  storeSeed(state.levelId, state.seed);
  syncSeedToLocation(state.seed);
  state.game = round.game;
  state.log = [`Seed ${state.seed}`, ...round.log];
  render();
}

function createGuessRound(config, enabledRules, baseSeed) {
  const maxAttempts = 250;
  let lastRound = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const seed = baseSeed + attempt * 9973;
    const round = startAndSpoil(config, enabledRules, seed);
    lastRound = round;
    if (round.game.status !== "won" && solveStep(round.game, [...enabledRules]).actions.length === 0) {
      if (attempt > 0) round.log.unshift(`Regenerated ${attempt} solved board${attempt === 1 ? "" : "s"}`);
      return round;
    }
  }
  lastRound.log.unshift("Could not find a guess board within the retry limit");
  return lastRound;
}

function startAndSpoil(config, enabledRules, seed) {
  const index = openingIndex(config);
  let game = revealCell(createGame(config, seed), index);
  const log = [`Auto opened #${index}`];
  let guard = 0;
  while (guard < 200) {
    const step = solveStep(game, [...enabledRules]);
    if (step.actions.length === 0) break;
    game = applySolverActions(game, step.actions);
    log.unshift(`${step.rule.label}: ${step.actions.length} cells`);
    guard += 1;
  }
  return { game, log, seed };
}

function openingIndex(config) {
  const x = Math.floor(config.width / 2);
  const y = Math.floor(config.height / 2);
  return y * config.width + x;
}

function seedForLevel(levelId) {
  const stored = Number(localStorage.getItem(seedKey(levelId)));
  if (Number.isSafeInteger(stored) && stored > 0) return stored;
  return createSeed();
}

function seedFromLocation() {
  return normalizeSeed(new URLSearchParams(window.location.search).get("seed"));
}

function syncSeedToLocation(seed) {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", String(seed));
  window.history.replaceState(null, "", url);
}

function normalizeSeed(value) {
  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0x7fffffff) return null;
  return seed;
}

function hasStoredSeed(levelId) {
  const stored = Number(localStorage.getItem(seedKey(levelId)));
  return Number.isSafeInteger(stored) && stored > 0;
}

function storeSeed(levelId, seed) {
  localStorage.setItem(seedKey(levelId), String(seed));
}

function seedKey(levelId) {
  return `minesweeper-spoiled-plus:seed:${levelId}`;
}

function createSeed() {
  return Math.floor(Math.random() * 0x7fffffff) + 1;
}

function runSolverStep() {
  const step = solveStep(state.game, [...state.enabledRules]);
  if (step.actions.length === 0) {
    state.log.unshift("Solver stuck");
    render();
    return false;
  }
  state.game = applySolverActions(state.game, step.actions);
  state.log.unshift(`${step.rule.label}: ${step.actions.length} cells`);
  render();
  return true;
}

function maybeAutoSolve() {
  if (!state.autoSolve) return;
  let guard = 0;
  while (guard < 200) {
    const step = solveStep(state.game, [...state.enabledRules]);
    if (step.actions.length === 0) break;
    state.game = applySolverActions(state.game, step.actions);
    state.log.unshift(`${step.rule.label}: ${step.actions.length} cells`);
    guard += 1;
  }
}

function statusText() {
  if (state.game.status === "ready") return "Ready";
  if (state.game.status === "won") return "Solved";
  if (state.game.status === "lost") return "Exploded";
  return state.analysis?.nextActions.length ? "Spoiling" : "Guess";
}

function viewState() {
  if (state.game.status === "won") return "solved";
  if (state.game.status === "lost") return "lost";
  if (state.game.status === "ready") return "ready";
  return state.analysis?.nextActions.length ? "spoiling" : "guess";
}
