import { CELL, neighborsOf, remainingMines } from "./game.js";

const MAX_ENUMERATION_CELLS = 24;

export const solverRules = [
  {
    id: "local-count",
    label: "局所カウント",
    description: "数字の周囲で、残りがすべて地雷またはすべて安全だと確定する場合を処理する。",
    run: localCountRule,
  },
  {
    id: "subset",
    label: "部分集合",
    description: "隣接する制約 A/B で片方の未確定集合がもう片方を含む場合、差分を確定する。",
    run: subsetRule,
  },
  {
    id: "constraint-closure",
    label: "派生制約",
    description: "部分集合の差分で作った制約をさらに伝播し、数字単体では見えない安全マスを確定する。",
    run: constraintClosureRule,
  },
  {
    id: "overlap-bounds",
    label: "重なり上下限",
    description: "重なり合う2つの制約で、片方から交差部の最大・最小地雷数を縛り、差分側を確定する。",
    run: overlapBoundsRule,
  },
  {
    id: "exact-frontier",
    label: "境界完全列挙",
    description: "開いた数字に接する未確定マスを制約充足で列挙し、全解で同じマスを確定する。",
    run: exactFrontierRule,
  },
  {
    id: "global-frontier",
    label: "残数つき列挙",
    description: "境界成分の解を盤面全体の残り地雷数で絞り込み、地雷数を使い切れない仮定を除外する。",
    run: globalFrontierRule,
  },
  {
    id: "global-count",
    label: "全体残数",
    description: "残り地雷数と未確定マス数が一致する場合や、残り地雷がゼロの場合を処理する。",
    run: globalCountRule,
  },
];

export function solveStep(game, enabledRuleIds = solverRules.map((rule) => rule.id)) {
  const enabled = new Set(enabledRuleIds);
  for (const rule of solverRules) {
    if (!enabled.has(rule.id)) continue;
    const actions = uniqueActions(rule.run(game));
    if (actions.length > 0) {
      return { actions, rule };
    }
  }
  return { actions: [], rule: null };
}

export function solveUntilStuck(game, enabledRuleIds) {
  const steps = [];
  let current = game;
  let guard = 0;
  while (guard < 500) {
    const step = solveStep(current, enabledRuleIds);
    if (step.actions.length === 0) break;
    steps.push(step);
    current = step.previewApply ? step.previewApply(current) : current;
    current = previewApplyActions(current, step.actions);
    guard += 1;
  }
  return steps;
}

export function analyzeBoard(game, enabledRuleIds) {
  const step = solveStep(game, enabledRuleIds);
  const probabilities = estimateProbabilities(game);
  return { nextActions: step.actions, nextRule: step.rule, probabilities };
}

function localCountRule(game) {
  return constraintsFromBoard(game).flatMap((constraint) => {
    if (constraint.minesNeeded === 0) {
      return constraint.unknowns.map((index) => action("reveal", index, "local-count"));
    }
    if (constraint.minesNeeded === constraint.unknowns.length) {
      return constraint.unknowns.map((index) => action("flag", index, "local-count"));
    }
    return [];
  });
}

function subsetRule(game) {
  const constraints = constraintsFromBoard(game);
  const actions = [];
  for (let i = 0; i < constraints.length; i += 1) {
    for (let j = 0; j < constraints.length; j += 1) {
      if (i === j) continue;
      const a = constraints[i];
      const b = constraints[j];
      if (!isSubset(a.unknowns, b.unknowns)) continue;
      const diff = b.unknowns.filter((index) => !a.unknownSet.has(index));
      const remaining = b.minesNeeded - a.minesNeeded;
      if (diff.length === 0) continue;
      if (remaining === 0) {
        diff.forEach((index) => actions.push(action("reveal", index, "subset")));
      }
      if (remaining === diff.length) {
        diff.forEach((index) => actions.push(action("flag", index, "subset")));
      }
    }
  }
  return actions;
}

function constraintClosureRule(game) {
  const constraints = closeConstraints(constraintsFromBoard(game));
  return constraints.flatMap((constraint) => {
    if (constraint.minesNeeded === 0) {
      return constraint.unknowns.map((index) => action("reveal", index, "constraint-closure"));
    }
    if (constraint.minesNeeded === constraint.unknowns.length) {
      return constraint.unknowns.map((index) => action("flag", index, "constraint-closure"));
    }
    return [];
  });
}

function overlapBoundsRule(game) {
  const constraints = closeConstraints(constraintsFromBoard(game));
  const actions = [];

  for (let i = 0; i < constraints.length; i += 1) {
    for (let j = 0; j < constraints.length; j += 1) {
      if (i === j) continue;
      const a = constraints[i];
      const b = constraints[j];
      const overlap = b.unknowns.filter((index) => a.unknownSet.has(index));
      const bOnly = b.unknowns.filter((index) => !a.unknownSet.has(index));
      if (overlap.length === 0 || bOnly.length === 0) continue;

      const minOverlapFromA = Math.max(0, a.minesNeeded - (a.unknowns.length - overlap.length));
      const maxOverlapFromA = Math.min(overlap.length, a.minesNeeded);
      const minBOnly = b.minesNeeded - maxOverlapFromA;
      const maxBOnly = b.minesNeeded - minOverlapFromA;

      if (minBOnly === bOnly.length) {
        bOnly.forEach((index) => actions.push(action("flag", index, "overlap-bounds")));
      }
      if (maxBOnly === 0) {
        bOnly.forEach((index) => actions.push(action("reveal", index, "overlap-bounds")));
      }
    }
  }

  return actions;
}

function exactFrontierRule(game) {
  const components = frontierComponents(game);
  const actions = [];
  for (const component of components) {
    if (component.variables.length > MAX_ENUMERATION_CELLS) continue;
    const solutions = enumerateComponent(component);
    if (solutions.length === 0) continue;
    component.variables.forEach((index, position) => {
      const mineCount = solutions.reduce((sum, solution) => sum + solution[position], 0);
      if (mineCount === 0) actions.push(action("reveal", index, "exact-frontier"));
      if (mineCount === solutions.length) actions.push(action("flag", index, "exact-frontier"));
    });
  }
  return actions;
}

function globalFrontierRule(game) {
  const hiddenIndexes = game.cells.filter((cell) => cell.state === CELL.HIDDEN).map((cell) => cell.index);
  const hiddenSet = new Set(hiddenIndexes);
  const components = frontierComponents(game);
  const frontierVariables = new Set(components.flatMap((component) => component.variables));
  const unconstrainedCount = hiddenIndexes.filter((index) => !frontierVariables.has(index)).length;
  if (unconstrainedCount > 0) return [];
  if (components.some((component) => component.variables.length > MAX_ENUMERATION_CELLS)) return [];

  const combined = combineComponentSolutions(
    components,
    remainingMines(game),
  );
  if (!combined) return [];

  const actions = [];
  for (const index of hiddenSet) {
    const mineCount = combined.mineCounts.get(index) ?? 0;
    if (mineCount === 0) actions.push(action("reveal", index, "global-frontier"));
    if (mineCount === combined.solutionCount) actions.push(action("flag", index, "global-frontier"));
  }
  return actions;
}

function combineComponentSolutions(components, targetMines) {
  const componentSummaries = components.map((component) => {
    const solutions = enumerateComponent(component);
    if (solutions.length === 0) return null;
    const byMineCount = new Map();
    for (const solution of solutions) {
      const count = solution.reduce((sum, value) => sum + value, 0);
      if (!byMineCount.has(count)) byMineCount.set(count, []);
      byMineCount.get(count).push(solution);
    }
    return { component, byMineCount };
  });
  if (componentSummaries.some((summary) => summary === null)) return null;

  const suffixPossible = Array.from({ length: componentSummaries.length + 1 }, () => new Set());
  suffixPossible[componentSummaries.length].add(0);
  for (let i = componentSummaries.length - 1; i >= 0; i -= 1) {
    for (const count of componentSummaries[i].byMineCount.keys()) {
      for (const suffix of suffixPossible[i + 1]) {
        suffixPossible[i].add(count + suffix);
      }
    }
  }
  if (!suffixPossible[0].has(targetMines)) return null;

  const mineCounts = new Map();
  let solutionCount = 0;

  function walk(componentIndex, minesUsed, chosen) {
    if (componentIndex === componentSummaries.length) {
      if (minesUsed !== targetMines) return;
      solutionCount += 1;
      chosen.forEach(({ component, solution }) => {
        component.variables.forEach((index, position) => {
          if (solution[position]) mineCounts.set(index, (mineCounts.get(index) ?? 0) + 1);
        });
      });
      return;
    }

    const summary = componentSummaries[componentIndex];
    for (const [mineCount, solutions] of summary.byMineCount.entries()) {
      const nextMinesUsed = minesUsed + mineCount;
      if (nextMinesUsed > targetMines) continue;
      if (!suffixPossible[componentIndex + 1].has(targetMines - nextMinesUsed)) continue;
      for (const solution of solutions) {
        chosen.push({ component: summary.component, solution });
        walk(componentIndex + 1, nextMinesUsed, chosen);
        chosen.pop();
      }
    }
  }

  walk(0, 0, []);
  return solutionCount > 0 ? { mineCounts, solutionCount } : null;
}

function globalCountRule(game) {
  const unknowns = game.cells.filter((cell) => cell.state === CELL.HIDDEN).map((cell) => cell.index);
  const minesLeft = remainingMines(game);
  if (minesLeft === 0) return unknowns.map((index) => action("reveal", index, "global-count"));
  if (unknowns.length === minesLeft) return unknowns.map((index) => action("flag", index, "global-count"));
  return [];
}

function closeConstraints(initialConstraints) {
  const constraints = [];
  const seen = new Set();
  initialConstraints.forEach((constraint) => addConstraint(constraints, seen, constraint.unknowns, constraint.minesNeeded));

  let changed = true;
  while (changed) {
    changed = false;
    const snapshot = [...constraints];
    for (const a of snapshot) {
      for (const b of snapshot) {
        if (a === b) continue;
        if (!isSubset(a.unknowns, b.unknowns)) continue;
        const diff = b.unknowns.filter((index) => !a.unknownSet.has(index));
        const minesNeeded = b.minesNeeded - a.minesNeeded;
        if (addConstraint(constraints, seen, diff, minesNeeded)) changed = true;
      }
    }
  }

  return constraints;
}

function addConstraint(constraints, seen, unknowns, minesNeeded) {
  const uniqueUnknowns = [...new Set(unknowns)].sort((a, b) => a - b);
  if (uniqueUnknowns.length === 0) return false;
  if (minesNeeded < 0 || minesNeeded > uniqueUnknowns.length) return false;
  const key = `${minesNeeded}:${uniqueUnknowns.join(",")}`;
  if (seen.has(key)) return false;
  seen.add(key);
  constraints.push({
    minesNeeded,
    unknowns: uniqueUnknowns,
    unknownSet: new Set(uniqueUnknowns),
  });
  return true;
}

function estimateProbabilities(game) {
  const probabilities = new Map();
  const components = frontierComponents(game);
  for (const component of components) {
    if (component.variables.length > MAX_ENUMERATION_CELLS) continue;
    const solutions = enumerateComponent(component);
    if (solutions.length === 0) continue;
    component.variables.forEach((index, position) => {
      const mineCount = solutions.reduce((sum, solution) => sum + solution[position], 0);
      probabilities.set(index, mineCount / solutions.length);
    });
  }
  const unknowns = game.cells.filter((cell) => cell.state === CELL.HIDDEN).map((cell) => cell.index);
  const fallback = Math.max(0, Math.min(1, remainingMines(game) / Math.max(1, unknowns.length)));
  unknowns.forEach((index) => {
    if (!probabilities.has(index)) probabilities.set(index, fallback);
  });
  return probabilities;
}

function constraintsFromBoard(game) {
  return game.cells
    .filter((cell) => cell.state === CELL.REVEALED && cell.adjacent > 0)
    .map((cell) => {
      const neighbors = neighborsOf(cell.index, game.config);
      const flagged = neighbors.filter((index) => game.cells[index].state === CELL.FLAGGED).length;
      const unknowns = neighbors.filter((index) => game.cells[index].state === CELL.HIDDEN);
      return {
        source: cell.index,
        minesNeeded: cell.adjacent - flagged,
        unknowns,
        unknownSet: new Set(unknowns),
      };
    })
    .filter((constraint) => constraint.unknowns.length > 0 && constraint.minesNeeded >= 0);
}

function frontierComponents(game) {
  const constraints = constraintsFromBoard(game);
  const variableToConstraints = new Map();
  constraints.forEach((constraint, constraintIndex) => {
    constraint.unknowns.forEach((cellIndex) => {
      if (!variableToConstraints.has(cellIndex)) variableToConstraints.set(cellIndex, []);
      variableToConstraints.get(cellIndex).push(constraintIndex);
    });
  });

  const components = [];
  const seenVariables = new Set();
  for (const variable of variableToConstraints.keys()) {
    if (seenVariables.has(variable)) continue;
    const queue = [variable];
    const variables = new Set();
    const constraintIndexes = new Set();
    while (queue.length > 0) {
      const current = queue.shift();
      if (variables.has(current)) continue;
      variables.add(current);
      seenVariables.add(current);
      for (const constraintIndex of variableToConstraints.get(current) ?? []) {
        constraintIndexes.add(constraintIndex);
        for (const nextVariable of constraints[constraintIndex].unknowns) {
          if (!variables.has(nextVariable)) queue.push(nextVariable);
        }
      }
    }
    const variableList = [...variables];
    components.push({
      variables: variableList,
      constraints: [...constraintIndexes].map((index) => remapConstraint(constraints[index], variableList)),
    });
  }
  return components;
}

function remapConstraint(constraint, variables) {
  const positions = constraint.unknowns.map((index) => variables.indexOf(index)).filter((position) => position >= 0);
  return { positions, minesNeeded: constraint.minesNeeded };
}

function enumerateComponent(component) {
  const solutions = [];
  const assignment = Array(component.variables.length).fill(0);
  const constraintsByPosition = component.variables.map(() => []);
  component.constraints.forEach((constraint, constraintIndex) => {
    constraint.positions.forEach((position) => constraintsByPosition[position].push(constraintIndex));
  });

  function backtrack(position) {
    if (position === component.variables.length) {
      if (component.constraints.every((constraint) => sumPositions(assignment, constraint.positions) === constraint.minesNeeded)) {
        solutions.push([...assignment]);
      }
      return;
    }

    for (const value of [0, 1]) {
      assignment[position] = value;
      if (partialIsValid(position)) backtrack(position + 1);
      assignment[position] = 0;
    }
  }

  function partialIsValid(position) {
    for (const constraintIndex of constraintsByPosition[position]) {
      const constraint = component.constraints[constraintIndex];
      let assigned = 0;
      let mines = 0;
      constraint.positions.forEach((candidatePosition) => {
        if (candidatePosition <= position) {
          assigned += 1;
          mines += assignment[candidatePosition];
        }
      });
      const unassigned = constraint.positions.length - assigned;
      if (mines > constraint.minesNeeded) return false;
      if (mines + unassigned < constraint.minesNeeded) return false;
    }
    return true;
  }

  backtrack(0);
  return solutions;
}

function sumPositions(assignment, positions) {
  return positions.reduce((sum, position) => sum + assignment[position], 0);
}

function previewApplyActions(game, actions) {
  const next = {
    ...game,
    cells: game.cells.map((cell) => ({ ...cell })),
  };
  actions.forEach((candidate) => {
    const cell = next.cells[candidate.index];
    if (!cell || cell.state !== CELL.HIDDEN) return;
    cell.state = candidate.type === "flag" ? CELL.FLAGGED : CELL.REVEALED;
  });
  return next;
}

function action(type, index, reason) {
  return { type, index, reason };
}

function uniqueActions(actions) {
  const seen = new Set();
  return actions.filter((candidate) => {
    const key = `${candidate.type}:${candidate.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSubset(left, right) {
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}
