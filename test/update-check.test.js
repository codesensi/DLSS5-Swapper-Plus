'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { createUpdate } = require('../src/main/update');

// The update lookup runs in the main process against the real GitHub endpoint.
// Here the network is a stub, so the test is about what the app concludes.
function load(t, { version = '2.2.1', fetchImpl } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-update-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const main = path.resolve(__dirname, '../main.js');
  const realRequire = createRequire(main);
  const handlers = new Map();
  const calls = { count: 0 };
  const stubs = {
    electron: {
      app: { setAppUserModelId() {}, whenReady: () => ({ then() {} }), on() {}, getPath: () => root, getVersion: () => version },
      BrowserWindow: { fromWebContents: () => null },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showMessageBox: async () => ({ response: 1 }) },
      clipboard: { writeText() {} }
    },
    './src/core/scan.js': { scanGame: async () => ({ chosen: null, exeCandidates: [] }), scanSource: () => ({ ok: false }) }
  };
  const context = vm.createContext({
    require: name => stubs[name] || realRequire(name),
    __dirname: path.dirname(main), process, Buffer, console, setTimeout, clearTimeout,
    AbortSignal,
    fetch: async (...args) => { calls.count++; calls.url = args[0]; return fetchImpl(...args); }
  });
  vm.runInContext(fs.readFileSync(main, 'utf8'), context, { filename: main });
  return { handlers, calls };
}

const release = (...tags) => ({
  ok: true,
  text: async () => tags.map((tag) =>
    `<entry><id>tag:github.com,2008:rel</id><link href="https://github.com/codesensi/DLSS5-Swapper-Plus/releases/tag/${tag}"/></entry>`
  ).join('')
});

test('a newer release is reported, an older or equal one is not', async (t) => {
  for (const [tag, newer] of [['v2.2.2', true], ['v2.3.0', true], ['v3.0.0', true],
    ['v2.2.1', false], ['v2.2.0', false], ['v2.10.0', true]]) {
    const { handlers } = load(t, { fetchImpl: async () => release(tag) });
    const answer = await handlers.get('update-check')();
    assert.equal(answer.newer, newer, `${tag} against 2.2.1`);
    assert.equal(answer.current, '2.2.1');
    assert.equal(answer.latest, tag.replace(/^v/, ''));
  }
});

test('the lookup happens once per launch', async (t) => {
  const { handlers, calls } = load(t, { fetchImpl: async () => release('v9.0.0') });
  const first = await handlers.get('update-check')();
  const second = await handlers.get('update-check')();
  assert.equal(first.newer, true);
  assert.deepEqual(second, first);
  assert.equal(calls.count, 1, 'the answer is kept for the session');
});

test('being offline, rate-limited or blocked says nothing at all', async (t) => {
  for (const fetchImpl of [
    async () => { throw new Error('getaddrinfo ENOTFOUND'); },
    async () => ({ ok: false, status: 403 }),
    async () => ({ ok: true, text: async () => '<feed><entry><id>none</id></entry></feed>' })
  ]) {
    const { handlers } = load(t, { fetchImpl });
    const answer = await handlers.get('update-check')();
    assert.equal(answer.newer, false, 'no notice is shown');
    assert.equal(answer.current, '2.2.1', 'and the running version is still reported');
  }
});

// A lookup that could not run reported {latest: null, newer: false}, which the
// sidebar rendered exactly like "nothing new". Someone on an old build whose
// check never completed was told nothing and had no reason to go and look.
test('a failed lookup is distinguishable from being up to date', () => {
  const failed = { current: '2.2.2', latest: null, newer: false };
  const current = { current: '2.2.3', latest: '2.2.3', newer: false };
  const behind = { current: '2.2.2', latest: '2.2.3', newer: true };

  // Exactly the branch order src/renderer/renderer.js uses.
  const shown = (a) => !a ? 'nothing' : !a.latest ? 'failed' : !a.newer ? 'nothing' : 'update';
  assert.equal(shown(failed), 'failed');
  assert.equal(shown(current), 'nothing');
  assert.equal(shown(behind), 'update');

  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(renderer, /if \(!answer\.latest\) \{[\s\S]*updateCheckFailed/,
    'the renderer separates the two before it decides there is no news');
});

// A failure used to be cached for the whole session, so one bad moment at
// startup meant "无法检查更新" until the app was restarted. The next ask
// must try again, but no more often than once per window, and the reason
// belongs in the crash log the diagnostics report already carries.
function directUpdate(t, { fetchImpl, failureRetryMs } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swapper-update-log-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const handlers = new Map();
  const calls = { count: 0 };
  const options = {
    app: { getPath: () => root, getVersion: () => '3.0.0' },
    feedUrl: 'https://github.com/codesensi/DLSS5-Swapper-Plus/releases.atom',
    fetch: async (...args) => { calls.count++; return fetchImpl(...args); }
  };
  if (failureRetryMs !== undefined) options.failureRetryMs = failureRetryMs;
  const update = createUpdate(options);
  update.register({ handle: (name, fn) => handlers.set(name, fn) });
  return { handlers, calls, root };
}

test('a failed lookup is not cached: the next ask tries again', async (t) => {
  const { handlers, calls } = directUpdate(t, {
    failureRetryMs: 0,
    fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); }
  });
  const first = await handlers.get('update-check')();
  const second = await handlers.get('update-check')();
  assert.equal(first.latest, null);
  assert.deepEqual(second, { current: '3.0.0', latest: null, newer: false });
  assert.equal(calls.count, 2, 'the failure did not stick for the session');
});

test('the retry is throttled to one attempt per window', async (t) => {
  const { handlers, calls } = directUpdate(t, {
    fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); }
  });
  const first = await handlers.get('update-check')();
  const second = await handlers.get('update-check')();
  assert.equal(first.latest, null);
  assert.deepEqual(second, { current: '3.0.0', latest: null, newer: false });
  assert.equal(calls.count, 1, 'within the window the failed answer is returned without a new request');
});

test('an explicit retry skips the throttle window', async (t) => {
  const { handlers, calls } = directUpdate(t, {
    fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND'); }
  });
  await handlers.get('update-check')();
  const retry = await handlers.get('update-check')({}, { force: true });
  assert.equal(retry.latest, null);
  assert.equal(calls.count, 2, 'a click that asks again must not be throttled away');
});

test('the reason a lookup failed lands in the crash log', async (t) => {
  const { handlers, root } = directUpdate(t, {
    failureRetryMs: 0,
    fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'API rate limit exceeded for 203.0.113.7.' })
  });
  await handlers.get('update-check')();
  const log = fs.readFileSync(path.join(root, 'crash.log'), 'utf8');
  assert.match(log, /update check/, 'the failure is recorded where the diagnostics report looks');
  assert.match(log, /403/, 'the HTTP status survives into the log');
  assert.match(log, /rate limit/, 'the body of the rejection is logged, not just its status');
});

test('the lookup uses the releases feed, not the rate-limited API', async (t) => {
  const { handlers, calls } = load(t, { fetchImpl: async () => release('v9.0.0') });
  await handlers.get('update-check')();
  assert.match(calls.url, /^https:\/\/github\.com\/codesensi\/DLSS5-Swapper-Plus\/releases\.atom$/,
    'the atom feed has no 60-per-hour IP rate limit');
});

test('a prerelease is skipped: the newest stable tag is reported', async (t) => {
  const { handlers } = load(t, { fetchImpl: async () => release('v3.1.0-beta.1', 'v3.0.0') });
  const answer = await handlers.get('update-check')();
  assert.equal(answer.newer, true);
  assert.equal(answer.latest, '3.0.0');
});

test('the failed notice itself is the retry control', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  assert.match(renderer, /updateCheckFailed[\s\S]{0,400}preventDefault[\s\S]{0,300}checkUpdate\(\{ force: true \}\)/,
    'clicking the failed notice forces a new lookup instead of opening the release page');
});
