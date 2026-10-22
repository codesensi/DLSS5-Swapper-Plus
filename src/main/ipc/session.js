'use strict';
// Session-level handlers: the boot payload, languages, skins and settings
// toggles, window controls, the driver warning barrier and the history rows.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Before anything has been installed in this session, the row is filled from
// the backup manifests already sitting in the game folders - real installs
// with real dates rather than an empty shelf.
function recentsFromManifests(ctx, state) {
  const latest = new Map();
  for (const row of ctx.fromManifests(ctx.knownFolders(state, ctx.cache.lastGames))) {
    const key = ctx.keyFor(row.dir);
    const at = Date.parse(row.date);
    if (!latest.has(key) || latest.get(key).at < at) latest.set(key, { dir: row.dir, at });
  }
  return [...latest.values()].sort((a, b) => b.at - a.at).slice(0, 12);
}

function register(ctx) {
  const { app, ipcMain, dialog, shell, clipboard } = ctx;
  const { loadState, saveState, keyFor, defaultLocale } = ctx;
  const tray = ctx.tray;

  // ---------- boot, language and appearance ----------

  // The renderer needs a URL for the logo, and it falls back to a drawn mark if
  // the file is not there.
  ipcMain.handle('boot', () => {
    const state = loadState();
    const asUrl = (name) => {
      const file = path.join(ctx.appRoot, 'assets', name);
      return fs.existsSync(file) ? pathToFileURL(file).href : null;
    };
    return {
      version: ctx.pkg.version,
      // Said at launch rather than at the moment somebody presses Install. The
      // app used to look completely healthy right up until it could not work.
      payloadMissing: (() => {
        // Never let a probe stop the app opening: a launch that fails because it
        // could not check its own files is worse than the missing files.
        try { return ctx.addons.payload() ? null : ctx.winLayer.payloadMissing().message; } catch { return null; }
      })(),
      theme: state.theme || 'light',
      // Which of the two skins draws the app. Theme 1 is the original design and
      // stays the default; theme 2 is the modern one.
      skin: state.skin === 'two' ? 'two' : 'one',
      // Theme 2 can keep the sidebar as a rail of icons that opens on hover.
      rail: state.rail === 'on' ? 'on' : 'off',
      lang: state.lang || defaultLocale(),
      groupGamesByStore: state.groupGamesByStore !== false,
      logo: asUrl('logo.png'),
      logoDark: asUrl('logo-dark.png')
    };
  });

  ipcMain.handle('set-lang', (_event, lang) => {
    const state = loadState();
    state.lang = lang;
    saveState(state);
    // 游戏内面板是独立的 offscreen 文档，语言切换后需要主动同步。
    ctx.getOverlayBridge()?.syncLang?.();
    return lang;
  });

  ipcMain.handle('set-rail', (_event, rail) => {
    const state = loadState();
    state.rail = rail === 'on' ? 'on' : 'off';
    return saveState(state) ? { ok: true, rail: state.rail } : { ok: false, rail: state.rail };
  });
  ipcMain.handle('set-skin', (_event, skin) => {
    const state = loadState();
    state.skin = skin === 'two' ? 'two' : 'one';
    return saveState(state) ? { ok: true, skin: state.skin } : { ok: false, skin: state.skin };
  });
  ipcMain.handle('set-theme', (_event, theme) => {
    const state = loadState();
    state.theme = theme;
    saveState(state);
    return theme;
  });

  // Import legacy backups from known locations only. Do not scan all drives.
  ipcMain.handle('history', () => {
    let warning = false;
    const rows = ctx.history().list(ctx.install.isMutationBusy() ? [] : ctx.knownFolders(loadState(), ctx.cache.lastGames), () => { warning = true; });
    return { rows, warning };
  });

  ipcMain.handle('copy-text', (_event, text) => {
    if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text, 'utf8') > 16 * 1024 * 1024) return false;
    try { clipboard.writeText(text); return true; } catch { return false; }
  });

  ipcMain.handle('settings', () => {
    const state = loadState();
    let posterCount = 0;
    try { posterCount = fs.readdirSync(ctx.posterDir()).length; } catch {}
    return {
      folders: state.folders, stateFile: ctx.stateFile(), posterDir: ctx.posterDir(), posterCount,
      roots: ctx.cache.lastRoots,
      excludedRoots: state.excludedRoots || [],
      hidden: [...(state.hidden || [])],
      autoScanDrives: state.autoScanDrives === true,
      groupGamesByStore: state.groupGamesByStore !== false,
      closeToTray: state.closeToTray !== false,
      safeGraphics: state.safeGraphics === true,
      skin: state.skin === 'two' ? 'two' : 'one'
    };
  });

  ipcMain.handle('set-safe-graphics', (_event, enabled) => {
    const state = loadState();
    state.safeGraphics = enabled === true;
    // It reads the flag at startup, so the change lands on the next launch.
    return saveState(state) ? { ok: true, on: state.safeGraphics } : { ok: false, on: !state.safeGraphics };
  });
  ipcMain.handle('set-close-to-tray', (_event, enabled) => {
    const state = loadState();
    state.closeToTray = enabled === true;
    saveState(state);
    if (state.closeToTray) tray.ensureTray();
    // Turning it off leaves the icon alone: the window is open, and taking the
    // tray away under a menu somebody may have just opened is worse than a
    // harmless icon that does the same two things.
    return state.closeToTray;
  });

  ipcMain.handle('set-tray-labels', (_event, labels) => tray.setTrayLabels(labels));

  ipcMain.handle('set-group-games-by-store', (_event, enabled) => {
    const state = loadState();
    state.groupGamesByStore = enabled === true;
    saveState(state);
    return state.groupGamesByStore;
  });

  ipcMain.handle('set-auto-scan-drives', (_event, enabled) => {
    const state = loadState();
    state.autoScanDrives = enabled === true;
    if (!state.autoScanDrives) ctx.cache.lastRoots = [];
    saveState(state);
    return state.autoScanDrives;
  });

  // Used when a folder arrives by drop rather than through the picker.
  ipcMain.handle('add-game-path', (_event, dir) => {
    const state = loadState();
    if (fs.existsSync(dir) && !state.manual.includes(dir)) {
      state.manual.push(dir);
      saveState(state);
    }
    return dir;
  });

  ipcMain.handle('window', (_event, action) => {
    const win = ctx.winLayer.getWindow();
    if (!win) return;
    if (action === 'minimize') win.minimize();
    else if (action === 'close') win.close();
    else if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  });

  // #229, #258, #104: the driver warning was a line in the install log, and
  // every line after it said "added" and "done". Three people spent days on a
  // driver the app had already named. It is a question now - answered once per
  // driver version, never a block: the install is still theirs to make.
  ipcMain.handle('driver-neural-fault', async () => {
    const rows = await ctx.guards.gpuInfo();
    if (!rows || !ctx.guards.driverNeuralFault(rows)) return { fault: false };
    const names = ctx.guards.driverNames(rows);
    const state = loadState();
    return { fault: true, names, acknowledged: (state.driverAcknowledged || []).includes(names) };
  });

  ipcMain.handle('acknowledge-driver', (_event, names) => {
    if (typeof names !== 'string' || !names) return false;
    const state = loadState();
    const seen = state.driverAcknowledged || [];
    // Keyed by the exact adapter-and-version string, so a driver change asks
    // again and a reinstall of the same one does not.
    if (!seen.includes(names)) { state.driverAcknowledged = [...seen, names].slice(-8); saveState(state); }
    return true;
  });

  ipcMain.handle('open', (_event, dir) => shell.openPath(dir));
  ipcMain.handle('open-project', async (_event, destination) => {
    const url = ctx.projectUrl(destination);
    if (!url) return false;
    try { await shell.openExternal(url); return true; } catch { return false; }
  });

  // The home page lists the last games touched, newest first.
  ipcMain.handle('touch', (_event, dir) => {
    const state = loadState();
    state.recents = [{ dir, at: Date.now() }]
      .concat((state.recents || []).filter((r) => r.dir !== dir))
      .slice(0, 12);
    saveState(state);
    return state.recents;
  });

  ipcMain.handle('recents', () => {
    const state = loadState();
    const excluded = state.excludedRoots || [];
    const manual = new Set((state.manual || []).map((row) => path.resolve(row).toLowerCase()));
    const saved = (state.recents || []).filter((r) =>
      fs.existsSync(r.dir) && (
        manual.has(path.resolve(r.dir).toLowerCase()) || !excluded.some((root) => ctx.isInside(r.dir, root))
      )
    );
    return saved.length ? saved : recentsFromManifests(ctx, state);
  });
}

module.exports = { register };
