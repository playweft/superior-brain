import { test } from "node:test";
import assert from "node:assert/strict";
import { createInputHub } from "../src/input/input-hub.mjs";

function fakeWindow() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
    removeEventListener(type) {
      handlers.delete(type);
    },
    key(code, timeStamp = 0, repeat = false) {
      handlers.get("keydown")?.({ code, repeat, timeStamp, preventDefault() {} });
    },
  };
}

function pad(index, id, pressed = [], axes = []) {
  const buttons = Array.from({ length: 17 }, (_, button) => ({
    pressed: pressed.includes(button),
  }));
  return { index, id, connected: true, buttons, axes };
}

test("gamepads join by pressing a button and then report presses", () => {
  const view = fakeWindow();
  const pads = [pad(0, "Pad A", [0])];
  const hub = createInputHub({ navigator: { getGamepads: () => pads }, window: view });

  const [join] = hub.poll(100);
  assert.equal(join.type, "join");
  assert.equal(join.source, "pad:0");
  assert.equal(join.label, "Pad A");

  hub.bind("seat-1", join.source);

  pads[0] = pad(0, "Pad A", []);
  assert.deepEqual(hub.poll(200), [], "a held button must not repeat");

  pads[0] = pad(0, "Pad A", [0]);
  const [press] = hub.poll(300);
  assert.equal(press.type, "press");
  assert.equal(press.seatId, "seat-1");
  assert.equal(press.button, "a");

  pads[0] = pad(0, "Pad A", [13, 9]);
  assert.deepEqual(
    hub.poll(400).map((event) => event.button),
    ["start", "down"],
  );

  pads.length = 0;
  const [leave] = hub.poll(500);
  assert.equal(leave.type, "leave");
  assert.equal(leave.seatId, "seat-1");
});

test("the left stick works as a d-pad with a dead zone", () => {
  const view = fakeWindow();
  const pads = [pad(0, "Pad A", [0], [0, 0])];
  const hub = createInputHub({ navigator: { getGamepads: () => pads }, window: view });
  const [join] = hub.poll(100);
  hub.bind("seat-1", join.source);
  pads[0] = pad(0, "Pad A", [], [0, 0]);
  hub.poll(200);

  pads[0] = pad(0, "Pad A", [], [0, 0.9]);
  assert.deepEqual(hub.poll(300).map((event) => event.button), ["down"]);

  pads[0] = pad(0, "Pad A", [], [0, 0.4]);
  assert.deepEqual(hub.poll(400), [], "drift inside the dead zone is ignored");

  pads[0] = pad(0, "Pad A", [], [-0.8, 0]);
  assert.deepEqual(hub.poll(500).map((event) => event.button), ["left"]);
});

test("long gamepad names are shortened for the seat list", () => {
  const view = fakeWindow();
  const pads = [pad(0, "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 02fd)", [0])];
  const hub = createInputHub({ navigator: { getGamepads: () => pads }, window: view });
  const [join] = hub.poll(100);
  assert.equal(join.label, "Xbox Wireless Con…");
});

test("keyboard players join as their own source and map to the same buttons", () => {
  const view = fakeWindow();
  const hub = createInputHub({ navigator: { getGamepads: () => [] }, window: view });

  view.key("Space", 10);
  assert.deepEqual(hub.poll(20), [
    { type: "join", source: "key:1", label: "键盘 1", at: 10 },
  ]);

  hub.bind("seat-1", "key:1");
  view.key("KeyW", 30);
  view.key("Space", 31);
  assert.deepEqual(
    hub.poll(40).map((event) => event.button),
    ["up", "a"],
  );

  view.key("ArrowRight", 50);
  const [join] = hub.poll(60);
  assert.equal(join.source, "key:2");
  assert.equal(hub.label("key:2"), "键盘 2");
});

test("seat bindings can be released and rebound", () => {
  const view = fakeWindow();
  const pads = [pad(0, "Pad A", [0])];
  const hub = createInputHub({
    navigator: { getGamepads: () => pads },
    window: view,
    maxSeats: 1,
  });

  const [join] = hub.poll(100);
  hub.bind("seat-1", join.source);
  assert.equal(hub.isFull(), true);
  assert.equal(hub.sourceOf("seat-1"), "pad:0");

  hub.unbind("seat-1");
  assert.equal(hub.isFull(), false);

  pads[0] = pad(0, "Pad A", []);
  hub.poll(200);
  pads[0] = pad(0, "Pad A", [1]);
  const [again] = hub.poll(300);
  assert.equal(again.type, "join", "an unbound pad can join a new seat");
});

test("touch presses enter through the same queue", () => {
  const view = fakeWindow();
  const hub = createInputHub({ navigator: { getGamepads: () => [] }, window: view });
  hub.touch("a", 55);
  hub.bind("seat-1", "touch");
  const [press] = hub.poll(60);
  assert.equal(press.seatId, "seat-1");
  assert.equal(press.button, "a");
  assert.equal(press.at, 55);
});
