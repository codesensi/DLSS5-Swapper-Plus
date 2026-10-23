'use strict';
// Steam artwork lookup and caching for game posters.

const path = require('path');
const { pathToFileURL } = require('url');

function register(ctx) {
  const { app, ipcMain } = ctx;
  const { loadState, saveState, keyFor } = ctx;

  ipcMain.handle('art-status', () => ({ available: ctx.art.available() }));

  ipcMain.handle('art-fetch', async (_event, dir, name, appid) => {
    const state = loadState();
    const key = keyFor(dir);
    const cached = state.art && state.art[key];
    // Negative entries only serve for ten minutes; positive ones live by rules.
    if (cached && cached.rules === ctx.ART_RULES) {
      if (cached.negative && Date.now() - (cached.fetchedAt || 0) > 600000) return loadAndLook();
      return cached;
    }

    return loadAndLook();

    async function loadAndLook() {
      try {
        const hit = await ctx.art.look(name, appid);
        if (!hit) return { none: true };

        const dest = path.join(app.getPath('userData'), 'art');
        const record = { ...hit, cover: null, hero: null, rules: ctx.ART_RULES, fetchedAt: Date.now() };
        const grab = async (url, suffix) => {
          try { return pathToFileURL(await ctx.art.download(url, path.join(dest, key + suffix))).href; }
          catch { return null; }
        };
        record.cover = await grab(hit.coverUrl, '-cover.jpg');
        // A few older apps have no hero image; the store header is the same shape.
        record.hero = await grab(hit.heroUrl, '-hero.jpg');
        if (!record.hero && hit.heroFallbackUrl) record.hero = await grab(hit.heroFallbackUrl, '-hero.jpg');

        state.art = state.art || {};
        state.art[key] = record;
        saveState(state);
        return record;
      } catch (err) {
        // A failed look-up is cached too, briefly: without it every reopen and
        // every launch pays the network timeouts all over again for a game
        // whose artwork can't be found. Positive records live by ART_RULES;
        // negative ones expire in ten minutes so a transient outage only
        // delays the artwork.
        state.art = state.art || {};
        state.art[key] = { error: err.message, rules: ctx.ART_RULES, fetchedAt: Date.now(), negative: true };
        saveState(state);
        return { error: err.message };
      }
    }
  });
}

module.exports = { register };
