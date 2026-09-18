export const STROOP_COLORS = [
  { button: "a", label: "绿", hex: "#3fb950" },
  { button: "b", label: "红", hex: "#e5484d" },
  { button: "x", label: "蓝", hex: "#3b82f6" },
  { button: "y", label: "黄", hex: "#f2c14e" },
];

const QUESTION_MS = 2600;
const FEEDBACK_MS = 1000;
const BASE_POINTS = 100;
const SPEED_POINTS = 40;
const ROUNDS = 6;
const INCONGRUENT_CHANCE = 0.75;

const byButton = new Map(STROOP_COLORS.map((color) => [color.button, color]));

function nextQuestion(state, now) {
  const word = STROOP_COLORS[Math.floor(state.rng() * STROOP_COLORS.length)];
  let ink = STROOP_COLORS[Math.floor(state.rng() * STROOP_COLORS.length)];
  if (state.rng() < INCONGRUENT_CHANCE && ink.button === word.button) {
    const offset = 1 + Math.floor(state.rng() * (STROOP_COLORS.length - 1));
    ink = STROOP_COLORS[(STROOP_COLORS.indexOf(ink) + offset) % STROOP_COLORS.length];
  }
  state.question = {
    word: word.label,
    inkHex: ink.hex,
    answerButton: ink.button,
    id: `${state.roundIndex}-${now}`,
  };
  state.answers = {};
  state.phase = "question";
  state.phaseStart = now;
  state.phaseUntil = now + QUESTION_MS;
  for (const id of state.seatIds) state.lastGain[id] = 0;
}

export const stroop = {
  id: "stroop",
  name: "色字干扰",
  tagline: "只看颜色，别读字",
  rounds: ROUNDS,
  minSeats: 1,
  maxSeats: 8,

  create({ seats, rng, now, rounds = ROUNDS }) {
    const state = {
      seatIds: seats.map((seat) => seat.id),
      scores: {},
      lastGain: {},
      rng,
      roundIndex: 0,
      rounds,
      question: null,
      answers: {},
      phase: "question",
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
    if (state.phase !== "question" || !state.seatIds.includes(seatId)) return;
    if (state.answers[seatId]) return;
    const color = byButton.get(button);
    if (!color) return;

    const remaining = Math.max(0, state.phaseUntil - at);
    const correct = button === state.question.answerButton;
    const points = correct
      ? BASE_POINTS + Math.round((SPEED_POINTS * remaining) / QUESTION_MS)
      : 0;
    state.answers[seatId] = { button, correct, points };
    if (correct) {
      state.scores[seatId] += points;
      state.lastGain[seatId] = points;
    }
    if (state.seatIds.every((id) => state.answers[id])) {
      state.phase = "feedback";
      state.phaseStart = at;
      state.phaseUntil = at + FEEDBACK_MS;
    }
  },

  tick(state, now) {
    if (now < state.phaseUntil) return;
    if (state.phase === "question") {
      // Always reveal the ink colour, even when nobody answered in time.
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
      id: "stroop",
      boardKey: `stroop:${state.roundIndex}:${state.phase}:${state.phaseStart}`,
      phase: state.phase,
      roundIndex: state.roundIndex,
      rounds: state.rounds,
      remainingMs: Math.max(0, state.phaseUntil - now),
      phaseDuration: Math.max(1, state.phaseUntil - state.phaseStart),
      question: { ...state.question },
      reveal: state.phase === "feedback",
      answers: { ...state.answers },
      options: STROOP_COLORS,
      scores: { ...state.scores },
      lastGain: { ...state.lastGain },
    };
  },
};
