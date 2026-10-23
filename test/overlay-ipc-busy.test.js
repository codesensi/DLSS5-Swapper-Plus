'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// An install/restore from the Games page must not interleave with an overlay
// install/uninstall: both write into game folders. The Overlay page therefore
// checks the same busy flag the Games-page handlers use, re-checking it after
// every dialog, because a dialog awaits a human while a mutation may start.
const registerOverlayIpc = require('../src/main/overlay-ipc');

const roots = [];
test.after(() => { for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true }); });

function harness({ busy = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-ipc-busy-'));
  roots.push(root);
  const exe = path.join(root, 'game.exe');
  fs.writeFileSync(exe, 'not a real PE - the library rejects it later on purpose');
  const handlers = new Map();
  registerOverlayIpc({
    app: { isPackaged: false, getPath: () => root },
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    dialog: {
      showOpenDialog: async () => ({ canceled: false, filePaths: [exe] }),
      showMessageBox: async () => ({ response: 1 })
    },
    shell: { openPath: async () => null },
    window: () => ({}),
    featureText: key => `text:${key}`,
    isMutationBusy: () => busy
  });
  return handlers;
}

test('overlay-install refuses while a Games-page mutation is in flight', async () => {
  const answer = await harness({ busy: true }).get('overlay-install')({}, 'builtin');
  assert.equal(answer.ok, false);
  assert.match(answer.error, /text:errJobBusy/, 'the spoken reason, not a bare code');
});

test('overlay-uninstall refuses too, before touching the library', async () => {
  const answer = await harness({ busy: true }).get('overlay-uninstall')({}, 'somerecordid');
  assert.equal(answer.ok, false);
  assert.match(answer.error, /text:errJobBusy/);
});

test('with nothing in flight the guards are no-ops and the flow proceeds', async () => {
  // The fixture add-on and exe are not real binaries, so install fails deep
  // in the library - proving it got past the busy checks at all.
  const install = await harness({ busy: false }).get('overlay-install')({}, 'builtin');
  assert.equal(install.ok, false);
  assert.doesNotMatch(install.error, /errJobBusy/);
  assert.ok(install.error.length > 0);
});

test('read-only channels never check the lock', async () => {
  const handlers = harness({ busy: true });
  const list = await handlers.get('overlay-list')({});
  assert.equal(list.ok, true, 'listing the library is safe during a mutation');
  const bridge = await handlers.get('overlay-bridge')({});
  assert.equal(bridge.ok, true);
});
