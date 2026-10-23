'use strict';
const path = require('node:path');
const { createOverlayLibrary } = require('../core/overlays');

module.exports = function registerOverlayIpc({ app, ipcMain, dialog, shell, window, bridge = () => null, featureText = (key) => key, isMutationBusy = () => false }) {
  const appRoot = path.resolve(__dirname, '..', '..');
  // Installed, the built add-on rides along as an extra resource; from source it
  // is whatever scripts/build/build-overlay.ps1 last produced.
  const builtin = () => (app.isPackaged
    ? path.join(process.resourcesPath, 'overlay', 'dlss5-lab-overlay.addon64')
    : path.join(appRoot, 'dist/overlay/dlss5-lab-overlay.addon64'));
  // Never let an overlay be installed over the app's own directory.
  const forbidden = () => [appRoot, app.isPackaged ? path.dirname(app.getPath('exe')) : appRoot];
  const library = () => createOverlayLibrary(path.join(app.getPath('userData'), 'overlay-library'),
    builtin(), forbidden());
  const handle = (name, fn) => ipcMain.handle(`overlay-${name}`, async (_event, ...args) => {
    try { return { ok: true, value: await fn(...args) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
  // install/uninstall write into a game's folder, so they must not interleave
  // with an install/restore from the Games page: the busy flag is re-checked
  // after the dialogs, since those await a human while a mutation may start.
  const busy = () => { if (isMutationBusy()) throw Error(featureText('errJobBusy')); };
  handle('list', () => library().list());
  // What the panel in the game is waiting for, said on the Overlay page:
  // whether the service is up at all, and whether a game is attached.
  handle('bridge', () => {
    const live = bridge();
    const state = live ? live.state() : { listening: false, connected: false, game: false };
    // The service can be listening perfectly while the add-on the game has to
    // load is not there at all - antivirus takes it, and nothing said so.
    // resolve() hashes the file, so a truncated or gutted one throws rather
    // than reporting itself absent. Either way the game cannot load it.
    let addon = false, addonFile = null;
    try { const entry = library().resolve('builtin'); addon = Boolean(entry.ready); addonFile = entry.file; }
    catch { addon = false; }
    return { ...state, addon, addonFile };
  });
  handle('preferences',()=>require('./overlay-preferences').read(app.getPath('userData')));
  handle('save-preferences',patch=>require('./overlay-preferences').save(app.getPath('userData'),patch));
  handle('add', async () => {
    const picked = await dialog.showOpenDialog(window(), { title: featureText('overlayAddTitle'), properties: ['openFile'], filters: [{ name: featureText('overlayAddFilter'), extensions: ['addon64', 'addon32'] }] });
    if (picked.canceled) return null;
    const confirm = await dialog.showMessageBox(window(), { type: 'warning', title: featureText('overlayAddConfirmTitle'),
      message: featureText('overlayAddConfirm'),
      detail: featureText('overlayAddDetail'),
      buttons: [featureText('cancel'), featureText('overlayAddAccept')], defaultId: 0, cancelId: 0 });
    return confirm.response === 1 ? library().add(picked.filePaths[0]) : null;
  });
  handle('remove', async id => {
    const entry = library().resolve(id);
    if (entry.builtin) throw Error(featureText('overlayBuiltinProtected'));
    const confirm = await dialog.showMessageBox(window(), { type: 'question', message: featureText('overlayRemoveTitle', entry.name), detail: featureText('overlayRemoveDetail'), buttons: [featureText('cancel'), featureText('overlayRemoveAccept')], defaultId: 0, cancelId: 0 });
    if (confirm.response === 1) library().remove(id);
  });
  handle('install', async id => {
    busy();
    const entry = library().resolve(id);
    if (!entry.ready) throw Error(featureText('overlayBuildFirst'));
    const picked = await dialog.showOpenDialog(window(), { title: featureText('overlayTestGameTitle'), properties: ['openFile'], filters: [{ name: featureText('overlayTestExeFilter'), extensions: ['exe'] }] });
    if (picked.canceled) return null;
    busy();
    const confirm = await dialog.showMessageBox(window(), { type: 'warning', title: featureText('overlayTestTitle'),
      message: featureText('overlayTestConfirm'),
      detail: `${picked.filePaths[0]}\n\n${featureText('overlayTestDetail')}`,
      buttons: [featureText('cancel'), featureText('overlayTestAccept')], defaultId: 0, cancelId: 0 });
    if (confirm.response !== 1) return null;
    busy();
    return library().install(id, picked.filePaths[0]);
  });
  handle('uninstall', async id => {
    const confirm = await dialog.showMessageBox(window(), { type: 'question', message: featureText('overlayUninstallAsk'), detail: featureText('overlayUninstallDetail'), buttons: [featureText('cancel'), featureText('overlayUninstallAccept')], defaultId: 0, cancelId: 0 });
    if (confirm.response !== 1) return;
    busy();
    library().uninstall(id);
  });
  handle('source', async () => {
    const error = await shell.openPath(path.join(appRoot, 'overlay'));
    if (error) throw Error(error);
  });
};
