const LEVELS = [
  { size: 3, lit: 4 },
  { size: 3, lit: 4 },
  { size: 3, lit: 5 },
  { size: 4, lit: 6 },
  { size: 4, lit: 6 },
];

const FLASH_MS = 1700;
const CHOOSE_MS = 3600;
const FEEDBACK_MS = 1200;
const BASE_POINTS = 100;
const SPEED_POINTS = 40;
const KEYS = ["a", "b", "x", "y"];

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function keyOf(cells) {
  return [...cells].sort((a, b) => a - b).join(",");
}

function mutate(cells, total, rng, diff) {
  const next = new Set(cells);
  const inside = shuffle([...cells], rng);
  const outside = shuffle(
    [...Array(total).keys()].filter((index) => !cells.has(index)),
    rng,
  );
  for (let i = 0; i < diff; i += 1) {
    if (inside[i] === undefined || outside[i] === undefined) break;
    next.delete(inside[i]);
    next.add(outside[i]);
  }
  return next;
}

function makeQuestion(level, rng, id) {
  const total = level.size * level.size;
  const truth = new Set(shuffle([...Array(total).keys()], rng).slice(0, level.lit));
  const seen = new Set([keyOf(truth)]);
  const wrong = [];
  for (let diff = 1; diff <= 2 && wrong.length < 3; diff += 1) {
    for (let attempt = 0; attempt < 40 && wrong.length < 3; attempt += 1) {
      const candidate = mutate(truth, total, rng, diff);
      const key = keyOf(candidate);
      if (key === keyOf(truth) || seen.has(key)) continue;
      seen.add(key);
      wrong.push(candidate);
    }
  }

  const keys = shuffle(KEYS, rng);
  while (wrong.length < 3) wrong.push(mutate(truth, total, rng, 1));
  const options = keys.map((key, index) => ({
    key,
    cells: index === 0 ? truth : wrong[index - 1],
  }));
  return {
    id,
    size: level.size,
    lit: [...truth].sort((a, b) => a - b),
    options,
    answerKey: keys[0],
  };
}

function nextQuestion(state, now) {
  const level = LEVELS[Math.min(state.roundIndex, LEVELS.length - 1)];
  state.question = makeQuestion(level, state.rng, `${state.roundIndex}-${now}`);
  state.picks = {};
  state.phase = "flash";
  state.phaseStart = now;
  state.phaseUntil = now + FLASH_MS;
  for (const id of state.seatIds) state.lastGain[id] = 0;
}

export const recall = {
  id: "recall",
  name: "记忆矩阵",
  tagline: "记住亮起的格子，再挑出它",
  rounds: LEVELS.length,
  minSeats: 1,
  maxSeats: 8,

  create({ seats, rng, now, rounds = LEVELS.length }) {
    const state = {
      seatIds: seats.map((seat) => seat.id),
      scores: {},
      lastGain: {},
      rng,
      roundIndex: 0,
      rounds,
      question: null,
      picks: {},
      phase: "flash",
      phaseStart: now,
      phaseUntil: now,
    };
    for (const id of state.seatIds) {
      state.scores[id] = 0;
      state.lastGain[id] = 0;
    }
    nextQuestion(state, now);
    return state;
  },

  intent(state, { seatId, button, at }) {
    if (state.phase !== "choose" || !state.seatIds.includes(seatId)) return;
    if (state.picks[seatId]) return;
    if (!KEYS.includes(button)) return;
    const remaining = Math.max(0, state.phaseUntil - at);
    const correct = button === state.question.answerKey;
    const points = correct
      ? BASE_POINTS + Math.round((SPEED_POINTS * remaining) / CHOOSE_MS)
      : 0;
    state.picks[seatId] = { key: button, correct, points };
    if (correct) {
      state.scores[seatId] += points;
      state.lastGain[seatId] = points;
    }
    if (state.seatIds.every((id) => state.picks[id])) {
      state.phase = "feedback";
      state.phaseStart = at;
      state.phaseUntil = at + FEEDBACK_MS;
    }
  },

  tick(state, now) {
    if (now < state.phaseUntil) return;
    if (state.phase === "flash") {
      state.phase = "choose";
      state.phaseStart = state.phaseUntil;
      state.phaseUntil = state.phaseStart + CHOOSE_MS;
      return;
    }
    if (state.phase === "choose") {
      // Reveal the right grid before moving on, even when nobody picked.
      state.phase = "feedback";
      state.phaseStart = now;
      state.phaseUntil = now + FEEDBACK_MS;
      return;
    }
    if (state.phase !== "feedback") return;
    state.roundIndex += 1;
    if (state.roundIndex >= state.rounds) {
      state.phase = "done";
      state.phaseStart = now;
      state.phaseUntil = now;
      return;
    }
    nextQuestion(state, now);
  },

  view(state, now) {
    return {
      id: "recall",
      boardKey: `recall:${state.roundIndex}:${state.phase}:${state.phaseStart}`,
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      remainingMs: Math.max(0, state.phaseUntil - now),
      phaseDuration: Math.max(1, state.phaseUntil - state.phaseStart),
      size: state.question.size,
      lit: state.question.lit,
      options:
        state.phase === "choose" || state.phase === "feedback"
          ? state.question.options.map((option) => ({
              key: option.key,
              cells: [...option.cells].sort((a, b) => a - b),
            }))
          : [],
      answerKey: state.phase === "feedback" ? state.question.answerKey : null,
      picks: { ...state.picks },
      scores: { ...state.scores },
      lastGain: { ...state.lastGain },
    };
  },
};
