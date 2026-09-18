const WAIT_MIN = 1400;
const WAIT_SPAN = 2600;
const SIGNAL_WINDOW = 1700;
const SCORE_MS = 1300;
const WIN_POINTS = 100;
const FALSE_START_POINTS = -30;

function waitFor(rng) {
  return WAIT_MIN + Math.floor(rng() * WAIT_SPAN);
}

export const reaction = {
  id: "reaction",
  name: "信号抢点",
  tagline: "灯一亮就按，抢跑扣分",
  rounds: 5,
  minSeats: 1,
  maxSeats: 8,

  create({ seats, rng, now, rounds = 5 }) {
    const state = {
      seatIds: seats.map((seat) => seat.id),
      scores: {},
      lastGain: {},
      rng,
      roundIndex: 0,
      rounds,
      phase: "waiting",
      phaseStart: now,
      phaseUntil: now + waitFor(rng),
      falseStarts: [],
      winner: null,
    };
    for (const id of state.seatIds) {
      state.scores[id] = 0;
      state.lastGain[id] = 0;
    }
    return state;
  },

  intent(state, { seatId, button, at }) {
    if (button !== "a" || !state.seatIds.includes(seatId)) return;

    if (state.phase === "waiting") {
      if (state.falseStarts.includes(seatId)) return;
      state.falseStarts = [...state.falseStarts, seatId];
      state.scores[seatId] += FALSE_START_POINTS;
      state.lastGain[seatId] = FALSE_START_POINTS;
      return;
    }

    if (state.phase !== "signal" || state.winner) return;
    if (state.falseStarts.includes(seatId)) return;
    state.winner = seatId;
    state.scores[seatId] += WIN_POINTS;
    state.lastGain[seatId] = WIN_POINTS;
    state.phase = "scored";
    state.phaseStart = at;
    state.phaseUntil = at + SCORE_MS;
  },

  tick(state, now) {
    if (now < state.phaseUntil) return;
    if (state.phase === "waiting") {
      state.phase = "signal";
      state.phaseStart = state.phaseUntil;
      state.phaseUntil = state.phaseStart + SIGNAL_WINDOW;
      return;
    }
    if (state.phase === "signal") {
      state.phase = "scored";
      state.phaseStart = now;
      state.phaseUntil = now + SCORE_MS;
      return;
    }
    if (state.phase === "scored") {
      state.roundIndex += 1;
      state.falseStarts = [];
      state.winner = null;
      for (const id of state.seatIds) state.lastGain[id] = 0;
      if (state.roundIndex >= state.rounds) {
        state.phase = "done";
        state.phaseStart = now;
        state.phaseUntil = now;
        return;
      }
      state.phase = "waiting";
      state.phaseStart = now;
      state.phaseUntil = now + waitFor(state.rng);
    }
  },

  view(state, now) {
    return {
      id: "reaction",
      boardKey: `reaction:${state.roundIndex}:${state.phase}:${state.phaseStart}`,
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      remainingMs: Math.max(0, state.phaseUntil - now),
      phaseDuration: Math.max(1, state.phaseUntil - state.phaseStart),
      winner: state.winner,
      falseStarts: [...state.falseStarts],
      scores: { ...state.scores },
      lastGain: { ...state.lastGain },
    };
  },
};
