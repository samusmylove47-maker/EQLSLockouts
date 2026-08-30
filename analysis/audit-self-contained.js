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
  { id: 'absolute-url', re: /\bhttps?:\/\/[^\s"'<>)]+/gi,
    cost: 'an absolute URL; if it is fetched, it is a third party seeing this reader' },
  { id: 'link-tag', re: /<link\b[^>]*>/gi,
    cost: 'a <link> fetches unless its href is a data: URI' },
  { id: 'img-tag', re: /<img\b[^>]*>/gi,
    cost: 'an <img> fetches unless its src is a data: URI' },
  { id: 'script-src', re: /<script\b[^>]*\bsrc\s*=/gi,
    cost: 'an external script — the strongest form of this problem' },
  { id: 'css-import', re: /@import\b/gi,
    cost: 'an @import fetches a stylesheet' },
  { id: 'css-url', re: /url\(\s*(?!['"]?data:)['"]?(?!\s*\))[^)]*\)/gi,
    cost: 'a CSS url() that is not a data: URI' },
  // EGRESS — the separate guarantee. These are how a log LEAVES a machine.
  { id: 'fetch', re: /\bfetch\s*\(/gi, cost: 'EGRESS: can transmit' },
  { id: 'xhr', re: /\bXMLHttpRequest\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'websocket', re: /\bWebSocket\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'beacon', re: /\bnavigator\.sendBeacon\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'eventsource', re: /\bEventSource\b/gi, cost: 'EGRESS: can transmit' },
  { id: 'form-action', re: /<form\b[^>]*\baction\s*=/gi, cost: 'EGRESS: a form can post' },
];

const EGRESS = new Set(['fetch', 'xhr', 'websocket', 'beacon', 'eventsource', 'form-action']);

// A hit inside a comment is not a request. Stripping comments before matching is
// the difference between a useful audit and one whose output everybody learns to
// ignore — and an audit nobody reads is worth less than no audit, because it
// still looks like coverage.
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
      const at = body.slice(0, m.index).split('\n').length;
      findings.push({
        rule: rule.id,
        kind: EGRESS.has(rule.id) ? 'egress' : 'fetch',
        line: at,
        text: hit.length > 120 ? hit.slice(0, 117) + '...' : hit,
        cost: rule.cost,
      });
      if (findings.length > 500) break;
    }
  }
  const fetches = findings.filter((f) => f.kind === 'fetch');
  const egress = findings.filter((f) => f.kind === 'egress');
  return {
    label,
    bytes: html.length,
    ok: findings.length === 0,
    // REPORTED SEPARATELY, ALWAYS. The two guarantees are different claims and a
    // caller may legitimately hold one and not the other.
    selfContained: fetches.length === 0,
    noEgressPath: egress.length === 0,
    findings,
    summary: findings.length === 0
      ? 'no outbound reference and no transmit path'
      : `${fetches.length} outbound reference(s), ${egress.length} transmit path(s)`,
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
