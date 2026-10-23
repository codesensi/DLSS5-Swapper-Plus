'use strict';
// Two channels used to trust the renderer with absolute paths: 'open' handed
// any of them to shell.openPath, and 'launch-game' scanned whatever folder it
// was given and executed the exe it found. A compromised or misled renderer
// could therefore open or run anything on disk. Both channels now check the
// same whitelist before acting: the scanned games, the watched folders, one
// level inside them, or a folder the person added by hand. Everything else is
// refused with a code the renderer translates.

// The handlers under test live in modules that register many channels; the
// test builds the same ctx main.js builds, but with every collaborator
// stubbed, so only the guarded behaviour is exercised.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function load({ dir, gameDir, games } = {}) {
  const handlers = new Map();
  const opened = [];
  const openedExternal = [];
  const scanned = [];
  const ipcMain = { handle: (channel, fn) => handlers.set(channel, fn) };
  const shell = {
    openPath: async (p) => { opened.push(p); return null; },
    openExternal: async (u) => { openedExternal.push(u); return null; }
  };
  const app = { getPath: () => os.tmpdir() };
  const ctx = {
    app, ipcMain, shell,
    // state layer, flattened the way the composition root spreads it
    ...require(path.join(ROOT, 'src', 'main', 'state')).createState({ app }),
    loadState: () => ({ folders: dir ? [dir] : [] }),
    saveState: () => true,
    knownFolders: require(path.join(ROOT, 'src', 'core', 'history')).knownFolders,
    addons: { payload: [] },
    cache: { lastGames: games || [], lastRoots: [] },
    scanGame: async (scannedDir) => {
      scanned.push(scannedDir);
      return { chosen: { path: path.join(scannedDir, 'game.exe') } };
    }
  };
  require(path.join(ROOT, 'src', 'main', 'ipc', 'session')).register(ctx);
  require(path.join(ROOT, 'src', 'main', 'ipc', 'library')).register(ctx);
  return {
    open: (target) => handlers.get('open')({}, target),
    launch: (target) => handlers.get('launch-game')({}, target),
    opened,
    openedExternal,
    scanned
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

// ---- launch-game shares the whitelist ----

test('a game inside the library launches and is scanned', async (t) => {
  const { watched, gameDir } = library(t);
  const session = load({ dir: watched, games: [{ dir: gameDir, name: 'Cool Game' }] });
  const result = await session.launch(gameDir);
  assert.deepEqual(session.scanned, [gameDir], 'the exe scan ran');
  assert.deepEqual(session.opened, [path.join(gameDir, 'game.exe')], 'the scanned exe ran');
  assert.equal(result.ok, true);
});

test('a game outside the library is refused before any scan or launch', async (t) => {
  const { root, watched, gameDir } = library(t);
  const session = load({ dir: watched, games: [{ dir: gameDir, name: 'Cool Game' }] });
  const outside = path.join(root, 'Downloads', 'Cool Game');
  fs.mkdirSync(outside, { recursive: true });
  const result = await session.launch(outside);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'errOpenOutsideLibrary');
  assert.deepEqual(session.scanned, [], 'nothing was scanned');
  assert.deepEqual(session.opened, [], 'nothing was executed');
});

test('a steam game outside the library is refused too', async (t) => {
  const { root, watched, gameDir } = library(t);
  const session = load({ dir: watched, games: [{ dir: gameDir, appid: 1245620 }] });
  const outside = path.join(root, 'Elsewhere');
  const result = await session.launch(outside);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'errOpenOutsideLibrary');
  assert.deepEqual(session.openedExternal, [], 'no steam:// run command was issued');
});

test('a non-path argument is refused without launching', async (t) => {
  const { watched, gameDir } = library(t);
  const session = load({ dir: watched, games: [{ dir: gameDir }] });
  for (const bad of ['C:', undefined, null, 42]) {
    const result = await session.launch(bad);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'errOpenOutsideLibrary');
  }
  assert.deepEqual(session.scanned, []);
  assert.deepEqual(session.opened, []);
  assert.deepEqual(session.openedExternal, []);
});
