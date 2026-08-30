'use strict';

// Audits an HTML document for outbound references — and is MEANT TO BE POINTED
// AT SOMEBODY ELSE'S BUILD.
//
//   node analysis/audit-self-contained.js <path-to-html> [...more]
//   const { audit } = require('./analysis/audit-self-contained');
//
// ── WHY THIS EXISTS, AND IT IS A CORRECTION TO MY OWN TEST ──────────────────
//
// test/build.test.js asserts that our page makes zero network requests. That
// assertion is true, it is measured, and **it is about to become misleading
// through no change of its own.**
//
// The engine is being integrated into EQLS Auras. Shara's master fetches Google
// Fonts in three places. After integration the thing a user actually runs is her
// renderer with our engine inside it — and that page reaches out to Google on
// every launch, disclosing the user's IP, which is the exact behaviour this
// project published criticism of.
//
// Our test would keep passing. It tests `public/app/eqls-lockouts.<hash>.html`,
// a file that after integration nobody runs. **A green check would be sitting
// next to a broken guarantee, which is precisely how the Auras sentence went
// stale on us the first time: the app changed under a published claim and
// nothing was watching the app.**
//
// TWO GUARANTEES THAT WERE BEING SPOKEN AS ONE. Separating them is most of the
// fix, because only one of them survives integration:
//
//   "YOUR LOG NEVER LEAVES THIS MACHINE" — a claim about DATA EGRESS. This one
//   survives. The engine has no transmit path at all: no fetch, no XHR, no
//   WebSocket, no form, no beacon. Embed it anywhere and it still cannot send
//   your log somewhere, because it does not know how.
//
//   "THIS PAGE MAKES NO NETWORK REQUESTS" — a claim about the ARTIFACT. This one
//   does NOT survive. It is a property of one file, and integration replaces
//   that file with a different one.
//
// Conflating them lets the second quietly borrow the first's credibility.
//
// So the check ships as a FUNCTION rather than an assertion buried in our suite,
// because a guarantee that can only be tested against the artifact nobody runs
// is decoration. Session C can point this at the integrated renderer and get the
// same answer we get, on the thing that actually launches.

const fs = require('fs');
const path = require('path');

// Each rule names what it finds AND what a hit costs, because "http:// found" is
// not a finding — "this page discloses the reader's IP to a third party on every
// load" is.
const RULES = [
  { id: 'font-host', re: /fonts\.(?:googleapis|gstatic)\.com/gi,
    cost: 'discloses the reader IP address to Google on every launch' },
  // NAVIGATIONAL, NOT A FETCH — and the difference decides whether a reader is
  // disclosed. An <a href="https://github.com/..."> costs nothing until somebody
  // clicks it; a <link rel="canonical"> is never fetched by a browser at all.
  // Counting those as outbound made the tool report NO about pages that disclose
  // nobody — the same over-firing Session C found one rule down, and it would
  // have told Session A that self-hosting the fonts changed nothing.
  // REPORTED ALWAYS, COUNTED NEVER.
  { id: 'absolute-url', re: /\bhttps?:\/\/[^\s"'<>)]+/gi,
    cost: 'an absolute URL in the document — navigational unless something fetches it' },
  // ── THESE FOUR CLASSIFY THE URL, NOT THE TAG, AND THAT WAS A REAL DEFECT ──
  //
  // They used to flag any <link>, <img>, <script src> or url() whose value was
  // not a data: URI — INCLUDING RELATIVE ONES. Session C found it with an
  // 83-byte page whose entire content was `<link rel="stylesheet"
  // href="local.css">`, which came back self-contained: NO.
  //
  // **That made the tool useless in the direction that mattered.** Every real
  // application window has a local stylesheet, so it could never return YES for
  // one — and a NO that is guaranteed in advance carries no information.
  //
  // Worse, it invalidated my own verification of it. I "proved" the auditor
  // detects by pointing it at eqlsource.com's index.html and getting NO. Strip
  // every font host and every absolute URL out of that file and it STILL says
  // NO, from these rules firing on relative references. I had shown that the
  // detector fires, not that it fires on the thing I claimed. **Third time this
  // project has shipped a detector that had never been shown to detect** — after
  // the countdown regex and the killing-blow test.
  //
  // A reference is OUTBOUND if it names a scheme, or begins with `//` which
  // inherits the page's scheme and a foreign host. Everything else — `x.css`,
  // `/assets/x.css`, `#anchor`, `?q=1` — is same-origin and stays local.
  // NOT EVERY <link> FETCHES, and the last false positive on eqlsource.com was
  // exactly this: `<link rel="canonical" href="https://eqlsource.com/index">`,
  // which no browser ever requests. It is metadata for crawlers. Flagging it
  // left the site reporting NO after the one fix that was ordered, which would
  // have told Session A their work had achieved nothing.
  // So the rel is read, and only the values that actually cause a request count.
  // An ABSENT or unrecognised rel still counts — unknown means conservative.
  { id: 'link-href', re: /<link\b([^>]*)\bhref\s*=\s*["']?([^"'\s>]+)/gi, url: 2, rel: 1,
    cost: 'a <link> that fetches from another origin' },
  { id: 'img-src', re: /<img\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi, url: 1,
    cost: 'an <img> from another origin' },
  { id: 'script-src', re: /<script\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)/gi, url: 1,
    cost: 'an external script — the strongest form of this problem' },
  { id: 'css-import', re: /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)/gi, url: 1,
    cost: 'an @import pulls a stylesheet from another origin' },
  { id: 'css-url', re: /url\(\s*["']?([^"')]+)/gi, url: 1,
    cost: 'a CSS url() pointing at another origin' },
  // EGRESS — the separate guarantee. These are how a log LEAVES a machine.
  { id: 'fetch', re: /\bfetch\s*\(/gi, cost: 'EGRESS: can transmit' },
  { id: 'xhr', re: /\bXMLHttpRequest\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'websocket', re: /\bWebSocket\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'beacon', re: /\bnavigator\.sendBeacon\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'eventsource', re: /\bEventSource\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'form-action', re: /<form\b[^>]*\baction\s*=/gi, cost: 'EGRESS: a form can post' },
];

const EGRESS = new Set(['fetch', 'xhr', 'websocket', 'beacon', 'eventsource', 'form-action']);
// Present in the document, but the browser does not fetch it on load.
const NAVIGATIONAL = new Set(['absolute-url']);

// A hit inside a comment is not a request. Stripping comments before matching is
// the difference between a useful audit and one whose output everybody learns to
// ignore — and an audit nobody reads is worth less than no audit, because it
// still looks like coverage.
// Is this reference to ANOTHER ORIGIN?
//
//   https://x/y  http://x/y   -> yes, a named scheme
//   //fonts.gstatic.com/y     -> YES, and this is the one people miss: a
//                                protocol-relative URL inherits the page's
//                                scheme and goes to a foreign host anyway
//   data: blob: about:        -> no, self-contained by definition
//   /assets/x.css  x.css      -> no, same origin
//   #anchor  ?q=1  mailto:    -> no, not a subresource fetch at all
function isOutbound(raw) {
  const u = String(raw).trim();
  if (!u) return false;
  if (u.startsWith('//')) return true;                       // protocol-relative
  if (/^(?:data|blob|about|javascript|mailto|tel):/i.test(u)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return true;           // any other scheme
  return false;                                              // relative or root-relative
}

// Which <link rel> values make the browser go and get something on page load.
// `canonical`, `alternate`, `author`, `license`, `me`, `next`, `prev` do not —
// they are metadata. An unrecognised value is treated as fetching, because
// guessing "harmless" about a thing you do not recognise is how this class of
// check goes quiet.
const FETCHING_REL = new Set([
  'stylesheet', 'preload', 'preconnect', 'dns-prefetch', 'prefetch', 'prerender',
  'modulepreload', 'icon', 'shortcut icon', 'apple-touch-icon',
  'apple-touch-icon-precomposed', 'mask-icon', 'manifest',
]);
function fetchesOnLoad(rel) {
  const v = String(rel).trim().toLowerCase();
  if (!v) return true;
  if (FETCHING_REL.has(v)) return true;
  // Space-separated rel lists: "shortcut icon", "preload stylesheet".
  return v.split(/\s+/).some((t) => FETCHING_REL.has(t));
}

function stripComments(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

function audit(html, opts) {
  const label = (opts && opts.label) || '(unnamed document)';
  const body = stripComments(html);
  const findings = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(body)) !== null) {
      const hit = m[0];
      // A data: URI is self-contained by definition; it is the whole technique
      // this project uses for its fonts.
      if (/data:/i.test(hit)) continue;
      // For the URL-classifying rules, judge the captured value rather than the
      // tag it sat in. Same-origin references are not outbound.
      if (rule.url) {
        const raw = (m[rule.url] || '').trim();
        if (!isOutbound(raw)) continue;
      }
      // A <link> only matters if its rel is one the browser acts on.
      if (rule.rel) {
        const relAttr = /\brel\s*=\s*["']?([^"'>]+)/i.exec(m[rule.rel] || '');
        if (relAttr && !fetchesOnLoad(relAttr[1])) continue;
      }
      const at = body.slice(0, m.index).split('\n').length;
      findings.push({
        rule: rule.id,
        kind: EGRESS.has(rule.id) ? 'egress'
          : NAVIGATIONAL.has(rule.id) ? 'navigational' : 'fetch',
        line: at,
        text: hit.length > 120 ? hit.slice(0, 117) + '...' : hit,
        cost: rule.cost,
      });
      if (findings.length > 500) break;
    }
  }
  const fetches = findings.filter((f) => f.kind === 'fetch');
  const egress = findings.filter((f) => f.kind === 'egress');
  const navigational = findings.filter((f) => f.kind === 'navigational');
  return {
    label,
    bytes: html.length,
    ok: fetches.length === 0 && egress.length === 0,
    // REPORTED SEPARATELY, ALWAYS. The two guarantees are different claims and a
    // caller may legitimately hold one and not the other.
    selfContained: fetches.length === 0,
    noEgressPath: egress.length === 0,
    // Listed so a reader can see them; NEVER counted against selfContained.
    navigationalCount: navigational.length,
    findings,
    summary: (fetches.length === 0 && egress.length === 0)
      ? 'no outbound fetch and no transmit path' +
        (navigational.length ? ` (${navigational.length} navigational link(s), which fetch nothing)` : '')
      : `${fetches.length} outbound fetch(es), ${egress.length} transmit path(s)` +
        (navigational.length ? `, ${navigational.length} navigational` : ''),
  };
}

module.exports = { audit, RULES };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args.length) {
    process.stderr.write('usage: node analysis/audit-self-contained.js <file.html> [...]\n');
    process.exit(2);
  }
  let bad = 0;
  for (const f of args) {
    const r = audit(fs.readFileSync(f, 'utf8'), { label: path.basename(f) });
    process.stdout.write(`\n${r.label}  (${r.bytes.toLocaleString()} bytes)\n`);
    process.stdout.write(`  self-contained (no outbound reference) : ${r.selfContained ? 'YES' : 'NO'}\n`);
    process.stdout.write(`  no transmit path (log cannot leave)    : ${r.noEgressPath ? 'YES' : 'NO'}\n`);
    for (const x of r.findings.slice(0, 40)) {
      process.stdout.write(`    line ${String(x.line).padStart(6)}  ${x.rule.padEnd(13)} ${x.text}\n` +
                           `                       ^ ${x.cost}\n`);
    }
    if (r.findings.length > 40) process.stdout.write(`    ... and ${r.findings.length - 40} more\n`);
    if (!r.ok) bad++;
  }
  process.exit(bad ? 1 : 0);
}
