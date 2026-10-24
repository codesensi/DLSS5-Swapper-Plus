'use strict';
// The About view's environment panel is plain DOM plus a handful of i18n keys.
// These checks keep the five locales in step with the facts the main process
// reports: a key present in only some languages would render as its own code,
// and only for the language that happened to miss it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { projectUrl } = require('../src/core/project-links');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const ENV_KEYS = ['envTitle', 'envCopy', 'envCopied', 'envApp', 'envElectron', 'envOs', 'envGpu', 'envGpuNone', 'envUi', 'envSkinOne', 'envSkinTwo', 'envHealth'];
const PROJECT_KEYS = ['projectTitle', 'updateTitle', 'updateCheckNow', 'updateLatest', 'reportIssue', 'thirdPartyNotices', 'aboutPrivacy'];

test('environment panel labels exist in every locale', () => {
  const i18n = read('src/renderer/i18n.js');
  for (const key of [...ENV_KEYS, ...PROJECT_KEYS]) {
    const count = (i18n.match(new RegExp(`['"]?${key}['"]?:`, 'g')) || []).length;
    assert.equal(count, 5, `${key} must be defined in all five locales`);
  }
});

test('report-an-issue is allowlisted next to the other project links', () => {
  assert.equal(projectUrl('issues'), 'https://github.com/codesensi/DLSS5-Swapper-Plus/issues');
  assert.equal(projectUrl('releases'), 'https://github.com/codesensi/DLSS5-Swapper-Plus/releases/latest');
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

test('the project card wires update check, issue link and the notices viewer', () => {
  const session = read('src/main/ipc/session.js');
  assert.match(session, /ipcMain\.handle\('third-party-notices'/);
  const preload = read('preload.js');
  assert.match(preload, /thirdPartyNotices: \(\) => ipcRenderer\.invoke\('third-party-notices'\)/);
  const html = read('src/renderer/index.html');
  assert.match(html, /id="checkUpdateBtn"/);
  assert.match(html, /data-project="issues"/);
  assert.match(html, /id="noticesOverlay"/);
  const renderer = read('src/renderer/renderer.js');
  assert.match(renderer, /updateInfo\.newer/);
  assert.match(renderer, /updateInfo\.latest/);
  assert.match(renderer, /bindProjectLink\(a\)/);
});
