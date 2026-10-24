'use strict';

// CHANGELOG.md starts each release with a heading that carries the version,
// like "## v3.0.0（2026-10-23）" or "## [3.0.0] - 2026-10-23". Category
// headings under it carry no version, so they stay inside the slice. The
// About view shows only the running version's slice, so the panel cannot grow
// with the file.
const VERSION = /\d+\.\d+\.\d+/;

function entryFor(markdown, version) {
  if (typeof markdown !== 'string' || typeof version !== 'string' || !VERSION.test(version)) return null;
  const lines = markdown.split(/\r?\n/);
  let out = null;
  for (const line of lines) {
    const heading = /^#{2}\s+(.*)$/.exec(line.trim());
    if (heading) {
      const found = heading[1].match(VERSION);
      if (found) {
        if (out) break;
        if (found[0] === version) { out = []; continue; }
      }
    }
    if (out) out.push(line);
  }
  if (!out) return null;
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return text || null;
}

module.exports = { entryFor };
