'use strict';
// The composition root injects Electron's net.fetch into steamart so store
// lookups honour the system proxy. The injection was lost when main.js was
// split into a composition root plus src/main layers: the destructure no
// longer named `net`, so the typeof guard in the vm sandboxes was always
// false and the store API fell back to Node's own fetch - which ignores the
// proxy and times out on proxy-only networks.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('main.js destructures net from electron and guards the injection', () => {
  // The vm-based tests stub electron without a net module, so main.js must
  // both destructure it for the real run and keep the typeof guard for the
  // stubbed ones. Regression: the split dropped `net` from the destructure,
  // leaving the guard permanently false in production too.
  const source = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  assert.match(source, /require\('electron'\)/);
  assert.match(source, /\bnet\s*\}/, 'net is destructured from electron again');
  assert.match(source, /typeof net !== 'undefined'/, 'the vm-safe guard stays');
  assert.match(source, /art\.setFetch\(net\.fetch\)/);
});

test('every proxy-bound channel receives the injection', () => {
  // Three modules talk to the network on their own: the Steam artwork store,
  // the component downloader (OptiScaler, dgVoodoo, LumeniteFX) and the
  // update check. Each was found once fetching through Node's own fetch,
  // which ignores the system proxy and dies on proxy-only networks.
  const source = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
  assert.match(source, /components\.setFetch\(net\.fetch\)/,
    'runtime-components downloads honour the proxy');
  assert.match(source, /fetch:\s*typeof net !== 'undefined'/,
    'the update check prefers net.fetch');
  const components = fs.readFileSync(path.join(ROOT, 'src', 'core', 'runtime-components.js'), 'utf8');
  assert.match(components, /const fetcher = netFetch \|\| fetch;/,
    'fetchBytes falls back to Node fetch only when nothing was injected');
  assert.match(components, /module\.exports = \{[^}]*setFetch[^}]*\}/,
    'setFetch is exported for the composition root');
});
