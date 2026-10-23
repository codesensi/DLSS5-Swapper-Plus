'use strict';
// The main window. The close-to-tray behaviour lives in the window's own
// close handler, so the window layer also owns the quitting flag read.

const path = require('path');

function createWindowLayer({ app, BrowserWindow, appRoot, loadState, ensureTray, missingPayload }) {
  let win = null;
  let quitting = false;

  // The portable build runs from a folder it extracts into %TEMP% on each launch;
  // an installed copy runs from where it was installed. Which one is speaking
  // changes what the person should do about a missing payload.
  const runningPortable = () =>
    Boolean(process.env.PORTABLE_EXECUTABLE_DIR) ||
    /[\\/]Temp[\\/]/i.test(process.resourcesPath || '');

  const payloadMissing = () => missingPayload({
    packaged: app.isPackaged,
    resourcesPath: process.resourcesPath || appRoot,
    appRoot,
    portable: runningPortable(),
    temp: app.getPath ? (() => { try { return app.getPath('temp'); } catch { return null; } })() : null
  });

  function createWindow() {
    const created = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 1040,
      minHeight: 700,
      backgroundColor: '#05070a',
      icon: path.join(appRoot, 'src', 'renderer', 'icon.png'),
      // The window draws its own title bar, so the frame comes off.
      frame: false,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(appRoot, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        // The preload only bridges IPC and one webUtils call, both available
        // inside the sandbox - same shape as the overlay panel's window.
        sandbox: true
      }
    });
    created.loadFile(path.join(appRoot, 'src', 'renderer', 'index.html'));
    created.once('ready-to-show', () => created.show());
    // Close hides to the tray unless the person turned that off, or unless the
    // app is genuinely quitting - Quit in the tray menu, or the OS asking.
    created.on('close', (event) => {
      if (quitting || loadState().closeToTray === false || !ensureTray()) return;
      event.preventDefault();
      created.hide();
    });
    created.on('closed', () => {
      win = null;
      // The overlay bridge holds an offscreen window, so the window list is
      // never empty and window-all-closed never arrives: without this the
      // process stayed in Task Manager with nothing on screen.
      if (!quitting) app.quit();
    });
    win = created;
    return created;
  }

  function showWindow() {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  return {
    createWindow,
    getWindow: () => win,
    showWindow,
    runningPortable,
    payloadMissing,
    getQuitting: () => quitting,
    setQuitting: (value) => { quitting = value; }
  };
}

module.exports = { createWindowLayer };
