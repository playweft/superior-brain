# Superior Brain / 较强大脑

一个可运行在 Playweft 上的游戏骨架，玩法尚未实现。当前只包含桥接、构建流程、界面外壳和双人房间的大厅状态机。

## 现状

- 单人模式：可以进入游戏界面，但只有占位内容。
- 双人房间：Lua 状态机只维持 `lobby` 阶段，所有动作返回 `NOT_IMPLEMENTED`。
- 尚未确定玩法、题目数据、回合与计分规则。

## 结构

```text
playweft.json   Manifest（单人 + 双人房间）
index.html      界面外壳
src/main.js     Playweft bridge 与界面状态
src/styles/     样式
public/game.lua 双人房间权威状态机（当前只有大厅）
public/_headers 跨域与缓存策略
build/vite/     BASE_PATH 归一化
tests/          自动测试
```

## 本地开发与部署

```sh
npm install
npm run dev      # 本地预览
npm test         # 运行自动测试
npm run build    # 生成 dist/
npx wrangler deploy
```

Vite 将 `public/` 中的 `playweft.json`、`game.lua` 和 `icon.svg` 原样复制到构建产物。Cloudflare Workers 的构建命令设为 `npm run build`，静态资源目录固定为 `./dist`。

### BASE_PATH

与 `hanzi-versus` 一致，设置 `BASE_PATH=/superior-brain/` 可部署到子路径；未设置时默认为 `/`。此时完整游戏包输出到 `dist/superior-brain/`，`playweft.json` 的 `id` 与资源地址都会带上相同前缀，`_headers` 保留在发布根目录 `dist/_headers`。每次构建都会先清空 `dist/`，切换路径不会遗留旧文件。

`public/_headers` 中的匹配路径写死了 `/superior-brain/`，如果改目录名，需要同步修改它。

## 后续

1. 在 `src/games/` 下实现玩法逻辑，界面接回 `index.html` 的 `#game`。
2. 在 `public/game.lua` 中把大厅扩展成完整回合制状态机，并按需更新 Manifest。
3. 如果需要 AI 出题或提示，可通过 Playweft 的 `languageModel.prompt` 能力实现，房主的客户端负责请求，Lua 只保存结果。
