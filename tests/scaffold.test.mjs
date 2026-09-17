import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeBasePath } from '../build/vite/base-path.js';

test('base path normalization keeps the site root portable', () => {
  assert.equal(normalizeBasePath(), '/');
  assert.equal(normalizeBasePath(''), '/');
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath('superior-brain'), '/superior-brain/');
  assert.equal(normalizeBasePath('/superior-brain/'), '/superior-brain/');
  assert.equal(normalizeBasePath('//superior-brain//'), '/superior-brain/');
});

test('the manifest declares both solo and two-player room modes', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/playweft.json', import.meta.url), 'utf8'),
  );
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.name_localized['zh-CN'], '较强大脑');
  assert.ok(manifest.modes.solo);
  assert.deepEqual(manifest.modes.room.players, { min: 2, max: 2 });
  assert.equal(manifest.modes.room.server.entry, './game.lua');
});

test('the room entry point exposes the platform hooks', async () => {
  const lua = await readFile(new URL('../public/game.lua', import.meta.url), 'utf8');
  for (const hook of ['function setup', 'function on_action', 'function view']) {
    assert.ok(lua.includes(hook), `${hook} is missing`);
  }
});
