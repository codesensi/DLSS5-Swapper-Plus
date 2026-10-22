'use strict';
// The tray. Closing the window puts the app here rather than ending it, which
// is what #255 asked for: people close a window out of habit and then wonder
// why the overlay stopped answering in the game they are still playing.

const path = require('path');

function createTray({ app, Tray, Menu, nativeImage, appRoot, getWindow, isQuitting }) {
  let tray = null;
  // The main process has no translations of its own, so the renderer hands these
  // over the way it already does for the game context menu.
  let trayLabels = { show: 'Open DLSS 5 Swapper Plus', quit: 'Quit' };

  function showWindow() {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  function buildTrayMenu() {
    if (!tray || tray.isDestroyed()) return;
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: trayLabels.show, click: showWindow },
      { type: 'separator' },
      // The only way out that means it: everything else hides the window.
      { label: trayLabels.quit, click: () => { isQuitting.set(true); app.quit(); } }
    ]));
  }

  function ensureTray() {
    if (tray && !tray.isDestroyed()) return tray;
    const source = nativeImage.createFromPath(path.join(appRoot, 'src', 'renderer', 'icon.png'));
    // A 16px tray icon on Windows; an empty image would throw, so a full-size
    // fallback is better than no tray at all.
    const icon = source.isEmpty() ? source : source.resize({ width: 16, height: 16, quality: 'good' });
    try { tray = new Tray(icon); } catch { return null; }
    tray.setToolTip('DLSS 5 Swapper Plus');
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
    buildTrayMenu();
    return tray;
  }

  function setTrayLabels(labels) {
    if (labels && typeof labels.show === 'string' && typeof labels.quit === 'string') {
      trayLabels = { show: labels.show, quit: labels.quit };
      buildTrayMenu();
    }
    return true;
  }

  return { ensureTray, buildTrayMenu, setTrayLabels, showWindow };
}

module.exports = { createTray };
