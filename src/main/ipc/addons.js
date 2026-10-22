'use strict';
// Add-on build management and the per-game OptiScaler build choice.

const path = require('path');

function register(ctx) {
  const { app, ipcMain, dialog } = ctx;
  const { loadState, saveState, keyFor } = ctx;
  const { describe, addonLibrary, payload } = ctx.addons;

  ipcMain.handle('optiscaler-builds', (_event, dir) => ({
    // The version is the identity; the label is what a person reads. Two of these
    // are one project's versions and one is another fork entirely, so a bare
    // number would read as "older" when it is neither older nor newer.
    builds: ctx.optiscaler.RELEASES.map((r) => ({ version: r.version, label: r.label || r.version })),
    current: (loadState().optiscalerVersion || {})[path.resolve(String(dir || '')).toLowerCase()] || ctx.optiscaler.RELEASE.version
  }));

  ipcMain.handle('set-optiscaler-build', (_event, dir, version) => {
    if (typeof dir !== 'string' || !dir) return null;
    const state = loadState();
    const key = path.resolve(dir).toLowerCase();
    const chosen = ctx.optiscaler.releaseFor(version).version;
    const map = { ...(state.optiscalerVersion || {}) };
    if (chosen === ctx.optiscaler.RELEASE.version) delete map[key]; else map[key] = chosen;
    state.optiscalerVersion = map;
    saveState(state);
    return chosen;
  });

  ipcMain.handle('addons', () => addonLibrary());

  // Switching one on leaves the others alone. The single exception is a build
  // that would be written under a name another switched-on build already claims:
  // only one file can hold that name, so the older choice steps aside.
  ipcMain.handle('addon-toggle', (_event, file, on) => {
    const state = loadState();
    let list = state.addons || (state.addon ? [state.addon] : []);
    delete state.addon;

    if (!on) {
      list = list.filter((f) => f !== file);
    } else {
      const row = addonLibrary().find((r) => r.path === file);
      if (!row) return { ok: false, message: 'That build is no longer there' };
      const name = path.basename(file).toLowerCase();
      const clash = list.find((f) => f !== file && path.basename(f).toLowerCase() === name);
      list = list.filter((f) => f !== clash && f !== file);
      list.push(file);
      if (clash) {
        state.addons = list; saveState(state);
        return { ok: true, replaced: path.basename(clash) };
      }
    }
    state.addons = list;
    saveState(state);
    return { ok: true };
  });

  // Picking only reports what was chosen; nothing is stored until the dialog in
  // the window is filled in and confirmed.
  ipcMain.handle('addon-pick', async () => {
    const res = await dialog.showOpenDialog(ctx.winLayer.getWindow(), {
      title: 'Add an add-on build',
      filters: [{ name: 'ReShade add-on', extensions: ['addon64', 'addon'] }],
      properties: ['openFile']
    });
    if (res.canceled || !res.filePaths.length) return null;

    const file = res.filePaths[0];
    const row = describe(file, null);
    if (!row) return { error: 'unreadable' };
    return {
      path: file,
      file: row.file,
      size: row.size,
      version: row.version,
      // The folder is a better first guess than the file name, which is the same
      // for every build.
      suggestedName: path.basename(path.dirname(file))
    };
  });

  ipcMain.handle('addon-save', (_event, entry) => {
    const state = loadState();
    const list = (state.addonFiles || []).map((e) => (typeof e === 'string' ? { path: e.path ?? e } : e));
    state.addonFiles = [
      ...list.filter((e) => e.path !== entry.path),
      {
        path: entry.path,
        name: (entry.name || '').trim() || null,
        tag: (entry.tag || '').trim() || null,
        notes: String(entry.description || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
      }
    ];
    saveState(state);
    return true;
  });

  ipcMain.handle('addon-remove', (_event, file) => {
    const state = loadState();
    const list = (state.addonFiles || []).map((e) => (typeof e === 'string' ? { path: e } : e));
    state.addonFiles = list.filter((e) => e.path !== file);
    // Removing the one that was switched on falls back to the built-in add-on.
    state.addons = (state.addons || []).filter((f) => f !== file);
    if (state.addon === file) delete state.addon;
    saveState(state);
    return true;
  });
}

module.exports = { register };
