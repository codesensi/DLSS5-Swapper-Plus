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
    if (cached && cached.rules === ctx.ART_RULES) return cached;

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
      return { error: err.message };
    }
  });
}

module.exports = { register };
