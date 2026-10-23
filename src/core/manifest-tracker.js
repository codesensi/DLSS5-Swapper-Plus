'use strict';
// Manifest bookkeeping for tracked installs: which files were replaced, which
// were added, and where the originals are backed up. Everything here is pure
// accounting over the backup folder - no graphics scanning, no add-on logic -
// so both apply.js and optiscaler.js can require it at the top level without
// a cycle. (scan.js used to sit in the middle of that circle, which is why
// these functions lived behind late require() calls.)

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const pe = require('./pe');
const journal = require('./file-journal');

const BACKUP_DIR = '_DLSS5_Backup';
const MANIFEST = 'manifest.json';

function backupRoot(gameDir) {
  return path.join(gameDir, BACKUP_DIR);
}

// fail() lives here too: every tracker function throws the same coded errors
// the rest of the core layer reads (err.code / err.params), and duplicating it
// would invite drift.
function fail(code, params) {
  const error = new Error(code);
  error.code = code;
  error.params = params || {};
  return error;
}

function originalPath(gameDir, manifest, rel) {
  const prefix = manifest.backupPrefix || '';
  if (prefix && !/^originals\/[a-f0-9-]+$/.test(prefix)) throw fail('errBackupInvalid');
  return journal.safePath(backupRoot(gameDir), path.join(prefix, rel));
}

const relKey = (rel) => path.normalize(String(rel)).toLowerCase();

// An active manifest describes the machine state from before the first swap,
// not merely the most recent click on Install. Reusing it is what makes a
// second install (or an upgrade to a newer payload) still restore the genuine
// originals instead of forgetting files that were already up to date.
function beginManifest(gameDir, exePath, api) {
  const manifestPath = path.join(backupRoot(gameDir), MANIFEST);
  let previous = null;
  if (fs.existsSync(manifestPath)) {
    try {
      previous = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      throw fail('errBackupInvalid');
    }
    if (!previous || previous.version !== 1) throw fail('errBackupInvalid');
  }

  return {
    ...(previous || {}),
    version: 1,
    backupPrefix: previous ? (previous.backupPrefix || '') : `originals/${crypto.randomUUID()}`,
    date: new Date().toISOString(),
    game: { dir: gameDir, exe: path.relative(gameDir, exePath), api },
    replaced: Array.isArray(previous && previous.replaced) ? [...previous.replaced] : [],
    added: Array.isArray(previous && previous.added) ? [...previous.added] : [],
    addedDirs: Array.isArray(previous && previous.addedDirs) ? [...previous.addedDirs] : [],
    reshade: {
      installedByUs: false,
      file: null,
      filesAdded: [],
      ...((previous && previous.reshade) || {})
    }
  };
}

async function saveActiveManifest(gameDir, manifest) {
  await journal.capture(gameDir, path.join(backupRoot(gameDir), MANIFEST));
  await fs.promises.mkdir(backupRoot(gameDir), { recursive: true });
  await journal.atomicJson(path.join(backupRoot(gameDir), MANIFEST), manifest);
}

function wasAdded(manifest, rel) {
  const key = relKey(rel);
  return manifest.added.some((item) => relKey(item) === key);
}

function rememberAdded(manifest, rel) {
  if (!wasAdded(manifest, rel)) manifest.added.push(rel);
}

function rememberAddedDir(manifest, rel) {
  if (!manifest.addedDirs) manifest.addedDirs = [];
  if (!manifest.addedDirs.includes(rel)) manifest.addedDirs.push(rel);
}

// Keep the first oldVersion forever: it is the version in the backup. Later
// installs may update newVersion, but must never turn an app-added file into a
// replacement or replace the identity of the user's original file.
function rememberReplacement(manifest, item) {
  if (wasAdded(manifest, item.rel)) return;
  const key = relKey(item.rel);
  const previous = manifest.replaced.find((row) => relKey(row.rel) === key);
  if (previous) {
    previous.newVersion = item.newVersion;
    if (item.kind && !previous.kind) previous.kind = item.kind;
    return;
  }
  manifest.replaced.push(item);
}

// Directories an install creates on the way to a deeper target must be
// remembered, or a restore leaves empty shells behind.
function rememberMissingParents(manifest, gameDir, target) {
  const missing = [];
  let current = path.dirname(target);
  const root = path.resolve(gameDir);
  while (path.resolve(current).toLowerCase() !== root.toLowerCase()) {
    const rel = path.relative(root, current);
    if (rel.startsWith('..') || path.isAbsolute(rel)) break;
    if (!fs.existsSync(current)) missing.push(rel);
    current = path.dirname(current);
  }
  for (const rel of missing.reverse()) rememberAddedDir(manifest, rel);
}

async function copyOver(src, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  await fs.promises.copyFile(src, dest);
  // Windows carries the source's read-only attribute across a copy, and the
  // payload inside an installed app is read-only. A read-only ReShade.ini is
  // exactly what "Unable to save configuration" on the game's screen means,
  // and a read-only DLL makes the next install or restore fail on overwrite.
  try { await fs.promises.chmod(dest, 0o666); } catch { /* the copy is what matters */ }
}

async function trackBeforeWrite(manifest, gameDir, target, meta = {}) {
  const rel = path.relative(gameDir, target);
  journal.safePath(gameDir, rel);
  if (rel.split(path.sep)[0].toLowerCase() === BACKUP_DIR.toLowerCase()) throw fail('errUnsafeTarget', { rel });
  await journal.capture(gameDir, target);
  rememberMissingParents(manifest, gameDir, target);
  if (fs.existsSync(target)) {
    if (!wasAdded(manifest, rel)) {
      const backupPath = originalPath(gameDir, manifest, rel);
      if (!fs.existsSync(backupPath)) await copyOver(target, backupPath);
      rememberReplacement(manifest, {
        rel,
        oldVersion: meta.oldVersion === undefined ? pe.getFileVersion(target) : meta.oldVersion,
        newVersion: meta.newVersion,
        kind: meta.kind
      });
    }
  } else {
    rememberAdded(manifest, rel);
  }
  return rel;
}

async function copyTracked(manifest, gameDir, src, dest, meta = {}) {
  const rel = await trackBeforeWrite(manifest, gameDir, dest, meta);
  await saveActiveManifest(gameDir, manifest);
  await copyOver(src, dest);
  return rel;
}

async function writeTracked(manifest, gameDir, dest, text, meta = {}) {
  const rel = await trackBeforeWrite(manifest, gameDir, dest, meta);
  await saveActiveManifest(gameDir, manifest);
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  // A file an earlier install copied in can be read-only, and Windows refuses
  // to rewrite it: clear the attribute before, not only after.
  try { await fs.promises.chmod(dest, 0o666); } catch { /* absent is normal */ }
  await fs.promises.writeFile(dest, text, 'utf8');
  return rel;
}

// Retired manifests are the .done snapshots a restore leaves behind. They are
// the recovery path when the active manifest is missing or unreadable, and the
// scan needs them too - which is why they live here instead of in apply.js,
// whose top-level require of scan.js is exactly the seam this module unwinds.
function retiredManifests(gameDir) {
  const root = backupRoot(gameDir);
  let names = [];
  try { names = fs.readdirSync(root); } catch { return []; }
  return names
    .filter((name) => name.startsWith(MANIFEST + '.done'))
    .map((name) => {
      const full = path.join(root, name);
      let at = 0;
      try { at = fs.statSync(full).mtimeMs; } catch {}
      return { name, path: full, at };
    })
    .sort((a, b) => b.at - a.at);
}

// Something this manifest put there is still in the game. A size that differs
// from the backup is enough; hashing a 160 MB runtime to answer a question
// about a button is not.
function stillInstalled(gameDir, manifest) {
  const size = (file) => { try { return fs.statSync(file).size; } catch { return null; } };
  for (const rel of manifest.added || []) {
    try { if (fs.existsSync(journal.safePath(gameDir, rel))) return true; } catch {}
  }
  for (const item of manifest.replaced || []) {
    try {
      const target = size(journal.safePath(gameDir, item.rel));
      const backup = size(originalPath(gameDir, manifest, item.rel));
      if (target !== null && backup !== null && target !== backup) return true;
    } catch {}
  }
  return false;
}

function recoverableManifest(gameDir) {
  for (const entry of retiredManifests(gameDir)) {
    let manifest = null;
    try { manifest = JSON.parse(fs.readFileSync(entry.path, 'utf8')); } catch { continue; }
    if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.added) || !Array.isArray(manifest.replaced)) continue;
    if (stillInstalled(gameDir, manifest)) return { ...entry, manifest };
  }
  return null;
}

module.exports = { BACKUP_DIR, MANIFEST, backupRoot, originalPath, beginManifest, saveActiveManifest, wasAdded, rememberAdded, rememberAddedDir, rememberReplacement, rememberMissingParents, trackBeforeWrite, copyTracked, writeTracked, retiredManifests, stillInstalled, recoverableManifest, fail, relKey };
