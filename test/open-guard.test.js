'use strict';
// The 'open' channel used to hand any path from the renderer straight to
// shell.openPath - a compromised or misled renderer could open or execute
// anything on disk. It may now only open folders that are already part of the
// library: the scanned games, the watched folders, one level inside them, or
// a folder the person added by hand. Everything else is refused with a code
// the renderer translates.

// The handler under test lives in a module that registers many channels; the
// test builds the same ctx main.js builds, but with every collaborator stubbed,
// so only the 'open' behaviour is exercised.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function load({ dir, gameDir }) {
  const handlers = new Map();
  const opened = [];
  const ipcMain = { handle: (channel, fn) => handlers.set(channel, fn) };
  const shell = {
    openPath: async (p) => { opened.push(p); return null; }
  };
  const app = { getPath: () => os.tmpdir() };
  const ctx = {
    app, ipcMain, shell,
    // state layer, flattened the way the composition root spreads it
    ...require(path.join(ROOT, 'src', 'main', 'state')).createState({ app }),
    loadState: () => ({ folders: [dir] }),
    saveState: () => true,
    knownFolders: require(path.join(ROOT, 'src', 'core', 'history')).knownFolders,
    cache: { lastGames: [{ dir: gameDir, name: 'Some Game' }], lastRoots: [] }
  };
  require(path.join(ROOT, 'src', 'main', 'ipc', 'session')).register(ctx);
  return {
    open: (target) => handlers.get('open')({}, target),
    opened
  };
}

function library(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'open-guard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const watched = path.join(root, 'Games');
  const gameDir = path.join(watched, 'Cool Game');
  fs.mkdirSync(gameDir, { recursive: true });
  return { root, watched, gameDir };
}

test('a folder inside the library opens', async (t) => {
  const { watched, gameDir } = library(t);
  const session = load({ dir: watched, gameDir });
  const result = await session.open(gameDir);
  assert.equal(result, null, 'shell.openPath ran');
  assert.deepEqual(session.opened, [gameDir]);
});

test('a path outside the library is refused', async (t) => {
  const { watched, gameDir } = library(t);
  const session = load({ dir: watched, gameDir });
  const outside = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc';
  const result = await session.open(outside);
  assert.equal(result, 'errOpenOutsideLibrary', 'refused with a translatable code');
  assert.deepEqual(session.opened, [], 'nothing was opened');
});

test('a sibling of a watched folder is not inside the library', async (t) => {
  const { root, watched, gameDir } = library(t);
  const session = load({ dir: watched, gameDir });
  const result = await session.open(path.join(root, 'Elsewhere'));
  assert.equal(result, 'errOpenOutsideLibrary');
  assert.deepEqual(session.opened, []);
});

test('a non-path argument is refused', async (t) => {
  const { watched, gameDir } = library(t);
  const session = load({ dir: watched, gameDir });
  assert.equal(await session.open('C:'), 'errOpenOutsideLibrary');
  assert.equal(await session.open(undefined), 'errOpenOutsideLibrary');
  assert.equal(await session.open(null), 'errOpenOutsideLibrary');
  assert.deepEqual(session.opened, []);
});
