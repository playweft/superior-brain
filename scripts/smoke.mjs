import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "vite";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.log(
    "smoke: skipped, no Chrome or Chromium found (set CHROME_PATH to run it)",
  );
  process.exit(0);
}

function runChrome(url, budget) {
  return new Promise((resolve) => {
    const child = spawn(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--virtual-time-budget=${budget}`,
      "--dump-dom",
      url,
    ]);
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("close", () => resolve(out));
  });
}

const section = (html, pattern) => html.match(pattern)?.[1] ?? "";

const server = await createServer({
  logLevel: "silent",
  server: { host: "127.0.0.1", port: 0 },
});
await server.listen();
const origin = server.resolvedUrls.local[0].replace(/\/$/, "");

const failures = [];
try {
  const harness = await runChrome(`${origin}/tests/smoke.html`, 4000);
  const title = section(harness, /<title>(.*?)<\/title>/s);
  if (title !== "SMOKE OK") {
    const detail = section(harness, /<pre id="out">(.*?)<\/pre>/s);
    failures.push(`game loop harness: ${title || "no title"}\n${detail}`);
  }

  const app = await runChrome(`${origin}/index.html`, 3000);
  const lobby = section(app, /<main id="app" class="app">(.*?)<\/main>/s);
  for (const needle of ["较强大脑", "信号抢点", "色字干扰", "记忆矩阵", "数字方格"]) {
    if (!lobby.includes(needle)) failures.push(`lobby is missing "${needle}"`);
  }
} finally {
  await server.close();
}

if (failures.length) {
  console.error("smoke: FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("smoke: OK (harness phases + lobby render)");
