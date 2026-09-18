const SIZES = [3, 3, 4];
const READY_MS = 1400;
const ROUND_MS = 16000;
const SCORED_MS = 1700;
const LOCK_MS = 350;
const POINTS = [100, 60, 30, 10];

const MOVES = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function setupRound(state, now) {
  const size = SIZES[Math.min(state.roundIndex, SIZES.length - 1)];
  state.size = size;
  state.boards = {};
  state.ranks = [];
  state.phase = "ready";
  state.phaseStart = now;
  state.phaseUntil = now + READY_MS;
  for (const id of state.seatIds) {
    state.boards[id] = {
      id,
      cells: shuffle(
        [...Array(size * size).keys()].map((index) => index + 1),
        state.rng,
      ),
      cursor: 0,
      next: 1,
      total: size * size,
      finishedAt: null,
      lockUntil: 0,
      mistakes: 0,
    };
    state.lastGain[id] = 0;
  }
}

function rank(state) {
  const boards = state.seatIds.map((id) => state.boards[id]);
  const finished = boards
    .filter((board) => board.finishedAt !== null)
    .sort((a, b) => a.finishedAt - b.finishedAt);
  const running = boards
    .filter((board) => board.finishedAt === null)
    .sort((a, b) => b.next - a.next);
  return [...finished, ...running];
}

function settle(state, now) {
  state.ranks = rank(state).map((board) => board.id);
  state.ranks.forEach((id, index) => {
    if (state.boards[id].finishedAt === null) return;
    const points = POINTS[index] ?? POINTS[POINTS.length - 1];
    state.scores[id] += points;
    state.lastGain[id] = points;
  });
  state.phase = "scored";
  state.phaseStart = now;
  state.phaseUntil = now + SCORED_MS;
}

export const gridrace = {
  id: "gridrace",
  name: "数字方格",
  tagline: "用方向键找数字，按顺序点完",
  rounds: SIZES.length,
  minSeats: 1,
  maxSeats: 4,

  create({ seats, rng, now, rounds = SIZES.length }) {
    const state = {
      seatIds: seats.slice(0, 4).map((seat) => seat.id),
      scores: {},
      lastGain: {},
      rng,
      roundIndex: 0,
      rounds,
      boards: {},
      ranks: [],
      size: SIZES[0],
      phase: "ready",
      phaseStart: now,
      phaseUntil: now,
    };
    for (const id of state.seatIds) {
      state.scores[id] = 0;
      state.lastGain[id] = 0;
    }
    setupRound(state, now);
    return state;
  },

  intent(state, { seatId, button, at }) {
    const board = state.boards[seatId];
    if (!board || state.phase !== "race" || board.finishedAt !== null) return;
    if (at < board.lockUntil) return;

    const move = MOVES[button];
    if (move) {
      const row = Math.floor(board.cursor / state.size) + move[0];
      const col = (board.cursor % state.size) + move[1];
      if (row < 0 || col < 0 || row >= state.size || col >= state.size) return;
      board.cursor = row * state.size + col;
      return;
    }

    if (button !== "a") return;
    if (board.cells[board.cursor] !== board.next) {
      board.mistakes += 1;
      board.lockUntil = at + LOCK_MS;
      return;
    }
    board.next += 1;
    if (board.next > board.total) {
      board.finishedAt = at;
      if (state.seatIds.every((id) => state.boards[id].finishedAt !== null)) {
        settle(state, at);
      }
    }
  },

  tick(state, now) {
    if (now < state.phaseUntil) return;
    if (state.phase === "ready") {
      state.phase = "race";
      state.phaseStart = state.phaseUntil;
      state.phaseUntil = state.phaseStart + ROUND_MS;
      return;
    }
    if (state.phase === "race") {
      settle(state, now);
      return;
    }
    if (state.phase !== "scored") return;
    state.roundIndex += 1;
    if (state.roundIndex >= state.rounds) {
      state.phase = "done";
      state.phaseStart = now;
      state.phaseUntil = now;
      return;
    }
    setupRound(state, now);
  },

  view(state, now) {
    return {
      id: "gridrace",
      boardKey: `gridrace:${state.roundIndex}:${state.phase}:${state.phaseStart}`,
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      remainingMs: Math.max(0, state.phaseUntil - now),
      phaseDuration: Math.max(1, state.phaseUntil - state.phaseStart),
      size: state.size,
      ranks: [...state.ranks],
      boards: state.seatIds.map((id) => ({
        id,
        cells: [...state.boards[id].cells],
        cursor: state.boards[id].cursor,
        next: state.boards[id].next,
        total: state.boards[id].total,
        finished: state.boards[id].finishedAt !== null,
        locked: now < state.boards[id].lockUntil,
        mistakes: state.boards[id].mistakes,
      })),
      scores: { ...state.scores },
      lastGain: { ...state.lastGain },
    };
  },
};
