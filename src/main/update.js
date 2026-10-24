'use strict';
// Update check and crash log. Releases move quickly and nothing here updates
// itself, so someone can sit on a build for weeks without knowing. A lookup
// that succeeds is kept for the session; a failed one is not - the next ask
// retries, though no more often than once per window, and the reason lands
// in the crash log. No identifiers are sent, no download is started, and a
// check must never delay a start.

const fs = require('fs');
const path = require('path');

function createUpdate({
  app,
  fetch = globalThis.fetch,
  failureRetryMs = 60 * 1000,
  feedUrl = 'https://github.com/codesensi/DLSS5-Swapper-Plus/releases.atom'
}) {
  let updateAnswer = null;
  let lastFailureAt = 0;

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
    ipcMain.handle('update-check', async (_event, { force = false } = {}) => {
      const current = app.getVersion();
      if (updateAnswer) return updateAnswer;
      if (!force && Date.now() - lastFailureAt < failureRetryMs) {
        return { current, latest: null, newer: false };
      }
      try {
        // The releases feed, not the REST API: the API allows 60 lookups per
        // hour and IP, which a shared proxy exit burns through in minutes.
        // The feed has no such cap. Entries are newest first, prereleases
        // included, so the first plain stable tag is the answer - the same
        // thing /releases/latest would have said.
        const response = await fetch(feedUrl, {
          headers: { 'User-Agent': `DLSS5-Swapper-Plus/${current}`, Accept: 'application/atom+xml' },
          signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) {
          // The body says why (rate limit, abuse block); keep a slice of it
          // for the log instead of a bare status code.
          let detail = '';
          try { detail = `: ${(await response.text()).slice(0, 200)}`; } catch { /* body is a bonus */ }
          throw Object.assign(new Error(`GitHub releases feed responded ${response.status}${detail}`), { status: response.status });
        }
        const feed = String(await response.text());
        const found = feed.match(/releases\/tag\/(v?\d+\.\d+\.\d+)(?![\w.-])/);
        if (!found) throw new Error('The releases feed carries no stable release');
        updateAnswer = { current, latest: found[1].replace(/^v/, ''), newer: newerRelease(current, found[1]) };
      } catch (error) {
        // Offline, rate-limited or blocked: say nothing to the person, but the
        // reason is written down for the diagnostics report, and the failed
        // lookup is not kept - the next ask retries.
        recordCrash('update check', error);
        lastFailureAt = Date.now();
      }
      return updateAnswer || { current, latest: null, newer: false };
    });
  }

  return { register, recordCrash, newerRelease };
}

module.exports = { createUpdate };
