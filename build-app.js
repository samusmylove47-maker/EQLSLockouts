'use strict';

// Builds the browser surface.
//
//   node build-app.js
//
// Embeds src/lockoutCore.js verbatim into src/app.template.html and writes
// public/app/eqls-lockouts.<hash>.html.
//
// THE HASH IS LOAD-BEARING, not decoration. An unhashed copy goes stale in a
// reader's cache and they keep seeing last week's page forever, which for a
// tool whose whole job is "do not forget a raid" is the worst possible failure.
// This mirrors what _build/skyledger.py does in the eql-source repo.
//
// THE ENGINE IS EMBEDDED RATHER THAN RETYPED so the thing the browser runs is
// the thing `node --test` tests. If you find yourself editing the copy inside
// the generated HTML, stop: the change belongs in src/lockoutCore.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const CORE = path.join(ROOT, 'src', 'lockoutCore.js');
const TEMPLATE = path.join(ROOT, 'src', 'app.template.html');
const OUT_DIR = path.join(ROOT, 'public', 'app');
const MARKER = '/*__LOCKOUT_CORE__*/';

const core = fs.readFileSync(CORE, 'utf8');
const template = fs.readFileSync(TEMPLATE, 'utf8');

if (!template.includes(MARKER)) {
  throw new Error(`template is missing ${MARKER} — nothing would be embedded`);
}

// The core must be usable with nothing but a `module` object. Verified here
// rather than assumed, because a `require` sneaking in would fail only in the
// browser, at runtime, in front of a user.
const codeOnly = core.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const requires = codeOnly.match(/\brequire\s*\(/g) || [];
if (requires.length) {
  throw new Error(`src/lockoutCore.js has ${requires.length} require() call(s); it cannot be embedded`);
}
for (const banned of ['process.', 'fs.', '__dirname']) {
  if (codeOnly.includes(banned)) throw new Error(`core references ${banned}, which has no meaning in a browser`);
}

// A REPLACER FUNCTION, NOT A STRING. This is not style.
//
// `String.prototype.replace` gives the REPLACEMENT string special meaning to
// `$&`, `$\``, `$'` and `$1`. The core contains "`$`" inside a comment about a
// regex end anchor, and `$\`` means "insert everything before the match" — so a
// plain string replacement silently spliced the whole first half of the page
// back into the middle of itself. The page shipped with two <script> tags, one
// unterminated, and the browser threw `SyntaxError: Unexpected token '<'`
// before the engine ever loaded.
//
// A function replacement is passed through verbatim. Found by opening the built
// page in a browser, which is the only reason it was found at all.
const html = template.replace(MARKER, () => core);

// Guard against the page silently shipping without an engine.
if (!html.includes('module.exports')) {
  throw new Error('the embedded core does not export anything');
}
// And against the duplication above ever coming back: exactly one script block
// opens the engine, exactly one closes it.
const opens = (html.match(/<script>/g) || []).length;
const closes = (html.match(/<\/script>/g) || []).length;
if (opens !== 1 || closes !== 1) {
  throw new Error(`expected exactly one script block, found ${opens} open and ${closes} close`);
}
if (html.split('<!doctype html>').length !== 2) {
  throw new Error('the page was spliced into itself — check the replacement');
}

const hash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 8);
const name = `eqls-lockouts.${hash}.html`;

fs.mkdirSync(OUT_DIR, { recursive: true });

// Remove older builds so the directory never accumulates stale hashes that a
// reader could land on from an old link.
for (const f of fs.readdirSync(OUT_DIR)) {
  if (/^eqls-lockouts\.[0-9a-f]{8}\.html$/.test(f) && f !== name) {
    fs.unlinkSync(path.join(OUT_DIR, f));
  }
}

fs.writeFileSync(path.join(OUT_DIR, name), html, 'utf8');

// A stable pointer, so a human has something to open without knowing the hash.
// It is NOT what gets published — the hashed file is.
fs.writeFileSync(path.join(OUT_DIR, 'latest.txt'), name + '\n', 'utf8');

process.stdout.write(
  `wrote public/app/${name}\n` +
  `  engine  ${core.split('\n').length} lines embedded from src/lockoutCore.js\n` +
  `  page    ${html.length.toLocaleString()} bytes, self-contained\n`
);
