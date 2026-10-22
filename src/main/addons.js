'use strict';
// Add-on build catalog and the payload locator. The Electron app object and
// the state reader are injected rather than required, so the whole catalog is
// plain Node and testable without Electron.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// What each build is, keyed by the hash of its contents so a build keeps its
// description wherever the file is moved or renamed to. The bullet lists are
// the authors' own release notes from the RenoDX Discord, kept verbatim and
// untranslated for the same reason a changelog is: they are a quote, not our
// wording. Anything unrecognised falls back to the folder it sits in.
const KNOWN = {
  // The build that used to ship. Recognised if someone adds it by hand, but
  // it is no longer the one bundled.
  '189efdee6a327833': { name: 'Stable (previous)' },
  // Superseded by the v4.7 that now ships. Kept recognised so a hand-added copy
  // is still named rather than showing up as its folder.
  '0c0a02578d2aadf2': { name: 'v4.6 (previous)' },
  // Bundled: the build the in-game overlay's adapter is fingerprinted against.
  '88116071ef689864': {
    name: 'v4.7',
    shipped: true
  }
};

// An add-on's identity is the hash of its contents, and the add-ons page asks
// for it every time it is opened - which meant reading and hashing several
// megabytes per file on each visit. A file is the same file while its path,
// size and modification time are unchanged, so the answer is kept.
const describedFiles = new Map();

function createAddons({ app, appRoot, loadState, pe, scanSource }) {
  function addonFolders() {
    if (!app.isPackaged) return [path.join(appRoot, 'dist', 'addons')];
    return [
      path.join(process.resourcesPath, 'addons'),
      path.join(path.dirname(app.getPath('exe')), 'addons')
    ];
  }

  function describe(file, label) {
    let stat;
    try { stat = fs.statSync(file); } catch { return null; }
    const key = path.resolve(file).toLowerCase();
    const stamp = `${stat.size}:${stat.mtimeMs}`;
    const remembered = describedFiles.get(key);
    let id, version, size;
    if (remembered && remembered.stamp === stamp) {
      ({ id, version, size } = remembered);
    } else {
      let buf;
      try { buf = fs.readFileSync(file); } catch { return null; }
      version = pe.getFileVersion(file);
      id = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
      size = buf.length;
      describedFiles.set(key, { stamp, id, version, size });
    }
    // This former bundled companion duplicates capabilities now provided by the
    // integrated RenoDX and Feeder routes and can conflict when loaded beside
    // them. Hide stale copies left behind by an older installation too.
    if (id === '76e8a0c90a6b99a7') return null;
    const known = KNOWN[id] || {};
    return {
      ...known,
      // Identity is the content, not the path: the same build sits both in the
      // app payload and loose in the project root, and listing it twice would
      // invite someone to "switch" to the build already running.
      id,
      path: file,
      file: path.basename(file),
      label: known.name || label,
      // A build with no version resource reports 0.0.0.0, which says nothing.
      version: version && version !== '0.0.0.0' ? version : null
    };
  }

  function addonLibrary() {
    const found = [];
    const seen = new Set();
    const add = (file, label, own) => {
      if (!/\.addon(64)?$/i.test(file)) return;
      const row = describe(file, label);
      if (row && own) {
        row.custom = true;
        // Hand-added builds are listed exactly as given. Nearly every build is
        // called renodx-dlss.addon64 and several share their contents, so
        // matching on either would refuse files the person deliberately picked.
        // Only the path decides, and the row is always theirs to delete.
        row.id = 'custom:' + path.resolve(file).toLowerCase();
        // A hand-added build is described only by what the person typed. It used
        // to fall back on the recognised build's entry, so an add-on named
        // "tajriba" came back wearing somebody else's release notes and warning.
        row.label = own.name || path.basename(path.dirname(file));
        row.notes = own.notes && own.notes.length ? own.notes : null;
        row.warn = own.tag || null;
        row.caution = null;
        row.shipped = false;
      }
      // The payload copy is added first, so it is the one that survives and the
      // list says "shipped with the app" rather than naming a stray folder.
      if (row && !seen.has(row.id)) { seen.add(row.id); found.push(row); }
    };

    const p = payload(true);
    if (p && p.source.addon) add(p.source.addon, null);

    for (const box of addonFolders()) {
      let dropped = [];
      try { dropped = fs.readdirSync(box); } catch { continue; /* no such folder is normal */ }
      for (const f of dropped) add(path.join(box, f), null);
    }

    for (const e of loadState().addonFiles || []) {
      const row = typeof e === 'string' ? { path: e } : e;
      add(row.path, null, {
        custom: true, name: row.name || null, notes: row.notes || null, tag: row.tag || null
      });
    }

    // The shipped build is the base, not a choice, so it is not offered.
    const base = p && path.basename(p.source.addon).toLowerCase();
    const chosen = new Set(enabledAddons());
    return found
      .filter((r) => !r.shipped)
      .map((r) => ({
        ...r,
        active: chosen.has(r.path),
        // Same file name as the base means it overwrites it rather than joining.
        replaces: path.basename(r.path).toLowerCase() === base
      }));
  }

  // The payload that ships with the app. `raw` skips the add-on override,
  // which is how the library finds the shipped build in the first place.
  function payload(raw) {
    // Installed, the payload rides along as an extra resource; from source it
    // sits beside main.js.
    for (const dir of [path.join(process.resourcesPath || '', 'payload'), path.join(appRoot, 'dist', 'payload')]) {
      const probe = scanSource(dir);
      if (probe.ok) {
        const setup = fs.readdirSync(dir).find((f) => /^ReShade_Setup_.*_Addon\.exe$/i.test(f));
        // Point at the chosen build instead of copying files around: the payload
        // folder is what a build ships, and switching must not rewrite it.
        // Only a same-named build changes what applySwap installs; a differently
        // named one is copied in afterwards, beside the base.
        if (!raw) {
          const state = loadState();
          const list = state.addons || (state.addon ? [state.addon] : []);
          const base = path.basename(probe.addon).toLowerCase();
          const over = list.find((f) => fs.existsSync(f) && path.basename(f).toLowerCase() === base);
          if (over) probe.addon = over;
        }
        return { source: probe, reshadeSetup: setup ? path.join(dir, setup) : null };
      }
    }
    return null;
  }

  // Which builds are switched on. Any number can be, because ReShade loads every
  // .addon64 in the folder. `state.addon` was a single path in earlier versions.
  function enabledAddons() {
    const state = loadState();
    const list = state.addons || (state.addon ? [state.addon] : []);
    return list.filter((f) => fs.existsSync(f) && describe(f, null));
  }

  // The one that takes the base's place, if any: same file name means the same
  // file on disk, so it lands on top rather than beside it.
  function replacementAddon() {
    const p = payload(true);
    if (!p) return null;
    const base = path.basename(p.source.addon).toLowerCase();
    return enabledAddons().find((f) => path.basename(f).toLowerCase() === base) || null;
  }

  // The rest ride along with the base. Two builds sharing a file name cannot both
  // be written, so the first switched on keeps the name.
  function companionAddons() {
    const p = payload(true);
    if (!p) return [];
    const taken = new Set([path.basename(p.source.addon).toLowerCase()]);
    const out = [];
    for (const f of enabledAddons()) {
      const name = path.basename(f).toLowerCase();
      if (taken.has(name)) continue;
      taken.add(name);
      out.push(f);
    }
    return out;
  }

  // apply.js keeps its own copy of this private to the module, and the same
  // thing is needed here for the second add-on placed beside it.
  function enableAddon(exeDir, addonName) {
    const ini = path.join(exeDir, 'ReShade.ini');
    if (!fs.existsSync(ini)) return;
    const text = fs.readFileSync(ini, 'utf8');
    const stem = addonName.replace(/\.addon(64)?$/i, '');
    const match = text.match(/^DisabledAddons=(.*)$/m);
    if (match && match[1].toLowerCase().includes(stem.toLowerCase())) {
      fs.writeFileSync(ini, text.replace(/^DisabledAddons=.*$/m, 'DisabledAddons='), 'utf8');
    }
  }

  return {
    describe, addonFolders, addonLibrary, payload,
    enabledAddons, replacementAddon, companionAddons, enableAddon
  };
}

module.exports = { createAddons };
