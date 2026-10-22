'use strict';
// Update check and crash log. Releases move quickly and nothing here updates
// itself, so someone can sit on a build for weeks without knowing. One lookup
// per launch, no identifiers sent, no download started: the answer is a
// version number and a link the person may click. Any failure is silence -
// this must never delay a start.

const fs = require('fs');
const path = require('path');

function createUpdate({ app, fetch = globalThis.fetch }) {
  let updateAnswer = null;

  // Nothing wrote the app's own failures down anywhere, so a crash left the
  // person with nothing to report but a description. Keep the last few in
  // userData, bounded, and let the diagnostics file carry them.
  function recordCrash(kind, error) {
    try {
      const file = path.join(app.getPath('userData'), 'crash.log');
      const entry = `[${new Date().toISOString()}] ${kind}: ${error && error.stack ? error.stack : String(error)}\n\n`;
      let previous = '';
      try { previous = fs.readFileSync(file, 'utf8'); } catch { /* first one */ }
      // Newest last, oldest dropped: 256 KB is plenty and cannot grow unbounded.
      const combined = (previous + entry).slice(-256 * 1024);
      fs.writeFileSync(file, combined, 'utf8');
    } catch { /* a failure to record a failure is not worth a second one */ }
  }

  const releaseTag = /^v?(\d+)\.(\d+)\.(\d+)/;
  function newerRelease(current, latest) {
    const a = releaseTag.exec(current), b = releaseTag.exec(latest);
    if (!a || !b) return false;
    for (let i = 1; i <= 3; i++) {
      if (Number(b[i]) > Number(a[i])) return true;
      if (Number(b[i]) < Number(a[i])) return false;
    }
    return false;
  }

  function register(ipcMain) {
    ipcMain.handle('update-check', async () => {
      if (updateAnswer) return updateAnswer;
      const current = app.getVersion();
      try {
        const response = await fetch('https://api.github.com/repos/codesensi/DLSS5-Swapper-Plus/releases/latest', {
          headers: { 'User-Agent': `DLSS5-Swapper-Plus/${current}`, Accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) throw Error(String(response.status));
        const release = await response.json();
        const latest = String(release.tag_name || '').replace(/^v/, '');
        updateAnswer = { current, latest, newer: newerRelease(current, latest) };
      } catch {
        // Offline, rate-limited or blocked: say nothing rather than worry anyone.
        updateAnswer = { current, latest: null, newer: false };
      }
      return updateAnswer;
    });
  }

  return { register, recordCrash, newerRelease };
}

module.exports = { createUpdate };
