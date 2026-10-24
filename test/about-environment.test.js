'use strict';
// The About view's environment panel is plain DOM plus a handful of i18n keys.
// These checks keep the five locales in step with the facts the main process
// reports: a key present in only some languages would render as its own code,
// and only for the language that happened to miss it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const ENV_KEYS = ['envTitle', 'envCopy', 'envCopied', 'envApp', 'envElectron', 'envOs', 'envGpu', 'envGpuNone', 'envUi', 'envSkinOne', 'envSkinTwo'];

test('environment panel labels exist in every locale', () => {
  const i18n = read('src/renderer/i18n.js');
  for (const key of ENV_KEYS) {
    const count = (i18n.match(new RegExp(`['"]?${key}['"]?:`, 'g')) || []).length;
    assert.equal(count, 5, `${key} must be defined in all five locales`);
  }
});

test('environment-info reports the facts a diagnostics file opens with', () => {
  const session = read('src/main/ipc/session.js');
  assert.match(session, /ipcMain\.handle\('environment-info'/);
  assert.match(session, /ctx\.guards\.driverNames\(await ctx\.guards\.gpuInfo\(\)\)/);
  assert.match(session, /app\.getVersion\(\)/);
  const preload = read('preload.js');
  assert.match(preload, /environmentInfo: \(\) => ipcRenderer\.invoke\('environment-info'\)/);
});

test('the About view carries the environment panel and its copy button', () => {
  const html = read('src/renderer/index.html');
  assert.match(html, /id="envPanel"/);
  assert.match(html, /id="copyEnv"/);
  assert.match(html, /data-i18n="envTitle"/);
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /loadEnvironment\(\)/);
  assert.match(renderer, /window\.lab\.copyText\(text\)/);
  assert.match(renderer, /renderEnvironment\(envCache\)/);
});
