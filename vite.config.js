import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import { normalizeBasePath } from "./build/vite/base-path.js";

function emitPlayweftPackage(base, outDir) {
  // Cloudflare reads _headers from the upload root, which is dist/ for the site
  // root and dist/../ for a sub-path build (outDir is dist/<base>).
  const uploadRoot = base === "/" ? outDir : resolve(outDir, "..");
  const files = [
    "playweft.json",
    "icon.svg",
  ];
  return {
    name: "emit-playweft-package",
    apply: "build",
    async buildStart() {
      // outDir is nested under dist/ for a sub-path build, so Vite would only
      // empty the nested folder and leave the previous build at the upload root.
      await rm(new URL("./dist", import.meta.url), { recursive: true, force: true });
    },
    async generateBundle() {
      for (const fileName of files) {
        let source = await readFile(new URL(`./public/${fileName}`, import.meta.url));
        if (fileName === "playweft.json") {
          const manifest = JSON.parse(source.toString());
          manifest.id = base;
          source = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
        }
        this.emitFile({
          type: "asset",
          fileName,
          source,
        });
      }
    },
    async closeBundle() {
      await writeFile(
        resolve(uploadRoot, "_headers"),
        await readFile(new URL("./public/_headers", import.meta.url)),
      );
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const base = command === "build"
    ? normalizeBasePath(loadEnv(mode, import.meta.dirname, "BASE_PATH").BASE_PATH)
    : "/";
  const outDir = base === "/" ? "dist" : `dist/${base.slice(1, -1)}`;
  return {
    base,
    publicDir: false,
    plugins: [emitPlayweftPackage(base, outDir)],
    build: { outDir },
  };
});
