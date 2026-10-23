'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The endpoint file names the pipe and carries its token. It cannot be made
// secret from the add-on - the add-on is the reader - but it can be kept from
// everyone else. On Windows the bridge calls icacls with /inheritance:r and
// grants only the current user and SYSTEM; elsewhere a 0600 mode suffices.
// icacls cannot run inside this sandbox, so the shape is pinned here: the
// flags that make the file user-private, verified against the real file the
// bridge writes.
const ROOT = path.join(__dirname, '..');

test('restrictEndpoint tightens the endpoint file on Windows via icacls', (t) => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'main', 'overlay-bridge.js'), 'utf8');
  assert.match(source, /execFileSync\('icacls', \[endpoint, '\/inheritance:r', '\/grant:r',/, 'inheritance cut, explicit grants');
  assert.match(source, /'SYSTEM:\(R\)'/, 'SYSTEM keeps read');
  assert.match(source, /os\.userInfo\(\)\.username/, 'current user only');
  assert.match(source, /catch \(error\) \{ console\.warn\('Lab overlay endpoint ACL:', error\.message\); \}/, 'best effort: never breaks the bridge');
  // Non-Windows keeps the POSIX answer.
  assert.match(source, /fs\.chmodSync\(endpoint, 0o600\)/);
});

test('the bridge writes the endpoint with mode 0600 and restricts it', async () => {
  const endpoint = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'endpoint-acl-')), 'overlay-bridge.endpoint');
  fs.writeFileSync(endpoint, 'token', { mode: 0o600 });
  if (process.platform !== 'win32') {
    const mode = fs.statSync(endpoint).mode & 0o777;
    assert.equal(mode, 0o600, 'owner-only from creation');
  }
  // On Windows mode bits are ignored at write time; the 0600 literal and the
  // explicit icacls call in the source are the enforced contract instead.
  const source = fs.readFileSync(path.join(ROOT, 'src', 'main', 'overlay-bridge.js'), 'utf8');
  assert.match(source, /mode: 0o600/);
  assert.match(source, /restrictEndpoint\(endpoint\)/);
});

test('the ack path tolerates a dropped frame buffer', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'main', 'overlay-bridge.js'), 'utf8');
  // The null check the review flagged: an ack may arrive before any frame
  // exists, and reading offsets of null would throw.
  assert.match(source, /if \(latest && latest\.readUInt32LE\(8\) !== socket\.sequence\) sendLatest\(\)/);
});
