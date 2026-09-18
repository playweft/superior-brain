import { test } from "node:test";
import assert from "node:assert/strict";
import { reaction } from "../src/games/reaction.mjs";
import { STROOP_COLORS, stroop } from "../src/games/stroop.mjs";
import { recall } from "../src/games/recall.mjs";
import { gridrace } from "../src/games/gridrace.mjs";
import { GAMES } from "../src/games/index.mjs";

function constant(value) {
  return () => value;
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seats = (count) =>
  Array.from({ length: count }, (_, index) => ({ id: `s${index + 1}` }));

test("every party game exposes the session contract", () => {
  assert.equal(GAMES.length, 4);
  for (const game of GAMES) {
    assert.match(game.id, /^[a-z]+$/);
    assert.ok(game.name && game.tagline);
    assert.ok(game.rounds >= 1);
    assert.ok(game.minSeats >= 1 && game.maxSeats >= game.minSeats);
  }
});

test("reaction scores the first clean press and bars false starts", () => {
  const state = reaction.create({ seats: seats(2), rng: constant(0.5), now: 0 });
  const wait = state.phaseUntil;

  reaction.intent(state, { seatId: "s1", button: "a", at: 900 });
  assert.equal(state.scores.s1, -30);
  reaction.intent(state, { seatId: "s1", button: "a", at: 1000 });
  assert.equal(state.scores.s1, -30, "a repeated press must not double the penalty");

  reaction.tick(state, wait);
  assert.equal(state.phase, "signal");

  reaction.intent(state, { seatId: "s1", button: "a", at: wait + 10 });
  assert.equal(state.winner, null, "a false starter cannot win the round");

  reaction.intent(state, { seatId: "s2", button: "a", at: wait + 20 });
  assert.equal(state.winner, "s2");
  assert.equal(state.scores.s2, 100);

  reaction.tick(state, state.phaseUntil);
  assert.equal(state.roundIndex, 1);
  assert.equal(state.phase, "waiting");
  assert.deepEqual(state.falseStarts, []);
});

test("reaction finishes after the configured rounds even when nobody answers", () => {
  const state = reaction.create({ seats: seats(2), rng: constant(0.5), now: 0 });
  for (let round = 0; round < 5; round += 1) {
    reaction.tick(state, state.phaseUntil);
    reaction.tick(state, state.phaseUntil);
    reaction.tick(state, state.phaseUntil);
  }
  assert.equal(state.phase, "done");
  assert.equal(state.roundIndex, 5);
});

test("stroop scores only the colour of the ink", () => {
  const state = stroop.create({ seats: seats(1), rng: seeded(3), now: 0 });
  const question = state.question;
  const answer = STROOP_COLORS.find((color) => color.button === question.answerButton);
  assert.equal(answer.hex, question.inkHex);

  stroop.intent(state, { seatId: "s1", button: question.answerButton, at: 200 });
  assert.equal(state.answers.s1.correct, true);
  assert.ok(state.scores.s1 > 100, "speed bonus is added on top of the base score");
  assert.equal(state.phase, "feedback");

  stroop.tick(state, state.phaseUntil);
  const wrong = STROOP_COLORS.find(
    (color) => color.button !== state.question.answerButton,
  ).button;
  stroop.intent(state, { seatId: "s1", button: wrong, at: state.phaseStart + 50 });
  assert.equal(state.answers.s1.correct, false);
  assert.equal(state.lastGain.s1, 0);
});

test("recall offers exactly one matching option", () => {
  const state = recall.create({ seats: seats(2), rng: seeded(11), now: 0 });
  const lit = [...state.question.lit].sort((a, b) => a - b).join(",");
  recall.tick(state, state.phaseUntil);
  assert.equal(state.phase, "choose");

  const options = state.question.options;
  assert.equal(options.length, 4);
  const matches = options.filter(
    (option) => [...option.cells].sort((a, b) => a - b).join(",") === lit,
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].key, state.question.answerKey);

  recall.intent(state, { seatId: "s1", button: state.question.answerKey, at: state.phaseStart + 100 });
  assert.ok(state.scores.s1 >= 100);
  recall.intent(state, { seatId: "s2", button: "y", at: state.phaseStart + 200 });
  assert.equal(state.picks.s2.correct, state.question.answerKey === "y");
});

test("stroop reveals the ink colour when the question times out", () => {
  const state = stroop.create({ seats: seats(2), rng: constant(0.5), now: 0 });
  stroop.tick(state, state.phaseUntil);
  assert.equal(state.phase, "feedback");
  assert.equal(state.roundIndex, 0, "the round only advances after the reveal");
  stroop.tick(state, state.phaseUntil);
  assert.equal(state.roundIndex, 1);
});

test("recall reveals the right grid when nobody picks in time", () => {
  const state = recall.create({ seats: seats(2), rng: seeded(11), now: 0 });
  recall.tick(state, state.phaseUntil);
  assert.equal(state.phase, "choose");
  recall.tick(state, state.phaseUntil);
  assert.equal(state.phase, "feedback");
  assert.equal(state.roundIndex, 0);
  assert.match(state.question.answerKey, /^[abxy]$/);
  recall.tick(state, state.phaseUntil);
  assert.equal(state.roundIndex, 1);
});

function solveBoard(state, seatId, startedAt) {
  const board = state.boards[seatId];
  let at = startedAt;
  for (let value = 1; value <= board.total; value += 1) {
    const index = board.cells.indexOf(value);
    const targetRow = Math.floor(index / state.size);
    const targetCol = index % state.size;
    while (Math.floor(board.cursor / state.size) < targetRow) {
      gridrace.intent(state, { seatId, button: "down", at });
      at += 5;
    }
    while (Math.floor(board.cursor / state.size) > targetRow) {
      gridrace.intent(state, { seatId, button: "up", at });
      at += 5;
    }
    while (board.cursor % state.size < targetCol) {
      gridrace.intent(state, { seatId, button: "right", at });
      at += 5;
    }
    while (board.cursor % state.size > targetCol) {
      gridrace.intent(state, { seatId, button: "left", at });
      at += 5;
    }
    gridrace.intent(state, { seatId, button: "a", at });
    at += 5;
  }
  return at;
}

test("gridrace enforces the number order and ranks finishers", () => {
  const state = gridrace.create({ seats: seats(2), rng: seeded(5), now: 0 });
  assert.equal(state.phase, "ready");
  gridrace.intent(state, { seatId: "s1", button: "a", at: 10 });
  assert.equal(state.boards.s1.next, 1, "input is ignored before the race starts");

  gridrace.tick(state, state.phaseUntil);
  assert.equal(state.phase, "race");

  gridrace.intent(state, { seatId: "s1", button: "up", at: 2000 });
  assert.equal(state.boards.s1.cursor, 0, "the cursor stays inside the grid");

  const board = state.boards.s1;
  if (board.cells[0] !== 1) {
    gridrace.intent(state, { seatId: "s1", button: "a", at: 2100 });
    assert.equal(board.mistakes, 1);
    assert.equal(board.lockUntil, 2450);
    gridrace.intent(state, { seatId: "s1", button: "a", at: 2200 });
    assert.equal(board.mistakes, 1, "a locked seat cannot press again");
  }

  const firstDone = solveBoard(state, "s1", 3000);
  const secondDone = solveBoard(state, "s2", firstDone + 100);
  assert.ok(state.boards.s1.finishedAt < state.boards.s2.finishedAt);
  assert.ok(secondDone > firstDone);

  assert.equal(state.phase, "scored", "the round settles once everyone is done");
  assert.deepEqual(state.ranks, ["s1", "s2"]);
  assert.equal(state.scores.s1, 100);
  assert.equal(state.scores.s2, 60);

  gridrace.tick(state, state.phaseUntil);
  assert.equal(state.phase, "ready");
  assert.equal(state.roundIndex, 1);
});
