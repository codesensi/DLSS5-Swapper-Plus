'use strict';
// The changelog panel shows one slice: the running version's own section of
// CHANGELOG.md. These tests pin the heading shapes the file actually uses -
// "## v3.0.0（2026-10-23）" today, bracketed and v-less spellings tomorrow -
// and that category headings under a version stay inside its slice.
const test = require('node:test');
const assert = require('node:assert/strict');
const { entryFor } = require('../src/core/changelog');

const MD = [
  '# 更新日志（CHANGELOG）',
  '',
  '## v3.1.0（2026-11-23）',
  '',
  '- newer thing',
  '',
  '## ✨ 分类',
  '- category inside newer',
  '',
  '## v3.0.0（2026-10-23）',
  '',
  '## ✨ 界面与多语言',
  '',
  '- **多语言化**：五语对等',
  '- more',
  '',
  '## 🛠️ 问题修复',
  '',
  '- fixed thing'
].join('\n');

test('the running version gets its own slice; category headings stay inside', () => {
  const text = entryFor(MD, '3.0.0');
  assert.match(text, /界面与多语言/);
  assert.match(text, /fixed thing/);
  assert.doesNotMatch(text, /newer thing/);
  assert.doesNotMatch(text, /category inside newer/);
});

test('bracketed and v-prefixed headings both count as versions', () => {
  assert.equal(entryFor('## [3.0.0] - 2026-10-23\n- a\n', '3.0.0'), '- a');
  assert.equal(entryFor('## v3.0.0\n- a\n', '3.0.0'), '- a');
});

test('versions without an entry read as nothing, never as another slice', () => {
  assert.equal(entryFor(MD, '2.9.0'), null);
  assert.equal(entryFor(MD, 'not-a-version'), null);
  assert.equal(entryFor(null, '3.0.0'), null);
});
