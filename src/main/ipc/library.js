'use strict';
// The game library: discovery, scanning, folder management, posters and the
// per-game context menu.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { pathToFileURL } = require('url');

// #155: a ReShade.ini left read-only by an install from before 2.2.2 covers the
// game with an error banner. 2.2.5 cleared it only when the game was opened in
// this app, and launching from Steam never passes through here - so every game
// this app installed into is looked at once, in the background, per start.
let configsRepaired = false;
function repairReadOnlyConfigs(ctx, games) {
  if (configsRepaired) return;
  configsRepaired = true;
  setImmediate(async () => {
    for (const game of games) {
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(game.dir, '_DLSS5_Backup', 'manifest.json'), 'utf8'));
        const exe = manifest && manifest.game && manifest.game.exe;
        if (typeof exe !== 'string' || !exe) continue;
        const exeDir = path.dirname(path.resolve(game.dir, exe));
        // Only ever inside the game's own folder, whatever the manifest says.
        if (!exeDir.toLowerCase().startsWith(path.resolve(game.dir).toLowerCase())) continue;
        const cleared = await ctx.makeReShadeConfigWritable(exeDir);
        if (cleared.length) console.log('Cleared read-only:', cleared.join(', '), 'in', game.dir);
      } catch { /* not installed by this app, or unreadable: nothing to repair */ }
    }
  });
}

function register(ctx) {
  const { app, ipcMain, dialog, shell, BrowserWindow } = ctx;
  const { loadState, saveState, stateFile, keyFor, SCAN_RULES, apiPreference } = ctx;
  const { payload, describe, addonLibrary } = ctx.addons;

  ipcMain.handle('launch-game', async (_event, dir) => {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false, message: 'errApiChoice' };
    const known = ctx.cache.lastGames.find((game) => keyFor(game.dir) === keyFor(dir));
    if (known && known.appid) {
      await shell.openExternal(`steam://rungameid/${String(known.appid).replace(/[^0-9]/g, '')}`);
      return { ok: true, via: 'steam' };
    }
    try {
      const scan = await ctx.scanGame(dir);
      const exe = scan.chosen && scan.chosen.path;
      if (!exe) return { ok: false, message: 'No game executable found' };
      const error = await shell.openPath(exe);
      return error ? { ok: false, message: error } : { ok: true, via: 'exe' };
    } catch (error) { return { ok: false, message: error.message }; }
  });

  // One file with everything a report needs: the app's own log, the game's
  // ReShade and Feeder logs, the install manifest, the driver. Asking for those
  // one at a time costs a round trip per report and half arrive incomplete.
  //
  // Nothing is gathered silently. The person is shown every file that would go in
  // and where it came from, and chooses where to save it.
  ipcMain.handle('save-diagnostics', async (event, dir, activity) => {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return { ok: false };
    const window = BrowserWindow.fromWebContents(event.sender);
    const userData = app.getPath('userData');
    let exeDir = null;
    try {
      const scan = await ctx.scanGame(dir);
      if (scan.chosen) exeDir = path.dirname(scan.chosen.path);
    } catch { /* the folder alone is still worth reporting */ }

    const found = ctx.diagnostics.sources({ gameDir: dir, exeDir, userData });
    const list = found.length
      ? found.map(item => `• ${item.file}  (${Math.ceil(item.bytes / 1024)} KB)`).join('\n')
      : 'No log files were found for this game yet.';
    const consent = await dialog.showMessageBox(window, {
      type: 'question', title: 'Save diagnostics',
      message: 'These files will be copied into one text file:',
      detail: `${list}\n\nIt also records the app version, your GPU and driver, and this session's activity log. Game folder paths appear in it. Read it before attaching it anywhere.`,
      buttons: ['Cancel', 'Choose where to save'], defaultId: 1, cancelId: 0
    });
    if (consent.response !== 1) return { ok: false, cancelled: true };

    let gpu = null;
    try { gpu = ctx.guards.driverNames(await ctx.guards.gpuInfo()); } catch { /* advice only */ }
    const { text } = ctx.diagnostics.report({
      gameDir: dir, exeDir, userData,
      facts: {
        app: app.getVersion(), electron: process.versions.electron, platform: `${process.platform} ${os.release()}`,
        gpu, game: path.basename(dir), 'game folder': dir, 'executable folder': exeDir,
        activity: typeof activity === 'string' && activity.length <= 512 * 1024 ? `\n${activity}` : null
      }
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const picked = await dialog.showSaveDialog(window, {
      title: 'Save diagnostics',
      defaultPath: path.join(app.getPath('documents'), `dlss5-swapper-plus-diagnostics-${stamp}.txt`),
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });
    if (picked.canceled || !picked.filePath) return { ok: false, cancelled: true };
    try {
      await fs.promises.writeFile(picked.filePath, text, 'utf8');
      return { ok: true, file: picked.filePath, count: found.length };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });

  ipcMain.handle('game-menu', async (event, dir, options) => {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return null;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) return null;
    return ctx.gameMenu.show({ Menu: ctx.Menu, dialog, window, dir, name: ctx.gameName(dir),
      labels: options?.labels, position: options?.position, busy: ctx.install.isMutationBusy() || options?.busy === true });
  });

  ipcMain.handle('library', () => {
    const state = loadState();
    const found = ctx.discover(
      state.folders,
      state.autoScanDrives === true,
      state.excludedRoots || []
    );
    ctx.cache.lastRoots = found.roots;
    const games = found.games.concat(
      state.manual
        .filter((row) => fs.existsSync(row))
        .map((row) => ({ launcher: 'Added by hand', id: null, name: path.basename(row), dir: row, poster: null }))
    );

    const hidden = new Set(state.hidden.map((d) => d.toLowerCase()));
    ctx.cache.lastGames = ctx.dedupe(games)
      .filter((g) => !hidden.has(path.resolve(g.dir).toLowerCase()))
      .map((g) => ({
        key: keyFor(g.dir),
        launcher: g.launcher,
        // Steam records the app id, so its games never need a name search.
        appid: g.launcher === 'Steam' ? g.id : null,
        // Every store's own id. It was read from game.id, which this row never
        // had, so no report ever carried one.
        storeId: g.id ? String(g.id) : null,
        name: g.name,
        dir: g.dir,
        poster: ctx.posterUrl(g, state),
        // Whatever the last scan found, so cards can render before rescanning.
        cached: state.scans[keyFor(g.dir)] && state.scans[keyFor(g.dir)].rules === SCAN_RULES
          ? state.scans[keyFor(g.dir)]
          : null
      }));
    repairReadOnlyConfigs(ctx, ctx.cache.lastGames);
    return ctx.cache.lastGames;
  });

  // Scanning 37 folders takes seconds, so each card asks for its own result and
  // the grid fills in as they land.
  ipcMain.handle('scan', async (_event, dir) => {
    const state = loadState();
    const key = keyFor(dir);
    try {
      const scan = await ctx.scanGame(dir);
      const dlss = scan.primaryDlss;
      const result = {
        dir,
        ok: Boolean(scan.chosen),
        installable: ctx.installRoutes.routesFor(scan.chosen).length > 0,
        api: scan.chosen ? scan.chosen.apiLabel : null,
        bitness: scan.chosen ? scan.chosen.bitness : null,
        dx12: Boolean(scan.chosen && scan.chosen.apiLabel === 'DirectX 12'),
        exe: scan.chosen ? scan.chosen.rel : null,
        reason: scan.emptyReason || null,
        dlss: dlss ? dlss.version : null,
        hasDlss: Boolean(dlss),
        addon: Boolean(scan.addonPresent),
        optiscaler: Boolean(scan.install?.optiscaler?.installed),
        reshade: scan.reshade.installed ? scan.reshade.version : null,
        scannedAt: Date.now(),
        rules: SCAN_RULES
      };
      state.scans[key] = result;
      saveState(state);
      return result;
    } catch (err) {
      return { ok: false, api: null, dx12: false, reason: 'error', error: err.message };
    }
  });

  // ---------- editing the library ----------

  ipcMain.handle('add-folder', async () => {
    const res = await dialog.showOpenDialog(ctx.winLayer.getWindow(), { properties: ['openDirectory'], title: 'Scan this folder for games' });
    if (res.canceled) return null;
    const state = loadState();
    if (!state.folders.includes(res.filePaths[0])) state.folders.push(res.filePaths[0]);
    state.excludedRoots = (state.excludedRoots || []).filter(
      (root) => path.resolve(root).toLowerCase() !== path.resolve(res.filePaths[0]).toLowerCase()
    );
    saveState(state);
    return res.filePaths[0];
  });

  ipcMain.handle('remove-folder', (_event, dir) => {
    const state = loadState();
    state.folders = state.folders.filter((f) => f !== dir);
    state.excludedRoots = state.excludedRoots || [];
    if (!state.excludedRoots.some((root) => path.resolve(root).toLowerCase() === path.resolve(dir).toLowerCase())) {
      state.excludedRoots.push(dir);
    }
    ctx.cache.lastRoots = ctx.cache.lastRoots.filter(
      (root) => path.resolve(root).toLowerCase() !== path.resolve(dir).toLowerCase()
    );
    saveState(state);
    return true;
  });

  // Auto-discovered roots used to be display-only, so unwanted locations came
  // back on every scan. Excluding one removes only its library entries; no file
  // or folder on disk is changed.
  ipcMain.handle('exclude-root', (_event, dir) => {
    const state = loadState();
    state.excludedRoots = state.excludedRoots || [];
    if (!state.excludedRoots.some((root) => path.resolve(root).toLowerCase() === path.resolve(dir).toLowerCase())) {
      state.excludedRoots.push(dir);
    }
    state.folders = state.folders.filter(
      (folder) => path.resolve(folder).toLowerCase() !== path.resolve(dir).toLowerCase()
    );
    ctx.cache.lastRoots = ctx.cache.lastRoots.filter(
      (root) => path.resolve(root).toLowerCase() !== path.resolve(dir).toLowerCase()
    );
    saveState(state);
    return true;
  });

  ipcMain.handle('add-game', async () => {
    const res = await dialog.showOpenDialog(ctx.winLayer.getWindow(), { properties: ['openDirectory'], title: 'Add one game' });
    if (res.canceled) return null;
    const state = loadState();
    if (!state.manual.includes(res.filePaths[0])) state.manual.push(res.filePaths[0]);
    saveState(state);
    return res.filePaths[0];
  });

  ipcMain.handle('set-poster', async (_event, dir) => {
    const res = await dialog.showOpenDialog(ctx.winLayer.getWindow(), {
      properties: ['openFile'],
      title: 'Pick a poster',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    });
    if (res.canceled) return null;

    // Copied into the app's own folder, keyed by path, so renaming the game
    // folder is the only thing that loses it.
    const state = loadState();
    fs.mkdirSync(ctx.posterDir(), { recursive: true });
    const dest = path.join(ctx.posterDir(), keyFor(dir) + path.extname(res.filePaths[0]));
    fs.copyFileSync(res.filePaths[0], dest);
    state.posters[keyFor(dir)] = dest;
    saveState(state);
    return pathToFileURL(dest).href;
  });

  ipcMain.handle('hide', (_event, dir) => {
    const state = loadState();
    if (!state.hidden.includes(dir)) state.hidden.push(dir);
    saveState(state);
    return true;
  });

  // Hiding a game only takes it out of the list, so it has to be possible to
  // put it back. Without this the only way out was resetting the whole library.
  ipcMain.handle('unhide', (_event, dir) => {
    const state = loadState();
    const wanted = path.resolve(String(dir)).toLowerCase();
    state.hidden = (state.hidden || []).filter((item) => path.resolve(item).toLowerCase() !== wanted);
    saveState(state);
    return true;
  });

  ipcMain.handle('reset', () => {
    try { fs.unlinkSync(stateFile()); } catch {}
    return true;
  });
}

module.exports = { register };
