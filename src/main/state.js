'use strict';
// State layer: the persisted library.json document and the preference
// readers built on top of it. The app object is injected rather than
// required, so everything here is plain Node and testable without Electron.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const renderingApi = require('../shared/rendering-api');

function createState({ app }) {
  const stateFile = () => path.join(app.getPath('userData'), 'library.json');
  const posterDir = () => path.join(app.getPath('userData'), 'posters');
  const keyFor = (dir) => crypto.createHash('sha1').update(path.resolve(dir).toLowerCase()).digest('hex').slice(0, 16);
  // Bump when scan metadata or detection changes so an old wrong result is not
  // kept forever merely because the folder was scanned by an earlier release.
  const SCAN_RULES = 7;

  // One live object, not a fresh snapshot per call. Every handler used to parse
  // the file, hold that copy across an await, and write the whole thing back:
  // two scans running at once each wrote their own stale copy, and whichever
  // finished last silently dropped the other's result. Sharing the object means
  // every write carries everything already known.
  let liveState = null;

  // The OS language seeds the first launch only. One of the shipped languages
  // wins when Electron reports a matching locale (zh-TW/zh-HK match before the
  // bare zh); anything else stays English. Saved once via set-lang, this stays
  // out of the way afterwards.
  const SHIPPED_LOCALES = ['en', 'zh', 'ja', 'ko', 'zh-TW'];
  function defaultLocale() {
    try {
      const locale = (app.getLocale() || '').replace('_', '-');
      const exact = SHIPPED_LOCALES.find((code) => code.toLowerCase() === locale.toLowerCase());
      if (exact) return exact;
      const base = locale.toLowerCase().split('-')[0];
      if (base === 'zh') return 'zh';
      return SHIPPED_LOCALES.find((code) => code.toLowerCase() === base) || 'en';
    } catch { return 'en'; }
  }

  function readState() {
    try {
      const value = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
      if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch { /* absent or unreadable: start from the defaults below */ }
    // Nothing seeded: the drive sweep finds game libraries on its own, and a
    // path from the machine this was written on means nothing anywhere else.
    return { folders: [], excludedRoots: [], manual: [], posters: {}, hidden: [], scans: {} };
  }

  function loadState() {
    if (!liveState) liveState = readState();
    return liveState;
  }

  function saveState(state) {
    // A handler that built its own object still becomes the live one, so a caller
    // that does not go through loadState() cannot resurrect the old race.
    if (state && state !== liveState) liveState = state;
    try {
      fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
      fs.writeFileSync(stateFile(), JSON.stringify(liveState, null, 2), 'utf8');
      return true;
    } catch { return false; }
  }

  // A choice belongs to one executable, not every launcher in the same folder.
  const apiPreferenceKey = (dir, exe) => crypto.createHash('sha256')
    .update(path.resolve(dir).toLowerCase()).update('\\0')
    .update(path.relative(dir, exe).toLowerCase()).digest('hex');
  function apiPreference(state, dir, exe) {
    const value = state.apiOverrides?.[apiPreferenceKey(dir, exe)];
    return renderingApi.valid(value) ? value : 'auto';
  }
  // #328: which file ReShade goes in as, per executable. dxgi.dll unless the
  // person chose d3d11.dll for a DirectX 11 game that never loads dxgi.dll.
  function reshadeProxyPreference(state, dir, exe) {
    return state.reshadeProxy?.[apiPreferenceKey(dir, exe)] === 'd3d11' ? 'd3d11' : 'dxgi';
  }

  return {
    stateFile, posterDir, keyFor, SCAN_RULES,
    readState, loadState, saveState, defaultLocale,
    apiPreferenceKey, apiPreference, reshadeProxyPreference
  };
}

module.exports = { createState };
