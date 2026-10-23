'use strict';
// Splitting the install handler into stages left the overlay steps reading a
// variable that only existed inside one stage: planOverlay() declared
// `const overlay = ctx.gameOverlay` locally, while the attach block after the
// install referenced the bare name - a ReferenceError ("overlay is not
// defined") that the catch translated into "the in-game overlay will not be
// installed" on every single install. The overlay machinery was fine all
// along; the handler just could not reach it.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GAME_DIR = 'X:/g';
const EXE = 'X:/g/Game.exe';

function load({ overlay } = {}) {
  const handlers = new Map();
  const sent = [];
  const realOverlay = require(path.join(ROOT, 'src', 'core', 'game-overlay'));
  const ctx = {
    app: { getPath: () => process.env.TEMP || '/tmp', getVersion: () => '3.0.0' },
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    shell: {},
    loadState: () => ({ folders: [], lang: 'en' }),
    saveState: () => true,
    keyFor: (dir) => dir,
    apiPreferenceKey: () => 'k',
    apiPreference: () => undefined,
    reshadeProxyPreference: () => 'dxgi',
    addons: { payload: () => ({ source: {} }), companionAddons: () => [] },
    scanGame: async () => ({
      chosen: { path: EXE, rel: 'Game.exe' },
      exeCandidates: [{ path: EXE, rel: 'Game.exe' }],
      dlssFiles: [], streamlineFiles: [], hasBackup: false
    }),
    renderingApi: {
      effective: (detected) => ({ ...detected, bitness: 64, api: 'dxgi', apiLabel: 'DirectX 12' })
    },
    installRoutes: require(path.join(ROOT, 'src', 'shared', 'install-routes')),
    compatibility: { assertSafeTarget: () => {}, hasAntiCheat: () => false },
    winLayer: { payloadMissing: () => ({ code: 'noPayload' }), getWindow: () => ({}) },
    guards: { assertGameClosed: async () => {}, gpuInfo: async () => [] },
    journal: { pendingPath: (dir) => path.join(dir, 'none.json'), capture: async () => {} },
    backends: {
      readManifest: () => null,
      install: async () => ({ replaced: [], added: [], route: 'native', game: { api: 'dx12', exe: 'Game.exe' } })
    },
    history: () => ({ list: () => {} }),
    gameName: () => 'Cool Game',
    saveOperation: () => {},
    saveActiveManifest: async () => {},
    writeTracked: async () => {},
    componentCode: (e, f) => f,
    antiCheatWarning: { dialogOptions: () => ({}) },
    steam: () => [],
    contextForSteamGame: () => null,
    createSetupRunner: () => (() => {}),
    ensureDgVoodoo: async () => '',
    ensureLumenite: async () => '',
    missingVCRuntime: () => false,
    optiscaler: {},
    vulkanLayer: {},
    makeReShadeConfigWritable: async () => [],
    overlayLibrary: () => ({ resolve: () => ({ ready: false }), list: () => ({ installations: [] }), install: () => ({}), uninstall: () => {} }),
    overlayPreferences: { read: () => ({ enabled: true }) },
    gameOverlay: overlay ? overlay : {
      ...realOverlay,
      cleanupMissing: () => {},
      replaceOutdated: () => {},
      routes: () => ['native'],
      prepare: () => ({ plan: { file: 'x' } }),
      attach: async () => {}
    }
  };
  require(path.join(ROOT, 'src', 'main', 'ipc', 'install')).register(ctx);
  return {
    install: () => handlers.get('install')(
      { sender: { send: (channel, payload) => sent.push(payload) } },
      GAME_DIR, EXE, 'native', 'dxgi'),
    sent
  };
}

test('a prepared overlay attaches without a scope error', async () => {
  const attached = [];
  const session = load({
    overlay: {
      cleanupMissing: () => {},
      replaceOutdated: () => {},
      routes: () => ['native'],
      prepare: () => ({ plan: { file: 'x' } }),
      attach: async () => { attached.push(true); },
      completeFeederConfig: (s) => s
    }
  });
  const result = await session.install();
  assert.equal(result.ok, true, 'the install itself never fails');
  assert.equal(attached.length, 1, 'overlay.attach ran instead of dying on a ReferenceError');
  const codes = session.sent.map((e) => e.code);
  assert.equal(codes.includes('overlaySkipped'), false, 'no "will not be installed" line was sent');
  assert.equal(codes.includes('addonInstalled'), true);
});

test('a genuinely failing overlay is still only skipped, never fatal', async () => {
  const session = load({
    overlay: {
      cleanupMissing: () => {},
      replaceOutdated: () => {},
      routes: () => ['native'],
      prepare: () => ({ plan: { file: 'x' } }),
      attach: async () => { throw Error('disk full'); },
      completeFeederConfig: (s) => s
    }
  });
  const result = await session.install();
  assert.equal(result.ok, true);
  const codes = session.sent.map((e) => e.code);
  assert.equal(codes.includes('overlaySkipped'), true);
  assert.equal(codes.includes('addonInstalled'), false);
});
