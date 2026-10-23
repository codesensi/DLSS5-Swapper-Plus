'use strict';
// DLSS 5 Swapper Plus
// Finds the games already on the machine and installs DLSS 5 Neural
// Rendering into them, using the scanners in src/core.
//
// This file is the composition root. It is the only place that requires
// ./src/core/* directly: everything under src/main/ receives its
// dependencies injected, which keeps the require stubs in the tests
// effective all the way down.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Menu, Tray, nativeImage, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// ---------- shared core and shared modules (stub points for the tests) ----------
const diagnostics = require('./src/core/diagnostics');
const { scanGame, scanSource } = require('./src/core/scan.js');
const { discover, dedupe, isInside, steam } = require('./src/core/library');
const { contextForSteamGame, createSetupRunner } = require('./src/core/proton');
const art = require('./src/core/steamart');
// Store lookups go through Electron's fetch so the system proxy applies;
// Node's own fetch ignores it and the store API times out on such networks.
// The vm tests stub electron without a net module, hence the guard.
if (typeof net !== 'undefined' && typeof net.fetch === 'function') art.setFetch(net.fetch);
const { saveActiveManifest, writeTracked, makeReShadeConfigWritable } = require('./src/core/apply.js');
const pe = require('./src/core/pe.js');
const components = require('./src/core/runtime-components.js');
const { ensureLumenite, ensureDgVoodoo, missingVCRuntime } = components;
// The component downloads (OptiScaler, dgVoodoo, LumeniteFX) ride the same
// proxy-aware channel; without it a proxied network can never fetch them.
if (typeof net !== 'undefined' && typeof net.fetch === 'function') components.setFetch(net.fetch);
const componentCode = (error, fallback) => (error && error.code === 'componentRemoved' ? 'componentQuarantined' : fallback);
const installRoutes = require('./src/shared/install-routes');
const renderingApi = require('./src/shared/rendering-api');
const { projectUrl } = require('./src/core/project-links');
const optiscaler = require('./src/core/optiscaler');
const { missingPayload } = require('./src/core/payload-guidance');
const backends = require('./src/core/backend-manager');
const journal = require('./src/core/file-journal');
const guards = require('./src/core/install-guards');
const compatibility = require('./src/core/compatibility');
const antiCheatWarning = require('./src/shared/anti-cheat-warning');
const featureI18n = require('./src/shared/feature-i18n');
const vulkanLayer = require('./src/core/vulkan-layer');
const { HistoryStore, knownFolders, fromManifests } = require('./src/core/history');
const gameMenu = require('./src/core/game-menu');
const gameOverlay = require('./src/core/game-overlay');
const overlayPreferences = require('./src/main/overlay-preferences');

// ---------- main-process layers ----------
const { createState } = require('./src/main/state');
const { createAddons } = require('./src/main/addons');
const { createTray } = require('./src/main/tray');
const { createWindowLayer } = require('./src/main/window');
const { createUpdate } = require('./src/main/update');

const state = createState({ app });
const {
  stateFile, posterDir, keyFor, SCAN_RULES,
  readState, loadState, saveState, defaultLocale,
  apiPreferenceKey, apiPreference, reshadeProxyPreference
} = state;

const featureText = (key, ...args) => featureI18n.t(loadState().lang, key, ...args);

// History: one lazy store per launch. `historyStore` stays a top-level let so
// the test hooks below can reset it between tests.
let historyStore;
const history = () => historyStore || (historyStore = new HistoryStore(path.join(app.getPath('userData'), 'history.jsonl')));

// Last discovery results, shared by the handlers and the boot payload. Tests
// rewrite these through the same context object.
const cache = { lastRoots: [], lastGames: [] };
const gameName = dir => cache.lastGames.find(game => keyFor(game.dir) === keyFor(dir))?.name || path.basename(dir);

function saveOperation(dir, manifest, action, send) {
  try { history().record(dir, manifest, action, gameName(dir)); }
  catch (error) {
    // The game operation succeeded. Report the separate history write failure.
    // HistoryStore retains the row in memory for a later retry.
    send({ code: 'historySaveWarning', params: { error: error.message } });
  }
}

// ---------- add-on catalog and payload ----------
const appRoot = __dirname;
const realAddons = createAddons({ app, appRoot, loadState, pe, scanSource });
// Test-overridable wrappers: the handlers read through these, so a test that
// replaces payload or companionAddons takes effect immediately.
let payload = (raw) => realAddons.payload(raw);
let companionAddons = () => realAddons.companionAddons();
const addons = {
  ...realAddons,
  payload: (raw) => payload(raw),
  companionAddons: () => companionAddons()
};

// Bumped whenever the art picked for a game could change, so folders cached
// under the old rule fetch again instead of keeping a bad banner forever.
const ART_RULES = 4;

function posterUrl(game, state) {
  const key = keyFor(game.dir);
  const custom = state.posters[key];
  if (custom && fs.existsSync(custom)) return { url: pathToFileURL(custom).href, tall: true, custom: true };
  // Art fetched earlier is already on disk; use it before the
  // launcher's own cache, which is often only a wide header.
  const record = state.art && state.art[key];
  const saved = record?.rules === ART_RULES ? record : null;
  if (saved && saved.cover) return { url: saved.cover, tall: true, custom: false };
  // A game too new for a portrait capsule still has a banner. The grid knows
  // how to show a wide image, which beats falling back to two initials.
  if (saved && saved.hero) return { url: saved.hero, tall: false, custom: false };
  if (game.poster) return { url: pathToFileURL(game.poster.file).href, tall: game.poster.tall, custom: false };
  return null;
}

// ---------- window, tray, update ----------
const winLayer = createWindowLayer({
  app, BrowserWindow, appRoot, loadState, ensureTray: () => trayLayer.ensureTray(), missingPayload
});
const trayLayer = createTray({
  app, Tray, Menu, nativeImage, appRoot,
  getWindow: winLayer.getWindow,
  isQuitting: { set: (v) => winLayer.setQuitting(v) }
});
const ensureTray = trayLayer.ensureTray;
const showWindow = winLayer.showWindow;
// Top-level wrapper kept so the tests can drive window creation directly,
// exactly as they did when the window lived in this file.
function createWindow() { return winLayer.createWindow(); }
// The update lookup runs where the tests inject their fetch, so the context's
// own fetch is passed through rather than reached for globally. Electron's
// net.fetch goes first for the same reason as above: GitHub is proxy-only on
// some networks, and Node's own fetch would never know.
const update = createUpdate({
  app,
  fetch: typeof net !== 'undefined' && typeof net.fetch === 'function'
    ? net.fetch
    : typeof fetch === 'function' ? fetch : undefined
});

// The same overlay library the Overlay page manages, so an install picks up
// exactly the build shown there.
function overlayLibrary() {
  const { createOverlayLibrary } = require('./src/core/overlays');
  const root = path.resolve(__dirname);
  const builtin = app.isPackaged
    ? path.join(process.resourcesPath, 'overlay', 'dlss5-lab-overlay.addon64')
    : path.join(root, 'dist/overlay/dlss5-lab-overlay.addon64');
  return createOverlayLibrary(path.join(app.getPath('userData'), 'overlay-library'), builtin,
    [root, app.isPackaged ? path.dirname(app.getPath('exe')) : root]);
}

// ---------- IPC: assemble the context and register the handlers ----------
const ctx = {
  app, ipcMain, dialog, shell, clipboard, Menu, BrowserWindow,
  appRoot, pkg: require('./package.json'),
  // state layer, flattened: handlers destructure these from ctx directly
  ...state,
  addons, tray: trayLayer, winLayer, update,
  cache, ART_RULES, posterUrl, overlayLibrary, overlayPreferences,
  gameOverlay,
  getOverlayBridge: () => overlayBridge,
  // core/shared modules, dereferenced once here
  scanGame, discover, dedupe, isInside, steam, diagnostics, guards, compatibility,
  backends, journal, optiscaler, vulkanLayer,
  art, installRoutes, renderingApi, projectUrl, gameMenu,
  antiCheatWarning,
  knownFolders, fromManifests,
  contextForSteamGame, createSetupRunner,
  saveActiveManifest, writeTracked, makeReShadeConfigWritable,
  missingVCRuntime, ensureLumenite, ensureDgVoodoo, componentCode,
  featureText, history, gameName, saveOperation
};

// Install last so `ctx.install.isMutationBusy()` is reachable from the others.
const installLayer = require('./src/main/ipc/install').register(ctx);
ctx.install = installLayer;
require('./src/main/ipc/session').register(ctx);
require('./src/main/ipc/library').register(ctx);
require('./src/main/ipc/addons').register(ctx);
require('./src/main/ipc/art').register(ctx);
update.register(ipcMain);

// ---------- crash log ----------
// Guarded because main.js is also loaded in test sandboxes that are not a
// real process; a module should not install global handlers regardless.
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('uncaughtException', (error) => update.recordCrash('uncaughtException', error));
  process.on('unhandledRejection', (reason) => update.recordCrash('unhandledRejection', reason));
}

// ---------- app lifecycle ----------
// Windows groups taskbar entries and attributes shortcuts by this id. Without
// it the window is filed under whatever launched it - "Electron" when run from
// source - instead of under the app.
app.setAppUserModelId('com.dlss5swapperplus.app');

// A second copy of the app is not just wasted memory: it writes its own
// overlay endpoint over the first one's and listens on its own pipe, so the
// panel in the game would be driven by whichever window happened to start
// last. Opening the app again raises the window that is already running.
//
// The lock is asked for defensively - the IPC handlers in this file are also
// exercised outside Electron, where app is a stand-in that has no such call.
const singleInstance = typeof app.requestSingleInstanceLock === 'function'
  ? app.requestSingleInstanceLock()
  : true;
if (!singleInstance) {
  app.quit();
} else {
  // Opening the app again raises the window - including when it is in the tray
  // rather than merely minimised.
  app.on('second-instance', showWindow);
}

// #365: on some machines the window repaints with stale tiles - rows from
// before a scroll stay on screen, in every version and at every scale. That is
// Chromium's GPU compositor, not the page. A switch in Settings turns hardware
// acceleration off for this window, which costs nothing here: it draws text,
// cards and pictures. It has to be read before the app is ready, because that
// is the last moment the flag can still be set.
try { if (loadState().safeGraphics === true) app.disableHardwareAcceleration(); } catch { /* a default is fine */ }

// The in-game overlay draws its panel in an offscreen window here and streams
// the frames over a local pipe, so the bridge lives as long as the app does.
let overlayBridge;

app.whenReady().then(async () => {
  // app.quit() is asynchronous, so a copy that lost the lock still reaches
  // this point: without the guard it would create a window and take over the
  // overlay endpoint on its way out.
  if (!singleInstance) return;
  // Registered here rather than at load: main.js is exercised in test
  // sandboxes, where src modules are stubbed and cannot be called.
  // The overlay install/uninstall write into game folders, so they honour
  // the same busy flag as the install/restore handlers on the Games page.
  require('./src/main/overlay-ipc')({ app, ipcMain, dialog, shell, window: () => winLayer.getWindow(), bridge: () => overlayBridge, featureText, isMutationBusy: () => ctx.install.isMutationBusy() });
  winLayer.createWindow();
  // The icon is there from launch, not only after the first close - somebody
  // who wants the app parked in the tray wants to see that it is.
  if (loadState().closeToTray !== false) ensureTray();
  try {
    overlayBridge = await require('./src/main/overlay-bridge')({ BrowserWindow, userData: app.getPath('userData'), getLang: () => loadState().lang });
    if (winLayer.getQuitting()) overlayBridge.close();
  } catch (error) {
    if (!winLayer.getQuitting()) console.error('Overlay bridge:', error.message);
  }
});
// The overlay bridge keeps an offscreen window of its own, so closing the
// visible one no longer emptied the window list and window-all-closed never
// arrived: the process stayed in Task Manager with nothing on screen. Quitting
// follows the window the person actually closed.
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { winLayer.setQuitting(true); overlayBridge?.close(); });

// ---------- test hooks ----------
// The tests load this file with stubbed dependencies and need to replace a few
// top-level bindings between tests. Production code never calls these. The
// guard keeps the file loadable as a plain script in a vm context, where no
// module object exists.
if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
  module.exports = {
    __setPayload: (fn) => { payload = fn; },
    __setCompanionAddons: (fn) => { companionAddons = fn; },
    __resetHistoryStore: () => { historyStore = null; },
    __createWindow: () => winLayer.createWindow()
  };
}
