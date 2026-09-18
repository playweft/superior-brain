import { GAMES } from "../games/index.mjs";

export const SEAT_COLORS = [
  "#e5484d",
  "#f2a63b",
  "#3fb950",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#ec4899",
  "#8b8f9c",
];

const MAX_SEATS = 8;

export function createSession({ rng = Math.random, maxSeats = MAX_SEATS } = {}) {
  return {
    rng,
    maxSeats: Math.min(maxSeats, MAX_SEATS),
    phase: "lobby",
    seats: [],
    selection: 0,
    game: null,
    state: null,
    participants: [],
    results: null,
    seatCounter: 0,
  };
}

export function seatOf(session, seatId) {
  return session.seats.find((seat) => seat.id === seatId) ?? null;
}

export function join(session, { source, label }) {
  if (session.seats.length >= session.maxSeats) return null;
  if (session.seats.some((seat) => seat.source === source)) return null;
  session.seatCounter += 1;
  const index = session.seatCounter - 1;
  const seat = {
    id: `seat-${session.seatCounter}`,
    name: `玩家 ${session.seatCounter}`,
    color: SEAT_COLORS[index % SEAT_COLORS.length],
    source,
    label: label ?? "输入设备",
    total: 0,
  };
  session.seats.push(seat);
  return seat.id;
}

export function leave(session, seatId) {
  const index = session.seats.findIndex((seat) => seat.id === seatId);
  if (index < 0) return;
  if (session.phase === "playing") return;
  session.seats.splice(index, 1);
  if (session.seats.length === 0) session.phase = "lobby";
}

export function moveSelection(session, delta) {
  if (session.phase !== "lobby") return;
  const count = GAMES.length;
  session.selection = (session.selection + delta + count) % count;
}

export function selectGame(session, index) {
  if (session.phase !== "lobby") return;
  if (index < 0 || index >= GAMES.length) return;
  session.selection = index;
}

export function resetTotals(session) {
  for (const seat of session.seats) seat.total = 0;
}

export function startSelected(session, now) {
  if (session.phase !== "lobby") return false;
  const game = GAMES[session.selection];
  const participants = session.seats.slice(0, game.maxSeats);
  if (participants.length < game.minSeats) return false;
  session.game = game;
  session.participants = participants.map((seat) => seat.id);
  session.results = null;
  session.state = game.create({
    seats: participants,
    rng: session.rng,
    now,
    rounds: game.rounds,
  });
  session.phase = "playing";
  return true;
}

function finish(session) {
  const scores = session.state.scores ?? {};
  for (const seat of session.seats) {
    seat.total += scores[seat.id] ?? 0;
  }
  const rows = session.seats
    .map((seat) => ({
      id: seat.id,
      name: seat.name,
      color: seat.color,
      spectator: !session.participants.includes(seat.id),
      gameScore: session.participants.includes(seat.id) ? (scores[seat.id] ?? 0) : null,
      total: seat.total,
    }))
    .sort((a, b) => {
      if (a.spectator !== b.spectator) return a.spectator ? 1 : -1;
      return (b.gameScore ?? 0) - (a.gameScore ?? 0);
    });
  session.results = { gameName: session.game.name, rows };
  session.phase = "results";
}

export function backToLobby(session) {
  session.phase = "lobby";
  session.state = null;
  session.game = null;
  session.participants = [];
}

export function intent(session, { seatId, button }, now) {
  const seat = seatOf(session, seatId);
  if (!seat) return;

  if (session.phase === "lobby") {
    if (button === "b") return leave(session, seatId);
    if (button === "up") return moveSelection(session, -1);
    if (button === "down") return moveSelection(session, 1);
    if (button === "a" || button === "start") return void startSelected(session, now);
    return;
  }

  if (session.phase === "results") {
    if (button === "b") return leave(session, seatId);
    if (button === "a" || button === "start") return backToLobby(session);
    if (button === "x") {
      resetTotals(session);
      return backToLobby(session);
    }
    return;
  }

  if (session.phase === "playing" && session.state) {
    session.game.intent(session.state, { seatId, button, at: now }, now);
  }
}

export function tick(session, now) {
  if (session.phase !== "playing" || !session.state) return;
  session.game.tick(session.state, now);
  if (session.state.phase === "done") finish(session);
}

/** A touch player may pick a menu entry directly instead of stepping through it. */
export function touchStart(session, index, now) {
  selectGame(session, index);
  return startSelected(session, now);
}

export function view(session, now) {
  const gameView =
    session.phase === "playing" && session.state
      ? session.game.view(session.state, now)
      : null;
  const seats = session.seats.map((seat) => {
    const gameScore = gameView?.scores?.[seat.id] ?? 0;
    return {
      id: seat.id,
      name: seat.name,
      color: seat.color,
      source: seat.source,
      label: seat.label,
      spectator:
        session.phase === "playing" && !session.participants.includes(seat.id),
      gameScore,
      lastGain: gameView?.lastGain?.[seat.id] ?? 0,
      total: seat.total + gameScore,
    };
  });
  const signature = [
    session.phase,
    session.selection,
    gameView?.boardKey ?? "",
    session.results ? session.results.rows.map((row) => `${row.id}:${row.gameScore}:${row.total}`).join(",") : "",
    seats.map((seat) => `${seat.id}:${seat.total}:${seat.lastGain}:${seat.spectator ? 1 : 0}`).join(","),
  ].join("|");

  return {
    phase: session.phase,
    seats,
    selection: session.selection,
    menu: GAMES.map((game) => ({
      id: game.id,
      name: game.name,
      tagline: game.tagline,
      minSeats: game.minSeats,
      maxSeats: game.maxSeats,
      rounds: game.rounds,
    })),
    game: gameView,
    results: session.results,
    signature,
  };
}
