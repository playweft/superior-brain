import { createInputHub } from "./input/input-hub.mjs";
import {
  createSession,
  intent,
  join,
  leave,
  selectGame,
  tick,
  touchStart,
  view,
} from "./party/session.mjs";
import { renderApp, setBridgeLabel, updateLive } from "./ui/render.mjs";

const root = document.getElementById("app");
const session = createSession({ maxSeats: 8 });
const hub = createInputHub({ maxSeats: 8, window, navigator });

let bridgeLabel = "本地试玩 · 未连接 Playweft";
let lastSignature = "";

/* ---------- Playweft bridge (solo package) ---------- */

function announceReady() {
  window.parent.postMessage({ type: "playweft:bridge-ready", version: 1 }, "*");
}
const bridgeProbe = window.setInterval(announceReady, 500);
announceReady();

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.data?.type !== "playweft:bridge")
    return;
  const [port] = event.ports;
  if (!port) return;
  window.clearInterval(bridgeProbe);

  const pending = new Map();
  const rpc = (method, params) =>
    new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      pending.set(id, { resolve, reject });
      port.postMessage({
        jsonrpc: "2.0",
        id,
        method,
        ...(params === undefined ? {} : { params }),
      });
    });

  port.onmessage = (message) => {
    const payload = message.data;
    if (payload?.jsonrpc !== "2.0" || !Object.hasOwn(payload, "id")) return;
    const task = pending.get(payload.id);
    if (!task) return;
    pending.delete(payload.id);
    if (payload.error) task.reject(new Error(payload.error.message));
    else task.resolve(payload.result);
  };
  port.start();

  rpc("game.initialize")
    .then((context) => {
      const who = context.player?.name ? ` · ${context.player.name}` : "";
      bridgeLabel =
        context.mode === "room"
          ? `Playweft 房间（本版本只做同屏）${who}`
          : `Playweft 单人${who}`;
      lastSignature = "";
    })
    .catch((error) => {
      bridgeLabel = error.message;
      lastSignature = "";
    });
});

/* ---------- pointer input ---------- */

function joinTouchSeat() {
  const seatId = join(session, { source: "touch", label: "触屏" });
  if (seatId) hub.bind(seatId, "touch");
}

root.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-join]")) joinTouchSeat();
});

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-button], [data-select]");
  if (!target) return;
  if (target.dataset.select !== undefined) {
    const index = Number(target.dataset.select);
    const touchSeat = session.seats.find((seat) => seat.source === "touch");
    if (touchSeat && session.phase === "lobby") touchStart(session, index, performance.now());
    else selectGame(session, index);
    return;
  }
  hub.touch(target.dataset.button, performance.now());
});

/* ---------- loop ---------- */

function paint(model) {
  if (model.signature === lastSignature) return;
  renderApp(root, model);
  setBridgeLabel(root, bridgeLabel);
  lastSignature = model.signature;
}

function frame(now) {
  for (const event of hub.poll(now)) {
    if (event.type === "join") {
      const seatId = join(session, { source: event.source, label: event.label });
      if (seatId) hub.bind(seatId, event.source);
      continue;
    }
    if (event.type === "leave") {
      leave(session, event.seatId);
      hub.unbind(event.seatId);
      continue;
    }
    intent(session, { seatId: event.seatId, button: event.button }, now);
  }

  tick(session, now);
  const model = view(session, now);
  paint(model);
  updateLive(root, model);
  requestAnimationFrame(frame);
}

// Paint the lobby before the first frame so a stalled rAF never shows a blank app.
paint(view(session, performance.now()));
requestAnimationFrame(frame);
