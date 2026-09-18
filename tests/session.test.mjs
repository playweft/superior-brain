import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backToLobby,
  createSession,
  intent,
  join,
  leave,
  moveSelection,
  resetTotals,
  startSelected,
  tick,
  view,
} from "../src/party/session.mjs";

const constant = (value) => () => value;

function seatedSession(count, rng = constant(0.5)) {
  const session = createSession({ rng });
  const ids = Array.from({ length: count }, (_, index) =>
    join(session, { source: `pad:${index}`, label: `Pad ${index}` }),
  );
  return { session, ids };
}

test("seats get their own colour and cannot be claimed twice", () => {
  const session = createSession({ rng: constant(0.5) });
  const first = join(session, { source: "pad:0", label: "Pad 0" });
  const second = join(session, { source: "pad:1", label: "Pad 1" });
  assert.equal(session.seats.length, 2);
  assert.notEqual(session.seats[0].color, session.seats[1].color);
  assert.equal(join(session, { source: "pad:0", label: "Pad 0 again" }), null);

  leave(session, second);
  assert.deepEqual(session.seats.map((seat) => seat.id), [first]);
});

test("the lobby menu wraps and starts the selected game", () => {
  const { session, ids } = seatedSession(2);
  moveSelection(session, -1);
  const selection = view(session, 0).selection;
  assert.equal(selection, 3, "up from the first entry wraps to the last game");

  startSelected(session, 0);
  assert.equal(session.phase, "playing");
  assert.equal(session.participants.length, 2);
  assert.deepEqual(session.participants, ids);
});

test("scores accumulate across games and rank the results", () => {
  const { session, ids } = seatedSession(2);
  assert.ok(startSelected(session, 0));

  // Reaction game: seat 2 false starts, then seat 1 wins the signal round.
  intent(session, { seatId: ids[1], button: "a" }, 500);
  assert.equal(session.state.scores[ids[1]], -30);
  tick(session, session.state.phaseUntil);
  assert.equal(session.state.phase, "signal");
  intent(session, { seatId: ids[0], button: "a" }, session.state.phaseStart + 10);
  assert.equal(session.state.winner, ids[0]);

  const engine = session.state;
  for (let round = 0; round < session.game.rounds; round += 1) {
    tick(session, engine.phaseUntil);
    tick(session, engine.phaseUntil);
    tick(session, engine.phaseUntil);
  }

  assert.equal(session.phase, "results");
  assert.equal(session.results.rows[0].id, ids[0]);
  assert.equal(session.results.rows[0].gameScore, 100);
  assert.equal(session.results.rows[1].gameScore, -30);
  assert.equal(session.seats.find((seat) => seat.id === ids[1]).total, -30);

  backToLobby(session);
  assert.equal(session.phase, "lobby");
  const model = view(session, 0);
  assert.equal(model.seats[0].total, 100, "totals survive returning to the menu");

  intent(session, { seatId: ids[0], button: "x" }, 10);
  assert.equal(session.phase, "lobby");

  resetTotals(session);
  assert.deepEqual(
    view(session, 0).seats.map((seat) => seat.total),
    [0, 0],
  );
});

test("players are seated only up to the game's limit and the rest spectate", () => {
  const { session, ids } = seatedSession(6);
  const gridraceIndex = view(session, 0).menu.findIndex((game) => game.id === "gridrace");
  session.selection = gridraceIndex;
  assert.ok(startSelected(session, 0));
  assert.equal(session.participants.length, 4);

  const model = view(session, 100);
  const spectators = model.seats.filter((seat) => seat.spectator);
  assert.deepEqual(
    spectators.map((seat) => seat.id),
    [ids[4], ids[5]],
  );
  assert.equal(model.game.boards.length, 4);
});

test("leaving mid-game is ignored so the running match stays valid", () => {
  const { session, ids } = seatedSession(2);
  startSelected(session, 0);
  leave(session, ids[0]);
  assert.equal(session.seats.length, 2);
  backToLobby(session);
  leave(session, ids[0]);
  assert.equal(session.seats.length, 1);
});
