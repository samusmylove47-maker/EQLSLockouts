'use strict';

// The browser surface is generated, so the build is part of the deliverable.
//
//   node --test test/build.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'app');

function build() {
  execFileSync(process.execPath, [path.join(ROOT, 'build-app.js')], { cwd: ROOT });
  const name = fs.readFileSync(path.join(OUT_DIR, 'latest.txt'), 'utf8').trim();
  return { name, html: fs.readFileSync(path.join(OUT_DIR, name), 'utf8') };
}

test('BUILD: the page is generated and carries exactly one script block', () => {
  // THE BUG THIS CAUGHT. `String.prototype.replace` gives the REPLACEMENT
  // string special meaning to `$&`, `$\``, `$'` and `$1`. The core contains a
  // comment about a regex end anchor written as "`$`", and `$\`` means "insert
  // everything before the match" — so a plain string replacement spliced the
  // first half of the page back into its own middle. The result had two
  // <script> tags, one unterminated, and the browser threw
  // `SyntaxError: Unexpected token '<'` before the engine ever loaded.
  //
  // It was found by opening the built page in a browser. Nothing in the Node
  // test suite would have noticed, which is the point of this file.
  const { html } = build();
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  assert.equal(html.split('<!doctype html>').length, 2, 'the page must not contain itself');
});

test('BUILD: the embedded engine is the real one and runs standalone', () => {
  const { html } = build();
  // Pull the engine back out of the page and run it, so "it is embedded" is
  // proven rather than assumed.
  const start = html.indexOf('const LockoutCore = (function () {');
  const end = html.indexOf('  return module.exports;', start);
  assert.ok(start > 0 && end > start, 'the engine block must be locatable');
  const body = html.slice(html.indexOf('{', start) + 1, end);
  // eslint-disable-next-line no-new-func
  const core = new Function(`${body}\nreturn module.exports;`)();

  for (const k of ['parseLine', 'applyLine', 'projectGrid', 'createState',
                   'characterFromLogFilename', 'RAIDS', 'RESET_RULE', 'DIFFICULTY_LABELS']) {
    assert.ok(core[k], `the embedded engine must export ${k}`);
  }
  const st = core.createState('Avenrae');
  core.applyLine(st, '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).');
  core.applyLine(st, '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!');
  assert.equal(st.kills.length, 1);
  assert.equal(st.kills[0].difficulty, 4);
});

test('BUILD: the page is self-contained — no network of any kind', () => {
  const { html } = build();
  // A strict page: the log never leaves the machine, and the page works with no
  // connection at all. Anything reaching outward breaks both promises.
  for (const banned of ['http://', 'https://', '<link ', '<img ', '@import', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!html.includes(banned), `the page must not contain ${banned}`);
  }
});

test('BUILD: the filename is content-hashed', () => {
  const { name } = build();
  assert.match(name, /^eqls-lockouts\.[0-9a-f]{8}\.html$/);
  // Rebuilding unchanged input must produce the same name; a changing hash
  // would bust caches on every build and stop meaning anything.
  const again = build();
  assert.equal(again.name, name);
});
