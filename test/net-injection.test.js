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
