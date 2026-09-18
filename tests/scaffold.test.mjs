import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeBasePath } from "../build/vite/base-path.js";

test("base path normalization keeps the site root portable", () => {
  assert.equal(normalizeBasePath(), "/");
  assert.equal(normalizeBasePath(""), "/");
  assert.equal(normalizeBasePath("/"), "/");
  assert.equal(normalizeBasePath("superior-brain"), "/superior-brain/");
  assert.equal(normalizeBasePath("/superior-brain/"), "/superior-brain/");
  assert.equal(normalizeBasePath("//superior-brain//"), "/superior-brain/");
});

test("the manifest ships a solo-only party package for now", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/playweft.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.name_localized["zh-CN"], "较强大脑");
  assert.ok(manifest.modes.solo);
  assert.equal(manifest.modes.room, undefined, "room mode returns with game.lua");
});
