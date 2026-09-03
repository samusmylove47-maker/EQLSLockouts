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
const FONT_MARKER = '/*__LOCKOUT_FONTS__*/';
const FONTS = path.join(ROOT, 'assets', 'fonts', 'fonts.json');

const core = fs.readFileSync(CORE, 'utf8');
const template = fs.readFileSync(TEMPLATE, 'utf8');

if (!template.includes(MARKER)) {
  throw new Error(`template is missing ${MARKER} — nothing would be embedded`);
}

// ── the typefaces, inlined ─────────────────────────────────────────────────
//
// The page uses the site's four faces and fetches NONE of them at runtime.
// `node analysis/fetch-fonts.js` downloads and subsets them once, into
// assets/fonts/fonts.json; this splices them in as data: URIs.
//
// THE REASON IS A PUBLISHED CLAIM WE HAVE TO KEEP TRUE. eqlsource.com loads
// these four from fonts.googleapis.com, and the site itself criticises another
// app for doing that — "It fetches its typeface from Google each time it
// launches, which discloses your IP address to Google." This page's subtitle is
// "Your log never leaves this machine". Linking Google here would make the page
// contradict both the sentence above it and the sentence we published about
// somebody else.
//
// test/build.test.js fails the build if the output contains either font host,
// or if any @font-face src is not a data: URI.
function fontFaces() {
  if (!fs.existsSync(FONTS)) {
    // Not fatal. The page must still build on a machine that has never run the
    // fetcher — it falls back to the system stacks declared beside each family
    // in the template. A silent 0-byte build is the wrong failure; a loud line
    // on stdout is the right one.
    process.stdout.write('  fonts   NONE — run `node analysis/fetch-fonts.js` (page will use system stacks)\n');
    return { css: '', bytes: 0, count: 0 };
  }
  const faces = JSON.parse(fs.readFileSync(FONTS, 'utf8'));
  const css = faces.map((f) => {
    // A supplementary face carries a unicode-range so the browser reaches for
    // it only for the codepoints it actually holds; a full latin face carries
    // none, so it serves as the general fallback for its family and weight.
    const range = f.unicodeRange && /^U\+[0-9A-Fa-f]/.test(f.unicodeRange) && f.subset.startsWith('text=')
      ? `\n    unicode-range: ${f.unicodeRange};` : '';
    return `  @font-face {\n` +
           `    font-family: '${f.family}';\n` +
           `    font-style: ${f.style};\n` +
           `    font-weight: ${f.weight};\n` +
           `    font-display: block;\n` +
           `    src: url(data:font/woff2;base64,${f.base64}) format('woff2');${range}\n` +
           `  }`;
  }).join('\n');
  return { css, bytes: css.length, count: faces.length };
}
const fonts = fontFaces();

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
const html = template
  .replace(FONT_MARKER, () => fonts.css)
  .replace(MARKER, () => core);

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
  (fonts.count
    ? `  fonts   ${fonts.count} faces, ${fonts.bytes.toLocaleString()} bytes inlined as data: URIs\n`
    : '') +
  // Buffer.byteLength, NOT html.length. `html.length` is UTF-16 code units and
  // this file is written UTF-8, so the line said "310,060 bytes" for a 312,818
  // byte file — 1,384 non-ASCII characters (em dashes, curly quotes) at 3 bytes
  // each and 1 unit each, an exact 2,758 short. It read as a size and was not
  // one. Found 3 Sep 2026 by comparing this line against `wc -c` on its output.
  `  page    ${Buffer.byteLength(html, 'utf8').toLocaleString()} bytes, self-contained\n`
);
