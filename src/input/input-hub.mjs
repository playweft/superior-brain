const GAMEPAD_BUTTONS = {
  0: "a",
  1: "b",
  2: "x",
  3: "y",
  4: "lt",
  5: "rt",
  9: "start",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

const KEYBOARD_GROUPS = [
  {
    source: "key:1",
    label: "键盘 1",
    keys: {
      KeyW: "up",
      KeyS: "down",
      KeyA: "left",
      KeyD: "right",
      Space: "a",
      KeyF: "b",
    },
  },
  {
    source: "key:2",
    label: "键盘 2",
    keys: {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "a",
      NumpadEnter: "a",
      Backspace: "b",
    },
  },
];

const STICK_DEADZONE = 0.6;

const STICK_DIRECTIONS = [
  [0, -1, "left"],
  [0, 1, "right"],
  [1, -1, "up"],
  [1, 1, "down"],
];

function padLabel(id) {
  if (!id) return "手柄";
  const name = String(id).split("(")[0].trim();
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}

/**
 * Turns physical inputs into seat-scoped intents.
 *
 * Gamepads are sampled on every `poll`, keyboard and touch presses are queued
 * by the DOM handlers, so all input shares one clock with the game loop.
 */
export function createInputHub(options = {}) {
  const maxSeats = options.maxSeats ?? 8;
  const nav = options.navigator ?? globalThis.navigator;
  const view = options.window ?? globalThis;

  const bindings = new Map();
  const labels = new Map();
  const frames = new Map();
  const pending = [];
  const disconnects = [];
  const keyMap = new Map();

  for (const group of KEYBOARD_GROUPS) {
    labels.set(group.source, group.label);
    for (const [code, button] of Object.entries(group.keys)) {
      keyMap.set(code, { source: group.source, button });
    }
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const hit = keyMap.get(event.code);
    if (!hit) return;
    event.preventDefault();
    pending.push({ source: hit.source, button: hit.button, at: event.timeStamp });
  }

  view?.addEventListener?.("keydown", onKeyDown);

  function poll(at) {
    const events = [];
    const pads = nav?.getGamepads ? nav.getGamepads() : [];
    const live = new Set();

    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const source = `pad:${pad.index}`;
      live.add(source);
      if (!labels.has(source)) labels.set(source, padLabel(pad.id));
      const now = new Set();
      for (const [index, button] of Object.entries(GAMEPAD_BUTTONS)) {
        if (pad.buttons?.[index]?.pressed) now.add(button);
      }
      for (const [axis, sign, button] of STICK_DIRECTIONS) {
        if ((pad.axes?.[axis] ?? 0) * sign >= STICK_DEADZONE) now.add(button);
      }
      const before = frames.get(source) ?? new Set();
      frames.set(source, now);
      for (const button of now) {
        if (!before.has(button)) pending.push({ source, button, at });
      }
    }

    for (const source of [...frames.keys()]) {
      if (!live.has(source)) {
        frames.delete(source);
        disconnects.push(source);
      }
    }

    for (const press of pending.splice(0)) {
      const seatId = bindings.get(press.source);
      if (!seatId) {
        events.push({
          type: "join",
          source: press.source,
          label: labels.get(press.source) ?? "输入设备",
          at: press.at,
        });
        continue;
      }
      events.push({ type: "press", seatId, source: press.source, button: press.button, at: press.at });
    }

    for (const source of disconnects.splice(0)) {
      const seatId = bindings.get(source);
      labels.delete(source);
      frames.delete(source);
      if (seatId) events.push({ type: "leave", seatId, source, reason: "disconnected" });
    }

    return events;
  }

  return {
    poll,
    maxSeats,
    isFull: () => bindings.size >= maxSeats,
    bind(seatId, source) {
      bindings.set(source, seatId);
      if (!labels.has(source)) labels.set(source, "输入设备");
    },
    unbind(seatId) {
      for (const [source, bound] of [...bindings]) {
        if (bound === seatId) bindings.delete(source);
      }
    },
    label: (source) => labels.get(source) ?? "输入设备",
    touch(button, at = view?.performance?.now?.() ?? 0) {
      pending.push({ source: "touch", button, at });
    },
    sourceOf(seatId) {
      for (const [source, bound] of bindings) if (bound === seatId) return source;
      return null;
    },
    destroy() {
      view?.removeEventListener?.("keydown", onKeyDown);
    },
  };
}
