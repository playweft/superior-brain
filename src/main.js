const $ = (selector) => document.querySelector(selector);
const ui = {
  startScreen: $("#start-screen"),
  startButton: $("#start-button"),
  startStatus: $("#start-status"),
  game: $("#game"),
  mode: $("#mode-label"),
  round: $("#round-label"),
  status: $("#status"),
  notice: $("#notice"),
};

let port;
let context;
let roomState;
const pending = new Map();

function announceReady() {
  window.parent.postMessage({ type: "playweft:bridge-ready", version: 1 }, "*");
}
const bridgeProbe = window.setInterval(announceReady, 500);
announceReady();

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || event.data?.type !== "playweft:bridge")
    return;
  const [candidate] = event.ports;
  if (!candidate) return;
  port = candidate;
  window.clearInterval(bridgeProbe);
  port.onmessage = onMessage;
  port.start();
  rpc("game.initialize")
    .then(startPlayweft)
    .catch((error) => {
      ui.startStatus.textContent = error.message;
    });
});

function rpc(method, params) {
  if (!port) return Promise.reject(new Error("Playweft bridge is unavailable"));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    port.postMessage({
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    });
  });
}

function onMessage(event) {
  const message = event.data;
  if (message?.jsonrpc !== "2.0") return;
  if (Object.hasOwn(message, "id")) {
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
    return;
  }
  if (message.method === "game.state") {
    roomState = message.params.state;
    renderRoom();
  }
}

function startPlayweft(initialContext) {
  context = initialContext;
  updateStartScreen();
  if (!ui.game.hidden) renderRoom();
}

function updateStartScreen() {
  if (!context) {
    ui.startStatus.textContent = "正在连接…";
    ui.startButton.disabled = true;
    return;
  }
  ui.mode.textContent = context.mode === "room" ? "双人房间" : "单人模式";
  ui.startStatus.textContent =
    context.mode === "room" ? "已连接，等待房间同步。" : "已连接，可以进入玩法界面。";
  ui.startButton.disabled = false;
}

function renderRoom() {
  if (!roomState) return;
  ui.round.textContent = roomState.round ? `第 ${roomState.round} 轮` : "大厅";
  ui.status.textContent =
    roomState.phase === "lobby"
      ? "房间已就绪，玩法尚未实现。"
      : `房间状态：${roomState.phase}`;
}

ui.startButton.addEventListener("click", () => {
  if (ui.startButton.disabled) return;
  ui.startScreen.hidden = true;
  ui.game.hidden = false;
  ui.status.textContent = "玩法尚未实现，这里是游戏界面骨架。";
  ui.notice.hidden = false;
  ui.notice.textContent = "下一步：在 src/games/ 下实现玩法，并在 public/game.lua 中补齐房间规则。";
  if (roomState) renderRoom();
});

// Static previews can start locally; embedded games wait for their bridge.
if (window.parent === window) {
  context = { mode: "solo" };
  updateStartScreen();
}
