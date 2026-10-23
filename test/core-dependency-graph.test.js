'use strict';
// Guards the dependency direction of the core layer. The scan -> apply -> scan
// triangle used to be suppressed with late require() calls until
// manifest-tracker took the manifest workload out of the middle of it; this
// test keeps src/core a directed acyclic graph for good, the same check a
// dedicated CI job would run, but as part of the ordinary suite.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CORE = path.join(__dirname, '..', 'src', 'core');

function dependencyEdges() {
  const edges = new Map();
  for (const name of fs.readdirSync(CORE).filter(f => f.endsWith('.js'))) {
    const file = path.join(CORE, name);
    const list = [];
    const re = /require\(['"](\.[^'"]+)['"]\)/g;
    let m;
    while ((m = re.exec(fs.readFileSync(file, 'utf8')))) {
      const target = path.join(CORE, path.join(path.dirname(path.join(CORE, name)), m[1]));
      // Only in-tree edges count; extract-zip and other packages do not.
      if (fs.existsSync(target + '.js') && path.dirname(target) === CORE) list.push(target + '.js');
    }
    edges.set(file, list);
  }
  return edges;
}

test('src/core stays a dependency tree: no circular requires anywhere', () => {
  const edges = dependencyEdges();
  const indeg = new Map([...edges.keys()].map(f => [f, 0]));
  for (const list of edges.values()) for (const t of list) indeg.set(t, indeg.get(t) + 1);
  const queue = [...edges.keys()].filter(f => !indeg.get(f));
  const seen = new Set();
  while (queue.length) {
    const node = queue.pop();
    seen.add(node);
    for (const t of edges.get(node) || []) {
      indeg.set(t, indeg.get(t) - 1);
      if (!indeg.get(t)) queue.push(t);
    }
  }
  const cyclic = [...edges.keys()].filter(f => !seen.has(f));
  assert.deepEqual(cyclic, [], `circular requires found: ${cyclic.map(f => path.basename(f)).join(', ')}`);
});

test('the old scan -> apply seam stays severed: scan.js must not require apply.js', () => {
  const src = fs.readFileSync(path.join(CORE, 'scan.js'), 'utf8');
  assert.doesNotMatch(src, /require\(['"]\.\/apply['"]\)/);
});
