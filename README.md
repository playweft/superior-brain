# Superior Brain / 较强大脑

同屏聚会脑力游戏合集：**1–8 人共用一块屏幕**，每人一个手柄（或键盘 / 触屏）各自作答。当前只有单人（同屏）模式，玩法全部为非语言类。

## 玩法

每个玩法都是限时多轮，结束时按本局得分排名，总积分跨局累计。

| 玩法 | 能力 | 规则 |
| --- | --- | --- |
| 信号抢点 | 反应 | 灯亮之前按 A 算抢跑（−30），亮起后第一个按 A 的人 +100 |
| 色字干扰 | 注意 | 只按**字的颜色**作答（A 绿 / B 红 / X 蓝 / Y 黄），答对 100 分加最多 40 的速度奖励 |
| 记忆矩阵 | 记忆 | 图案闪现 1.7 秒后消失，从四张候选里挑出刚才那张（3×3 → 4×4） |
| 数字方格 | 操作 | 每人一张方格，用方向键移动光标、A 确认，按 1 → 9（或 16）顺序点完，先完成者 100 / 60 / 30 / 10 分 |

## 操作

| 设备 | 加入 | A | B | 方向 |
| --- | --- | --- | --- | --- |
| 手柄 | 按任意键 | A 键 | B 键 | 十字键或左摇杆（每次推动走一格） |
| 键盘玩家 1 | 按 W/A/S/D/空格/F 任一键 | 空格 | F | W A S D |
| 键盘玩家 2 | 按方向键/回车/退格任一键 | 回车 | 退格 | ↑ ← ↓ → |
| 触屏 | 点击「点这里加入」 | 屏幕上的 A | 屏幕上的 B | 屏幕上的方向键 |

大厅里 ↑↓ 换玩法、A 开始、B 退出；结果页 A 回到选单、X 清零总积分。最多 8 个座位，数字方格每局最多 4 人，多出来的人自动成为观战者。

浏览器要求「先有一次用户手势才暴露手柄」，所以加入流程本身就是按键加入，正好符合聚会的手感。手柄断开会自动释放座位。

## 结构

```text
index.html               只有一个挂载点，界面全部由脚本渲染
src/main.js              Playweft bridge、输入轮询、渲染循环
src/input/input-hub.mjs  键盘 / 手柄 / 触屏 → 座位级的 press 事件
src/party/session.mjs    座位、选单、计分、回合推进
src/games/*.mjs          四个玩法引擎（纯逻辑，无 DOM）
src/ui/render.mjs        按状态渲染界面，进度条每帧单独更新
public/playweft.json     Manifest（当前只声明 solo）
```

引擎是纯函数式的：`create` / `intent` / `tick` / `view` 都不碰 DOM，时间从参数传入，随机数由注入的 `rng` 提供，因此可以在 Node 里确定性地测试。同屏聚会属于"一台设备一个会话"，所以不需要 Playweft 房间和 Lua。

## 本地开发

```sh
npm install
npm run dev      # 本地试玩
npm test         # 引擎、输入、会话的单元测试
npm run smoke    # 用无头 Chrome 跑一遍全部玩法阶段 + 首屏渲染
npm run check    # test + build + smoke
npm run build
```

`npm run smoke` 需要本机有 Chrome 或 Chromium，找不到时会跳过（可用 `CHROME_PATH` 指定）。

## 部署

```sh
npx wrangler deploy
```

Cloudflare Workers 的构建命令为 `npm run build`，静态资源目录固定 `./dist`。设置 `BASE_PATH=/superior-brain/` 可部署到子路径，此时游戏包输出到 `dist/superior-brain/`，`playweft.json` 的 `id` 与资源地址同步带上前缀，`_headers` 保留在发布根 `dist/_headers`。每次构建都会先清空 `dist/`，切换路径不会残留旧文件。

## 已知限制与后续

- 手柄的左右扳机、振动反馈还没接；移动端浏览器对手柄支持参差，所以键盘和触屏是必备兜底。
- 观战者目前只能看，不能中途加入正在进行的这一局。
- 语言类玩法（成语、诗词）和联机房间模式都还没做；房间模式恢复时需要在 Manifest 里重新加上 `modes.room` 与 `public/game.lua`。
