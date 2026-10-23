'use strict';
// The artwork handler used to answer a failed look-up with { error } alone and
// cache nothing, so every reopening of the same game paid the full network
// timeout all over again - and before the download timeout existed, a blocked
// CDN turned that into the better part of a minute per attempt. A failed
// look-up is now remembered for ten minutes; a success is still governed by
// the artwork rules alone.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function load({ look, download } = {}) {
  const handlers = new Map();
  const saved = [];
  let savedState = {};
  const app = { getPath: () => os.tmpdir() };
  const ctx = {
    app,
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    ...require(path.join(ROOT, 'src', 'main', 'state')).createState({ app }),
    loadState: () => ({ art: savedState.art }),
    saveState: (state) => { savedState = state; saved.push(state.art); return true; },
    ART_RULES: 4,
    // The real keyFor is a SHA-256 hex digest (state.js) - always a safe file
    // name. Stubbing it with the raw path would put a colon into the download
    // target, and Windows reads that as a drive reference, not a file name.
    keyFor: (dir) => 'k-' + String(dir).replace(/[^a-zA-Z0-9]/g, '_'),
    art: {
      look: look || (() => { throw new Error('network unreachable'); }),
      download: download || (async (url, dest) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.alloc(4096));
      return dest;
    })
    }
  };
  require(path.join(ROOT, 'src', 'main', 'ipc', 'art')).register(ctx);
  return { fetch: (dir, name) => handlers.get('art-fetch')({}, dir, name, undefined), saved: () => savedState };
}

test('a failed look-up is remembered', async (t) => {
  let attempts = 0;
  const { fetch } = load({ look: () => { attempts++; throw new Error('store unreachable'); } });
  const first = await fetch('C:\\Games\\Cool Game', 'Cool Game');
  const second = await fetch('C:\\Games\\Cool Game', 'Cool Game');
  assert.equal(first.error, 'store unreachable');
  assert.equal(second.error, first.error, 'the same failure is replayed');
  assert.equal(attempts, 1, 'the store was asked once');
});

test('a negative entry expires after ten minutes', async (t) => {
  let attempts = 0;
  const { fetch, saved } = load({ look: () => { attempts++; throw new Error('store unreachable'); } });
  await fetch('C:\\Games\\Cool Game', 'Cool Game');
  assert.equal(attempts, 1);
  // Age the negative record past its ten-minute life.
  saved().art['k-C__Games_Cool_Game'].fetchedAt = Date.now() - 600001;
  const again = await fetch('C:\\Games\\Cool Game', 'Cool Game');
  assert.equal(attempts, 2, 'the store was asked again');
  assert.equal(again.error, 'store unreachable');
});

test('a positive record is served without a store round-trip', async (t) => {
  const { fetch, saved } = load({
    look: () => ({ name: 'Cool Game', coverUrl: 'https://cdn/cover.jpg', heroUrl: 'https://cdn/hero.jpg' })
  });
  await fetch('C:\\Games\\Cool Game', 'Cool Game');
  const record = saved().art['k-C__Games_Cool_Game'];
  assert.equal(record.negative, undefined);
  assert.match(record.cover, /-cover\.jpg$/);
  assert.equal((await fetch('C:\\Games\\Cool Game', 'Cool Game')).cover, record.cover);
});
