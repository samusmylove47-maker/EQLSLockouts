'use strict';

// HOW MANY OF MY SOURCE-TEXT GUARDS CAN BE SATISFIED BY TEXT WRITTEN FOR
// SOMETHING ELSE?
//
//   node analysis/text-guard-survey.js
//
// Several tests assert that a SENTENCE exists in a file — that an assumption is
// stated, a hazard is named, a constant is confined. They are real guards: the
// sentence is often the only thing telling the next reader that a cell is an
// assumption rather than a measurement.
//
// They are also whole-file greps. On 3 Sep 2026 I discovered I had weakened one
// WITHOUT TOUCHING IT: the test greps `src/lockoutCore.js` for /SHARE a lock/i,
// and I added a second occurrence of that phrase in an unrelated comment the
// same afternoon. Deleting the sentence the test was written for now leaves it
// green. Nothing flagged it; nothing could have.
//
// THE MEASURE, and it is decidable rather than a judgement:
//
//   For each source-text assertion, count how many times its pattern matches
//   the file it is asserted against. If the count is 1, the guard PINS its
//   subject: remove that text and the test fails. If the count is >1, the guard
//   CANNOT DETECT the loss of any single occurrence — every one of them can be
//   deleted while the assertion stays green.
//
// This reports the SIZE OF THE CLASS. It fixes nothing. Repairing one member of
// a class whose size is unknown is the wrong order.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TESTS = ['build', 'grid', 'lockout', 'actionability']
  .map((n) => path.join(ROOT, 'test', `${n}.test.js`));

// Build once so the page-content guards are measured against the real artifact.
execFileSync(process.execPath, [path.join(ROOT, 'build-app.js')], { cwd: ROOT, stdio: 'ignore' });
const OUT = path.join(ROOT, 'public', 'app');
const pageName = fs.readFileSync(path.join(OUT, 'latest.txt'), 'utf8').trim();
const page = fs.readFileSync(path.join(OUT, pageName), 'utf8');

// The haystacks these assertions actually read. Anything else is a runtime
// value, not file text, and is out of scope for this survey.
const HAYSTACKS = {
  src: { label: 'src/lockoutCore.js', text: fs.readFileSync(path.join(ROOT, 'src', 'lockoutCore.js'), 'utf8') },
  html: { label: 'the built page', text: page },
  script: { label: 'the built page (script section)', text: page.slice(page.indexOf('</style>')) },
  css: { label: 'the built page (style section)', text: page.slice(page.indexOf('<style>'), page.indexOf('</style>')) },
  body: { label: 'the built page (main section)', text: page.slice(page.indexOf('<main>'), page.indexOf('</main>')) },
  lic: { label: 'assets/fonts/LICENSES.md', text: fs.readFileSync(path.join(ROOT, 'assets', 'fonts', 'LICENSES.md'), 'utf8') },
};

// assert.match(<haystack>, /pattern/flags   and the doesNotMatch form.
const ASSERT_RE = /assert\.(match|doesNotMatch)\(\s*(src|html|script|css|body|lic)\s*,\s*\/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/g;

const rows = [];
for (const file of TESTS) {
  const body = fs.readFileSync(file, 'utf8');
  const lines = body.split('\n');
  for (const m of body.matchAll(ASSERT_RE)) {
    const lineNo = body.slice(0, m.index).split('\n').length;
    // The enclosing test name, for a report someone can act on.
    let testName = '(unknown)';
    for (let i = lineNo - 1; i >= 0; i--) {
      const t = /^test\('([^']+)'/.exec(lines[i] || '');
      if (t) { testName = t[1]; break; }
    }
    rows.push({
      file: path.basename(file), lineNo, testName,
      kind: m[1], hay: m[2], pattern: m[3], flags: m[4],
    });
  }
}

let pins = 0, weak = 0, zero = 0, negative = 0;
const weakRows = [];

console.log(`${rows.length} source-text assertion(s) across ${TESTS.length} test files\n`);
for (const r of rows) {
  const hay = HAYSTACKS[r.hay];
  let count = 0;
  let note = '';
  try {
    const flags = r.flags.includes('g') ? r.flags : r.flags + 'g';
    count = (hay.text.match(new RegExp(r.pattern, flags)) || []).length;
  } catch (e) { note = '  [pattern could not be recompiled: ' + e.message + ']'; }

  // A doesNotMatch guard is a different animal: it asserts ABSENCE, and absence
  // cannot be weakened by an extra occurrence — it is broken by any at all.
  let verdict;
  if (r.kind === 'doesNotMatch') { verdict = 'NEGATIVE'; negative++; }
  else if (count === 0) { verdict = '*** MATCHES NOTHING ***'; zero++; }
  else if (count === 1) { verdict = 'PINS'; pins++; }
  else { verdict = `WEAK (${count} occurrences)`; weak++; weakRows.push({ ...r, count }); }

  console.log(`  ${verdict}`);
  console.log(`    /${r.pattern}/${r.flags}  in ${hay.label}`);
  console.log(`    ${r.file}:${r.lineNo}  ${r.testName}${note}`);
}

console.log('\n=== THE SIZE OF THE CLASS ===');
console.log(`  assertions surveyed                  : ${rows.length}`);
console.log(`  PINS  (1 occurrence, guard is real)  : ${pins}`);
console.log(`  WEAK  (>1, cannot detect a deletion) : ${weak}`);
console.log(`  MATCHES NOTHING (already broken)     : ${zero}`);
console.log(`  NEGATIVE (asserts absence, N/A)      : ${negative}`);

if (weakRows.length) {
  console.log('\n  WEAK, in full — each of these can lose the text it was written for:');
  for (const r of weakRows) {
    console.log(`    ${r.count}x  /${r.pattern}/  — ${r.file}:${r.lineNo}`);
    console.log(`          ${r.testName}`);
  }
}

// ── WHAT THIS SURVEY CANNOT READ, MEASURED RATHER THAN CLAIMED ────────────
//
// The extractor only sees `assert.match(<haystack>, /literal/)`. A survey that
// does not state its own blind spot is the fault it was written to find: an
// instrument sharing the defect of the thing it audits will always report
// agreement. So the OTHER forms are counted here and classified, and if any
// POSITIVE assertion is unreadable the headline is a lower bound, not a total.
const OTHER_FORMS = [
  { label: '.test(<content>)', re: /(!?)\s*(?:new RegExp\([^)]*\)|\/(?:[^/\\\n]|\\.)+\/[gimsuy]*)\.test\((?:src|html|script|css|body|lic)\)/g },
  { label: '.includes(<literal>)', re: /(!?)(?:src|html|script|css|body|lic)\.includes\(/g },
];
let unreadablePositive = 0;
console.log('\n=== WHAT THIS SURVEY CANNOT READ ===');
for (const form of OTHER_FORMS) {
  let pos = 0, neg = 0;
  for (const file of TESTS) {
    const body = fs.readFileSync(file, 'utf8');
    for (const m of body.matchAll(form.re)) (m[1] === '!' ? neg++ : pos++);
  }
  unreadablePositive += pos;
  console.log(`  ${form.label}: ${pos + neg} found — ${neg} NEGATIVE (assert absence, immune to this weakness), ${pos} positive`);
}
console.log(unreadablePositive === 0
  ? '  Every unreadable assertion asserts ABSENCE, so the counts above are the\n' +
    '  COMPLETE population of positive source-text guards, not a sample.'
  : `  *** ${unreadablePositive} positive assertion(s) unread — the headline is a LOWER BOUND ***`);

console.log('\n  A WEAK guard is not a wrong test. It is a test that has stopped');
console.log('  pinning its subject, and it stays green while the subject leaves.');
console.log('  Counted, not repaired: fixing one member of a class before its size');
console.log('  is known is the order that produced this class.');
