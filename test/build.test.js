'use strict';

// The browser surface is generated, so the build is part of the deliverable.
//
//   node --test test/build.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

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

// ── THE SCOPE OF THE NEXT THREE TESTS, STATED BECAUSE IT IS ABOUT TO NARROW ──
//
// They assert that ONE FILE — public/app/eqls-lockouts.<hash>.html — reaches
// nowhere. That is true and measured. **It is also about to become misleading
// through no change of its own.**
//
// The engine is being integrated into EQLS Auras, whose master fetches Google
// Fonts in three places. After integration the thing a user runs is Shara's
// renderer with our engine inside it, and that page reaches Google on every
// launch. These tests would keep passing, because they test a file that after
// integration nobody opens. **A green check sitting next to a broken guarantee
// is exactly how the Auras sentence went stale on us the first time.**
//
// So: two guarantees, spoken separately from here on, because only one survives
// being embedded in somebody else's page.
//
//   "YOUR LOG NEVER LEAVES THIS MACHINE" — about DATA EGRESS. Survives. The
//   engine has no transmit path at all; embed it anywhere and it still cannot
//   send your log somewhere, because it does not know how.
//
//   "THIS PAGE MAKES NO NETWORK REQUESTS" — about THE ARTIFACT. Does not
//   survive. It is a property of one file, and integration replaces that file.
//
// The check is therefore also shipped as a function — analysis/audit-self-
// contained.js — so Session C can point it at the INTEGRATED renderer and get
// the same answer on the thing that actually launches. A guarantee testable only
// against the artifact nobody runs is decoration.
test('BUILD: THIS BUNDLE is self-contained — scope is one file, see above', () => {
  const { html } = build();
  // A strict page: the log never leaves the machine, and the page works with no
  // connection at all. Anything reaching outward breaks both promises.
  for (const banned of ['http://', 'https://', '<link ', '<img ', '@import', 'fetch(', 'XMLHttpRequest']) {
    assert.ok(!html.includes(banned), `the page must not contain ${banned}`);
  }

  // THE FONT HOSTS, BY NAME, on the Director's order of 27 Aug 2026 — and the
  // reason is a real failure this project has already had.
  //
  // eqlsource.com loads Cinzel, Saira Condensed, IBM Plex Mono and Public Sans
  // from fonts.googleapis.com. We have PUBLISHED criticism of another app for
  // exactly that — "It fetches its typeface from Google each time it launches,
  // which discloses your IP address to Google" — so taking the shortcut we told
  // its author not to take is not available to us.
  //
  // `https://` above already covers these. Naming them anyway is deliberate:
  // the generic ban says WHAT is forbidden and this says WHY, so the next person
  // reaching for a <link> to match the site's type reads the reason in the
  // failure message instead of deleting the assertion that annoyed them.
  //
  // **That is how the Auras sentence went stale on us**: the app changed under a
  // published claim and nothing was watching. This is the watcher.
  for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com']) {
    assert.ok(!html.includes(host),
      `the page must not reference ${host} — fonts are subsetted and inlined at build time, ` +
      `because "Your log never leaves this machine" has to be true of the page itself`);
  }
});

test('BUILD: every font is inlined as a data: URI, or there are none', () => {
  // The other half of the same promise. Banning the host is not enough: a
  // @font-face with a bare relative src would also break the single-file
  // guarantee, silently, and only for someone who opened the page from
  // somewhere other than the directory it was built in.
  const { html } = build();
  const faces = html.match(/@font-face\s*\{[^}]*\}/g) || [];
  for (const face of faces) {
    const src = /src\s*:\s*([^;]+);/.exec(face);
    assert.ok(src, `a @font-face must declare a src:\n${face}`);
    assert.match(src[1], /url\(\s*["']?data:/,
      `every @font-face src must be a data: URI — this one is not:\n${face}`);
  }
  // And if faces exist at all, they must actually be woff2 payloads rather than
  // an empty or truncated blob that renders as a fallback nobody notices.
  for (const face of faces) {
    const b64 = /data:[^;,]*;base64,([A-Za-z0-9+/=]+)/.exec(face);
    if (!b64) continue;
    const buf = Buffer.from(b64[1], 'base64');
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'wOF2',
      'an inlined font must begin with the woff2 signature "wOF2"');
    assert.ok(buf.length > 1000, 'a font under 1KB is a truncated payload, not a face');
  }
});

test('BUILD: the filename is content-hashed', () => {
  const { name, html } = build();
  assert.match(name, /^eqls-lockouts\.[0-9a-f]{8}\.html$/);
  // Rebuilding unchanged input must produce the same name; a changing hash
  // would bust caches on every build and stop meaning anything.
  const again = build();
  assert.equal(again.name, name);

  // ── AND THE HALF THAT WAS MISSING UNTIL 31 Aug ────────────────────────
  //
  // The two assertions above are satisfied by a CONSTANT. Replacing the hash
  // computation with the literal 'deadbeef' passed both — it is eight hex
  // characters and it is perfectly stable — and all 125 tests stayed green.
  // Found by analysis/mutation-check.js.
  //
  // The test asserted that the same input gives the same name and never that a
  // DIFFERENT input gives a different one, which is the only thing "content-
  // hashed" means. Recomputing the digest here ties the name to the bytes.
  //
  // It matters beyond cache-busting: the hash is how a pending publish is
  // detected at all. Frozen, every build would carry one filename and the
  // stale-deploy check would go quiet while looking healthy.
  const digest = crypto.createHash('sha256').update(html).digest('hex').slice(0, 8);
  assert.equal(name, `eqls-lockouts.${digest}.html`,
    'the filename must be DERIVED from the page bytes, not merely stable');
});

test('BUILD: both grounds exist, and no colour is defined ONLY in a media block', () => {
  // The site is theme-aware — 4 prefers-color-scheme and 10 data-theme in the
  // authoritative stylesheet, and 700 of 717 published pages ship a switcher.
  // I first reported the opposite, from a working tree 43 commits stale.
  const { html } = build();
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

  assert.match(css, /@media \(prefers-color-scheme: light\)/, 'a daylight ground must exist');
  assert.match(css, /:root:not\(\[data-theme="dark"\]\)/, 'and be guarded so an explicit dark choice wins');
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /:root\[data-theme="dark"\]/, 'both toggle directions, or one of them cannot be undone');
  assert.match(css, /body\s*\{[^}]*background-color:\s*var\(--surface-0\)/,
    'body needs an explicit token background or it borrows the host ground');

  // EVERY token defined in a media or [data-theme] block must ALSO exist on the
  // bare :root. A colour that lives only inside a conditional block is undefined
  // for whoever the condition does not match, and an undefined custom property
  // fails silently — which is how this project once shipped `border-top: 1px
  // solid var(--line)` computing to a width of zero on its busiest page.
  const bare = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: light)'));
  const declared = new Set((bare.match(/--[a-z0-9-]+(?=\s*:)/g) || []));
  const scoped = css.slice(css.indexOf('@media (prefers-color-scheme: light)'));
  const missing = [...new Set(scoped.match(/--[a-z0-9-]+(?=\s*:)/g) || [])]
    .filter((t) => !declared.has(t));
  assert.deepEqual(missing, [], `these are defined only under a condition: ${missing.join(', ')}`);
});

test('BUILD: no custom property is delivered through a `background` SHORTHAND', () => {
  // A REAL BUG, found in a browser and not by any of this. Chromium does not
  // re-resolve `background: var(--x)` when --x changes on :root, so flipping the
  // OS theme with the page open left every cell painted in the other ground's
  // colour while its text switched. `background-color: var(--x)` re-resolves.
  //
  // It survives a reload, so it only ever bit a viewer whose theme changed while
  // they were looking — which is exactly the viewer a scheduled dark mode makes.
  const { html } = build();
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const bad = css.match(/[;{]\s*background:\s*var\(/g) || [];
  assert.deepEqual(bad, [], 'use background-color, not the background shorthand, with a custom property');
});

test('BUILD: the licence notice ships with the fonts it describes', () => {
  // OFL 1.1 clause 1 requires the notice to travel with the font. The faces are
  // embedded in the page, so the page has to point at the notice, and the notice
  // has to exist.
  const { html } = build();
  const faces = html.match(/@font-face/g) || [];
  if (!faces.length) return;                       // system-stack build, nothing to notice
  assert.match(html, /SIL Open Font License/, 'the page must carry the licence line');
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'fonts', 'LICENSES.md')),
    'assets/fonts/LICENSES.md must exist');
  const lic = fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'LICENSES.md'), 'utf8');

  // The two RESERVED FONT NAMES must not appear as a CSS family in the page.
  // IBM Plex Mono reserves "Plex" and Saira Condensed reserves "Saira"; OFL
  // clause 3 forbids a Modified Version — which a subset is — from using them.
  for (const reserved of ['IBM Plex Mono', 'Saira Condensed']) {
    assert.ok(!new RegExp(`font-family:\s*'${reserved}'`).test(html),
      `${reserved} carries a reserved font name and must be renamed in CSS`);
  }
  assert.match(lic, /Reserved Font Name/i, 'the notice must explain the rename');
  assert.match(lic, /name.{0,20}table/i, 'and must state the gap: the rename is CSS-only');
});

test('BUILD: no wall-clock time is ever rendered on the page surface', () => {
  // THE OWNER'S CONSTRAINT, and it is narrower than "no countdown".
  //
  // The page had grown "if before 22:12" in the unsure cells and
  // "at or before 2026-08-25 20:29:00" in the list under the count. Both were
  // true, and both were answering a question nobody asked: the tool exists so a
  // player can see what they have and have not killed. A printed time invites
  // arithmetic, and at a glance it reads as a countdown — which this page has
  // never had and must never grow.
  //
  // The instant is NOT discarded. The engine still computes it, and the cell's
  // `title` still carries it for whoever hovers. This guards the SURFACE.
  const { html } = build();
  const body = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
  const clocks = body.match(/\b\d{1,2}:\d{2}(:\d{2})?\b/g) || [];
  assert.deepEqual(clocks, [], `static markup renders a clock: ${clocks.join(', ')}`);

  // And the renderer must not build one either. These are the two shapes it
  // grew before: slicing a civil stamp for its time half, and printing an
  // engine string that ends in one.
  const script = html.slice(html.indexOf('</style>'));
  for (const shape of ['decidedBy.doneIf', 'decidedBy.openIf', '.pivot.slice(11']) {
    assert.ok(!script.includes(shape),
      `the view must not surface ${shape} — it carries a wall-clock time`);
  }
  // `shortDay` is the only formatter allowed to touch a civil stamp for display.
  assert.match(script, /function shortDay/, 'the date formatter must exist');
  assert.match(script, /MON\[Number\(m\[2\]\) - 1\]/, 'and produce a day and month, not a time');
});

test('AUDIT: the portable checker agrees with this suite, and catches a page that does fetch', () => {
  // The suite above and the shipped auditor must not drift apart, or Session C
  // gets a different answer from ours on the same bytes.
  const { audit } = require('../analysis/audit-self-contained');
  const { html } = build();
  const ours = audit(html, { label: 'our bundle' });
  assert.equal(ours.selfContained, true, ours.summary);
  assert.equal(ours.noEgressPath, true, 'the engine must have no transmit path');

  // AND IT MUST ACTUALLY CATCH SOMETHING. An auditor that has only ever returned
  // "clean" has not been shown to detect anything — the same lesson as the
  // countdown detector, which was silently broken and passing.
  const fetching = `<!doctype html><html><head>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Cinzel" rel="stylesheet">
    </head><body><img src="https://example.com/x.png"></body></html>`;
  const bad = audit(fetching, { label: 'a page that fetches' });
  assert.equal(bad.selfContained, false, 'the auditor must fail a page that fetches Google Fonts');
  assert.ok(bad.findings.some((f) => f.rule === 'font-host'), 'and name the font host specifically');
  assert.ok(bad.findings.some((f) => f.cost.includes('IP address')),
    'and say what a hit COSTS — "http:// found" is not a finding');

  // The two guarantees are reported separately, because a caller may hold one
  // and not the other — which is exactly the position Auras is in.
  const egressOnly = audit('<script>fetch("/x")</script>', { label: 'egress only' });
  assert.equal(egressOnly.selfContained, true, 'a relative fetch is not an outbound reference');
  assert.equal(egressOnly.noEgressPath, false, 'but it IS a transmit path');
});

test('AUDIT: the verdict must TURN ON the thing being measured', () => {
  // SESSION C FOUND THIS AND IT INVALIDATED MY OWN VERIFICATION OF THE TOOL.
  //
  // The link/img/script rules flagged any href or src that was not a data: URI,
  // INCLUDING RELATIVE ONES. C fed it an 83-byte page whose whole content was
  // `<link rel="stylesheet" href="local.css">` and got self-contained: NO. Every
  // real application window has a local stylesheet, so it could never return YES
  // for one — and a NO that is guaranteed in advance carries no information.
  //
  // Worse: I had "verified" the auditor by pointing it at eqlsource.com's
  // index.html and getting NO. Strip every font host out of that file and it
  // STILL said NO. I had shown the detector fires, not that it fires on the
  // thing I claimed. THIRD TIME this project has shipped a detector that was
  // never shown to detect — after the countdown regex and the killing-blow test.
  //
  // So the test is no longer "does it say NO". It is "does the answer CHANGE
  // when the measured thing changes". That is the only version that can fail.
  const { audit } = require('../analysis/audit-self-contained');

  const page = [
    '<!doctype html><html><head>',
    '<link rel="canonical" href="https://eqlsource.com/index">',   // never fetched
    '<link rel="stylesheet" href="/assets/site.css">',             // same origin
    '<link rel="preconnect" href="https://fonts.googleapis.com">', // THE THING
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">',
    '</head><body>',
    '<a href="https://github.com/example">source</a>',             // navigational
    '<p>Nothing transmitted.</p>',
    '</body></html>',
  ].join('\n');

  const before = audit(page, { label: 'fetching' });
  const after = audit(page.replace(/https:\/\/fonts\.googleapis\.com/g, '/assets/fonts'),
    { label: 'self-hosted' });

  assert.equal(before.selfContained, false, 'a page fetching Google Fonts is not self-contained');
  assert.equal(after.selfContained, true,
    'AND SELF-HOSTING THEM MUST FLIP IT — otherwise the tool cannot tell anyone whether the fix worked');
  assert.ok(before.findings.some((f) => f.rule === 'font-host'), 'and it names the host');

  // The four ways it must NOT over-fire, each of which fetches nothing.
  for (const [what, html] of [
    ['a relative stylesheet', '<link rel="stylesheet" href="local.css">'],
    ['a root-relative one', '<link rel="stylesheet" href="/assets/site.css">'],
    ['rel=canonical to another origin', '<link rel="canonical" href="https://example.com/x">'],
    ['a link the reader may click', '<a href="https://github.com/x">source</a>'],
  ]) {
    assert.equal(audit(html, { label: what }).selfContained, true,
      `${what} fetches nothing and must not count against self-containment`);
  }

  // And the two it must catch, including the one people miss.
  for (const [what, html] of [
    ['a protocol-relative font host', '<link rel="stylesheet" href="//fonts.gstatic.com/x">'],
    ['an off-origin stylesheet', '<link rel="stylesheet" href="https://evil.example/x.css">'],
  ]) {
    assert.equal(audit(html, { label: what }).selfContained, false, `${what} must be caught`);
  }

  // Navigational hits are still REPORTED — suppressed from the verdict, not hidden.
  assert.ok(after.navigationalCount > 0, 'a reader must still be able to see them');
});

test('SELF-CONTAINMENT IS PROVEN BY A MATCHED PAIR, not by the bundle being clean', () => {
  // SESSION C'S POINT, and it applies to every assertion above this one.
  //
  // "The bundle contains no banned string" is a POSITIVE WITH NO PAIR. Measured:
  // it returns PASSES for the real bundle with the real ban list, PASSES for the
  // real bundle with an EMPTY ban list, and PASSES for an EMPTY document with the
  // real ban list. Three different worlds, one verdict — so a green result is
  // consistent with a clean bundle AND with a check that cannot fire.
  //
  // That is exactly what the auditor's relative-stylesheet defect turned out to
  // be, and what C's backspace guard was, and what my one-regex-three-jobs was.
  // None had a symptom except a test that failed to fail.
  //
  // THE RULE, in the Director's words: a detector is shown to work by a MATCHED
  // PAIR differing only in the thing being detected, never by a positive.
  //
  // So: the real built bundle, and the same bytes with ONE deliberate font
  // reference spliced in. Every check must separate them.
  const { html } = build();
  const poisoned = html.replace('<style>',
    '<style>\n@import url("https://fonts.googleapis.com/css2?family=Cinzel");');
  assert.notEqual(poisoned, html, 'the injection must actually have landed');

  const bannedStrings = ['http://', 'https://', '<link ', '<img ', '@import', 'fetch(', 'XMLHttpRequest'];
  const cleanOf = (doc) => bannedStrings.every((b) => !doc.includes(b));
  assert.equal(cleanOf(html), true, 'the shipped bundle is clean');
  assert.equal(cleanOf(poisoned), false,
    'AND THE CHECK MUST GO RED ON THE POISONED TWIN — otherwise green means nothing');

  // The named font hosts, same pair.
  const hostsOf = (doc) => ['fonts.googleapis.com', 'fonts.gstatic.com'].every((h) => !doc.includes(h));
  assert.equal(hostsOf(html), true);
  assert.equal(hostsOf(poisoned), false, 'the host ban must separate the pair too');

  // And the portable auditor, on the same two documents.
  const { audit } = require('../analysis/audit-self-contained');
  assert.equal(audit(html, { label: 'shipped' }).selfContained, true);
  assert.equal(audit(poisoned, { label: 'poisoned' }).selfContained, false,
    'the auditor must separate the pair on the REAL bundle, not only on a synthetic page');

  // The two ways the check could be dead, which a positive cannot tell apart.
  assert.equal(bannedStrings.length > 0, true, 'an empty ban list passes everything');
  assert.ok(html.length > 10000, 'an empty document passes everything too');
});

test('BUILD: the COMMITTED latest.txt names what the CURRENT SOURCE produces', () => {
  // THE DRIFT THIS CATCHES, and it had run for seven engine commits.
  //
  // `latest.txt` and the artifact are committed; the source that produces them
  // is committed separately; NOTHING MADE THEM MOVE TOGETHER. On 1 Sep the
  // pointer had named `eqls-lockouts.14106e64.html` since 30 August while the
  // source had moved through seven commits to `src/lockoutCore.js` — the token
  // cap, the false-`no` fix, the Voidling control fix, the dedupe-horizon fix
  // and the over-tolerance message among them.
  //
  // The build is deterministic, so the mismatch was ALWAYS detectable — by
  // someone who ran the build and compared. Nobody did, because nothing asked.
  //
  // Compare against the COMMITTED pointer, not the working-tree one: every
  // other test in this file builds first, which overwrites `latest.txt` and
  // makes a working-tree comparison trivially true. Reading it from git is what
  // makes this a check rather than a tautology.
  const committed = execFileSync('git', ['show', 'HEAD:public/app/latest.txt'],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  const { name } = build();

  assert.equal(committed, name,
    `the committed pointer names ${committed} but this source builds ` +
    `${name}. Rebuild and commit public/app/ together, or the repo is ` +
    `serving a pointer to something it no longer produces.`);
});

test('BUILD: the artifact HASHES TO ITS OWN NAME, on disk', () => {
  // SESSION A'S ASSERTION, and it encodes a convention now established rather
  // than assumed. `build-app.js` computes `sha256(html).slice(0,8)` and then
  // writes THAT SAME STRING — so the filename is the file's own hash, and any
  // layer that rewrites a byte makes the name false.
  //
  // A stopped its copier because the artifact in the repo did not hash to its
  // name. A was right, and the cause was not the build. Measured 1 Sep:
  //
  //   as built         309,040 B   3,849 CRLF + 50 BARE LF   -> fd053e47
  //   stored as blob   305,191 B   all LF                    -> 15f045ad
  //   fresh checkout   309,090 B   3,899 CRLF, 0 bare LF     -> 41c1a2cb
  //
  // Git normalised on the way in and re-expanded on the way out, folding 50
  // newlines that were never CRLF. `.gitattributes` now marks the artifact
  // `-text` so the bytes survive; this asserts the property that mark protects.
  //
  // The existing hash test proves the name is DERIVED from the content. This
  // proves the file on disk still IS that content — the sensitivity direction,
  // and it fires before `latest.txt` is ever written.
  const { name } = build();
  const bytes = fs.readFileSync(path.join(OUT_DIR, name));
  const actual = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const claimed = /^eqls-lockouts\.([0-9a-f]{8})\.html$/.exec(name)[1];

  assert.equal(actual, claimed,
    `the artifact is named ${claimed} but its bytes hash to ${actual}. ` +
    'Something rewrote the file after the build computed its name — check ' +
    '.gitattributes for line-ending normalisation on public/app/.');
});

test('BUILD: .gitattributes COVERS the artifact directory, at any depth', () => {
  // THE GAP THIS CLOSES, and it was real rather than hypothetical.
  //
  // `public/app/*.html -text` was added after git normalisation broke the
  // artifact's content-hash name. It covers ONE level. Measured before the
  // fix, with `git check-attr`, which is the only thing that actually decides
  // what a glob covers:
  //
  //   public/app/eqls-lockouts.<hash>.html   text: unset         covered
  //   public/app/sub/x.html                  text: unspecified   NOT covered
  //   public/app/deep/nested/y.html          text: unspecified   NOT covered
  //
  // A build output written one directory deeper would have been normalised
  // again and its name would have been false again — and the on-disk hash
  // check would only have noticed AFTER a build, on a file already committed.
  //
  // Session A raised the coverage question; the measurement is what turned it
  // from a tidiness note into a live gap.
  const attr = (p) => execFileSync('git', ['check-attr', 'text', '--', p],
    { cwd: ROOT, encoding: 'utf8' }).trim().split(': ').pop();

  for (const p of [
    'public/app/eqls-lockouts.deadbeef.html',
    'public/app/sub/x.html',
    'public/app/deep/nested/y.html',
  ]) {
    assert.equal(attr(p), 'unset',
      `${p} must be marked -text — a build output normalised by git cannot ` +
      'hash to its own name');
  }

  // THE NEGATIVE CONTROL. Without it, `-text` on everything would pass this
  // test while telling us nothing about whether the pattern discriminates.
  assert.equal(attr('public/other.html'), 'unspecified',
    'the rule must be scoped to the artifact directory, not the whole repo');
});

test('PAGE: the two provenance rows that disclose our LIMITS are actually shipped', () => {
  // BOTH OF THESE WERE BLIND UNTIL NOW, and they were the two the Director
  // ruled load-bearing. The page could stop saying either one and the whole
  // suite stayed green, because nothing asserted text that only a reader sees.
  //
  // They were written to SATISFY A RULING rather than to catch anything, which
  // is exactly the class that ships undefended: compliance produces text,
  // intent produces assertions.
  //
  // A page that can silently stop disclosing its own limits is worse than one
  // that never disclosed them — the disclosure is what earns a reader's trust
  // in everything else on the page.
  const { html } = build();

  // Asserted as SEPARATE FRAGMENTS, never as one long phrase. The page embeds
  // its own JavaScript source, so these strings appear with their `" +` line
  // breaks intact — a regex spanning a concatenation matches nothing and looks
  // like a missing row. That cost me an INERT mutation before it cost a test.
  assert.match(html, /every cell here is a GROUP instance/,
    'the page must say which instance shape every cell describes');
  assert.match(html, /instances lock separately \(owner, stated\)/,
    'and that raid-shape instances lock separately — STATED, never measured');

  assert.match(html, /corpus spanning a weekly-reset/,
    'the page must disclose that its rules span a regime change');
  assert.match(html, /change announced 18 Aug 2026/,
    'and name the date, so a reader can place it against their own log');
  assert.match(html, /the reset hour was never measured in either/,
    'and state the limit of the comparison, not just its result');

  // THE NEGATIVE CONTROL. Without it these five assertions would pass against
  // any page large enough to contain anything, and I would have replaced a
  // blind spot with a test that cannot fail — which is the shape this whole
  // sweep exists to find.
  assert.doesNotMatch(html, /every cell here is a SOLO instance/,
    'the checker must discriminate: a claim we never made must not match');
});
