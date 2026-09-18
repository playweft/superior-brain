import { STROOP_COLORS } from "../games/stroop.mjs";

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
const key = (button) => button.toUpperCase();
const ratio = (game) =>
  Math.max(0, Math.min(100, (game.remainingMs / game.phaseDuration) * 100));

function bar(game) {
  return `<div class="bar"><span data-bar style="width:${ratio(game).toFixed(1)}%"></span></div>`;
}

function countdown(game) {
  return `<p class="countdown" data-countdown>${(game.remainingMs / 1000).toFixed(1)}s</p>`;
}

function seatName(model, seatId) {
  return model.seats.find((seat) => seat.id === seatId)?.name ?? "玩家";
}

function seatColor(model, seatId) {
  return model.seats.find((seat) => seat.id === seatId)?.color ?? "#8b8f9c";
}

function miniGrid(size, litCells) {
  const lit = new Set(litCells);
  const cells = Array.from(
    { length: size * size },
    (_, index) => `<span class="${lit.has(index) ? "is-lit" : ""}"></span>`,
  );
  return `<div class="mini-grid" style="--n:${size}">${cells.join("")}</div>`;
}

function participantRow(model, mark) {
  return `<ul class="answer-row">${model.seats
    .map((seat) => {
      const info = mark(seat);
      return `<li style="--c:${seat.color}"><i></i>${esc(seat.name)}${
        info ? `<em class="${info.tone}">${esc(info.text)}</em>` : ""
      }</li>`;
    })
    .join("")}</ul>`;
}

function boardHtml(game, model) {
  if (game.id === "reaction") {
    const winner = game.winner ? model.seats.find((seat) => seat.id === game.winner) : null;
    const label =
      game.phase === "waiting"
        ? "准备…"
        : game.phase === "signal"
          ? "抢！"
          : winner
            ? `${winner.name} 抢到 +100`
            : "没人抢到";
    return `<div class="board reaction" data-state="${game.phase}">
      <div class="orb">${game.phase === "waiting" ? "…" : game.phase === "signal" ? "抢" : "✓"}</div>
      <p class="board-text">${winner ? `<b style="color:${winner.color}">${esc(winner.name)}</b> 抢到 +100` : esc(label)}</p>
      ${
        game.falseStarts.length
          ? `<p class="board-warn">抢跑：${game.falseStarts.map((id) => esc(seatName(model, id))).join("、")} −30</p>`
          : ""
      }
      ${bar(game)}${countdown(game)}
    </div>`;
  }

  if (game.id === "stroop") {
    return `<div class="board stroop">
      <p class="board-hint">按<b>字的颜色</b>作答，不要管它写的是什么</p>
      <div class="stroop-word" style="color:${game.question.inkHex}">${esc(game.question.word)}</div>
      <ul class="stroop-options">${STROOP_COLORS.map(
        (color) =>
          `<li data-button="${color.button}" style="--c:${color.hex}"${
            game.reveal && color.button === game.question.answerButton ? ' class="is-correct"' : ""
          }><b>${key(color.button)}</b>${color.label}</li>`,
      ).join("")}</ul>
      ${participantRow(model, (seat) => {
        const answer = game.answers[seat.id];
        if (!answer) return { text: "…", tone: "wait" };
        return { text: `${key(answer.button)} ${answer.correct ? "✓" : "✗"}`, tone: answer.correct ? "good" : "bad" };
      })}
      ${bar(game)}${countdown(game)}
    </div>`;
  }

  if (game.id === "recall") {
    if (game.phase === "flash") {
      return `<div class="board recall">
        <p class="board-hint">记住亮起的格子</p>
        ${miniGrid(game.size, game.lit)}
        ${bar(game)}${countdown(game)}
      </div>`;
    }
    return `<div class="board recall">
      <p class="board-hint">哪一张是刚才的图案？</p>
      <ul class="recall-options">${game.options
        .map(
          (option) => `<li data-button="${option.key}" class="${
            game.reveal ? (option.key === game.answerKey ? "is-correct" : "is-wrong") : ""
          }"><b>${key(option.key)}</b>${miniGrid(game.size, option.cells)}</li>`,
        )
        .join("")}</ul>
      ${participantRow(model, (seat) => {
        const pick = game.picks[seat.id];
        if (!pick) return { text: "…", tone: "wait" };
        return { text: `${key(pick.key)} ${pick.correct ? "✓" : "✗"}`, tone: pick.correct ? "good" : "bad" };
      })}
      ${bar(game)}${countdown(game)}
    </div>`;
  }

  if (game.id === "gridrace") {
    return `<div class="board gridrace">
      <p class="board-hint">方向键移动，<b>A</b> 点数字，按 1 → ${game.size * game.size} 顺序点完</p>
      <div class="race">
        ${game.boards
          .map((board) => {
            const cells = Array.from({ length: game.size * game.size }, (_, index) => {
              const classes = [
                index === board.cursor ? "is-cursor" : "",
                board.cells[index] === board.next ? "is-target" : "",
                index === board.cursor && board.cells[index] === board.next ? "is-hit" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `<span class="${classes}">${board.cells[index]}</span>`;
            }).join("");
            return `<div class="race-board${board.finished ? " is-done" : ""}${
              board.locked ? " is-locked" : ""
            }" style="--c:${seatColor(model, board.id)}">
              <header><i></i>${esc(seatName(model, board.id))}<em>${
                board.finished ? "完成" : `${board.next - 1}/${board.total}`
              }</em></header>
              <div class="race-grid" style="--n:${game.size}">${cells}</div>
            </div>`;
          })
          .join("")}
      </div>
      ${game.ranks.length ? participantRow(model, (seat) => {
        const place = game.ranks.indexOf(seat.id);
        if (place < 0) return { text: "观战", tone: "wait" };
        return { text: `第 ${place + 1} 名`, tone: place === 0 ? "good" : "wait" };
      }) : ""}
      ${bar(game)}${countdown(game)}
    </div>`;
  }

  return `<div class="board"><p class="board-text">还没有玩法</p></div>`;
}

function hudHtml(model) {
  const game = model.game;
  return `<header class="hud">
    <div class="hud-head">
      <b>${esc(model.menu.find((item) => item.id === game.id)?.name ?? game.id)}</b>
      <span>${game.phase === "done" ? "结算…" : `第 ${game.roundIndex + 1} / ${game.rounds} 轮`}</span>
    </div>
    <ul class="hud-seats">${model.seats
      .map((seat) => {
        const gain =
          seat.lastGain !== 0
            ? `<em class="${seat.lastGain > 0 ? "up" : "down"}">${seat.lastGain > 0 ? "+" : ""}${seat.lastGain}</em>`
            : "";
        return `<li class="${seat.spectator ? "is-spectator" : ""}" style="--c:${seat.color}">
          <i></i><span>${esc(seat.name)}</span>${gain}<b>${seat.total}</b>
          ${seat.spectator ? "<small>观战</small>" : ""}
        </li>`;
      })
      .join("")}</ul>
  </header>`;
}

function touchPadHtml(model) {
  const touchSeat = model.seats.find((seat) => seat.source === "touch");
  if (!touchSeat) return "";
  return `<div class="touch-pad" aria-label="触屏操作">
    <div class="dpad">
      <button data-button="up" aria-label="上">▲</button>
      <button data-button="left" aria-label="左">◀</button>
      <button data-button="right" aria-label="右">▶</button>
      <button data-button="down" aria-label="下">▼</button>
    </div>
    <div class="face">
      <button data-button="a" class="face-a">A</button>
      <button data-button="b" class="face-b">B</button>
      <button data-button="x" class="face-x">X</button>
      <button data-button="y" class="face-y">Y</button>
    </div>
  </div>`;
}

function playHtml(model) {
  return `<section class="screen play">
    ${hudHtml(model)}
    <div class="board-wrap">${boardHtml(model.game, model)}</div>
    ${touchPadHtml(model)}
  </section>`;
}

function lobbyHtml(model) {
  const seats = model.seats.length
    ? model.seats
        .map(
          (seat) =>
            `<li style="--c:${seat.color}"><i></i><b>${esc(seat.name)}</b><small>${esc(seat.label)}</small></li>`,
        )
        .join("")
    : `<li class="empty">还没有人加入</li>`;
  const ready = model.seats.length > 0;
  return `<section class="screen lobby">
    <p class="eyebrow">SUPERIOR BRAIN</p>
    <h1>较强大脑</h1>
    <p class="join-hint">按<b>手柄任意键</b>加入 · 键盘 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>+<kbd>空格</kbd> · <kbd>↑←↓→</kbd>+<kbd>回车</kbd> · 或点击屏幕</p>
    <ul class="seats">${seats}</ul>
    <ol class="menu">${model.menu
      .map(
        (game, index) => `<li class="${index === model.selection ? "is-active" : ""}" data-select="${index}">
          <b>${esc(game.name)}</b><small>${esc(game.tagline)}</small><span>${game.rounds} 轮 · 最多 ${game.maxSeats} 人</span>
        </li>`,
      )
      .join("")}</ol>
    <p class="screen-hint">${ready ? "↑↓ 换玩法，A 开始，B 退出" : "先让至少一位玩家加入"}</p>
    <button class="join-button" data-join>点这里加入（触屏）</button>
    <p class="bridge" data-role="bridge"></p>
  </section>`;
}

function resultsHtml(model) {
  const results = model.results;
  return `<section class="screen results">
    <p class="eyebrow">本局结果</p>
    <h1>${esc(results.gameName)}</h1>
    <ol class="rank">${results.rows
      .map((row, index) => {
        const medal = ["🥇", "🥈", "🥉"][index] ?? `${index + 1}`;
        return `<li style="--c:${row.color}" class="${row.spectator ? "is-spectator" : ""}">
          <span class="medal">${row.spectator ? "—" : medal}</span>
          <i></i><b>${esc(row.name)}</b>
          <span class="rank-score">${row.gameScore === null ? "观战" : row.gameScore}</span>
          <span class="rank-total">总 ${row.total}</span>
        </li>`;
      })
      .join("")}</ol>
    <p class="screen-hint">A 返回选单 · X 清零总积分 · B 退出</p>
  </section>`;
}

export function renderApp(root, model) {
  if (model.phase === "lobby") root.innerHTML = lobbyHtml(model);
  else if (model.phase === "results") root.innerHTML = resultsHtml(model);
  else root.innerHTML = playHtml(model);
}

export function updateLive(root, model) {
  if (model.phase !== "playing" || !model.game) return;
  const width = `${ratio(model.game).toFixed(1)}%`;
  for (const node of root.querySelectorAll("[data-bar]")) node.style.width = width;
  const text = `${(model.game.remainingMs / 1000).toFixed(1)}s`;
  for (const node of root.querySelectorAll("[data-countdown]")) node.textContent = text;
}

export function setBridgeLabel(root, text) {
  const node = root.querySelector('[data-role="bridge"]');
  if (node) node.textContent = text;
}
