// WHICH OF MY TESTS COULD ONLY EVER HAVE AGREED WITH ME?
//
// A test that certifies a belief rather than testing it passes even when the
// code it covers is broken. That is not a suspicion to reason about — it is
// mechanically decidable. Break the code on purpose, one targeted change at a
// time, and see which tests notice.
//
//   a mutation NOTHING catches   -> a blind spot, with a line and a name
//   a mutation everything catches-> the guard is a gate
//
// WHY THIS FILE EXISTS. `actionability()` shipped a false `no` on 31 Aug and
// the test covering that branch ASSERTED the defect — it encoded my belief, so
// green meant only that the code agreed with me. The instrument that should
// have caught it certified it. This harness is the answer to "how would I know
// if that happened again", and it is cheap enough to re-run.
//
//   node analysis/mutation-check.js
//
// SAFETY: the real source is restored from git between every run and verified
// clean at the end. It never commits a mutant; it fails loudly if it cannot
// restore.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'lockoutCore.js');
const TESTS = ['build', 'grid', 'lockout', 'actionability']
  .map((t) => path.join(ROOT, 'test', `${t}.test.js`));

// Each mutation names the CLAIM it is testing. If nothing fails, that claim is
// unguarded — the code may still be right, but nothing would tell us if it
// stopped being right.
const MUTATIONS = [
  { name: 'dedupe-early-return-removed',
    claim: 'damage rows must not reach the dedupe index',
    find: "if (ev.kind === 'damage' || ev.kind === 'self-damage' || ev.kind === 'song-pulse') {\n    return state;\n  }",
    repl: "if (false) {\n    return state;\n  }" },

  { name: 'observed-fraction-floor-to-zero',
    claim: 'a barely-observed period must read not_looked, not open',
    find: 'const MIN_OBSERVED_FRACTION = 0.05;',
    repl: 'const MIN_OBSERVED_FRACTION = 0;' },

  { name: 'cr-strip-removed',
    claim: 'a trailing CR must not silently blank the whole projection',
    find: 'if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);',
    repl: 'if (false) line = line.slice(0, -1);' },

  { name: 'span-gap-to-zero',
    claim: 'coverage spans merge within 30 minutes',
    find: 'const SPAN_GAP_MS = 30 * 60 * 1000;',
    repl: 'const SPAN_GAP_MS = 0;' },

  { name: 'self-damage-after-melee',
    claim: 'self-damage must be matched before melee or output inflates',
    find: '  if ((m = DAMAGE_SELF_RE.exec(message))) {',
    repl: '  if (false && (m = DAMAGE_SELF_RE.exec(message))) {' },

  { name: 'hour-known-forced-true',
    claim: 'the reset hour is unmeasured and conditional cells carry that',
    find: "const hourKnown = typeof resetHour === 'number' && resetHour >= 0 && resetHour < 24;",
    repl: 'const hourKnown = true;' },

  { name: 'token-cap-raised-to-99',
    claim: 'three tokens per period is what makes `no` reachable',
    find: '  tokens: 3,',
    repl: '  tokens: 99,' },

  { name: 'grant-window-to-zero',
    claim: 'a grant is paired to a hail within 3 seconds',
    find: 'const GRANT_WINDOW_MS = 3000;',
    repl: 'const GRANT_WINDOW_MS = 0;' },

  // THE FIRST VERSION OF THIS MUTATION WAS INERT, AND THAT MATTERS.
  //
  // It was `refusedWithControl && (answer = 'no')` on the `else if` line — which
  // sets `answer`, and is then immediately overwritten by the branch body's own
  // `answer = 'unknown'`. The harness reported NOT CAUGHT and I was one step
  // from telling the Director that the test I wrote to catch the 31 Aug defect
  // was vacuous. **It was the mutation that could not produce the defect, not
  // the test that could not detect it** — failure shape 1, at the harness layer,
  // found while using the harness to hunt failure shape 1.
  //
  // A mutation that changes nothing is indistinguishable from a test that
  // catches nothing, and only reading the generated mutant tells them apart.
  { name: 'false-no-reintroduced',
    claim: 'a controlled refusal must NOT answer `no` (the 31 Aug defect)',
    find: "    answer = 'unknown';\n    unknownKind = 'refusal-not-cap';",
    repl: "    answer = 'no';\n    unknownKind = 'refusal-not-cap';" },

  { name: 'completed-made-unactionable',
    claim: 'a completed cell is still actionable — repeats pay a drop',
    find: "cells.some((c) => c.state === 'open' || c.state === 'completed')",
    repl: "cells.some((c) => c.state === 'open')" },

  { name: 'max-seen-to-one',
    claim: 'the dedupe index is large enough that the horizon never fires',
    find: 'const MAX_SEEN = 200000;',
    repl: 'const MAX_SEEN = 1;' },

  { name: 'horizon-sample-floor-removed',
    claim: 'a rate is refused below a two-day sample',
    find: 'const MIN_HORIZON_SAMPLE_DAYS = 2;',
    repl: 'const MIN_HORIZON_SAMPLE_DAYS = 0;' },

  { name: 'weekday-trusted-from-client',
    claim: 'the weekday is computed, never trusted from the log line',
    find: 'return new Date(civilOf(at)).getUTCDay();',
    repl: "return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(at.weekday);" },
];

function restore() {
  execFileSync('git', ['checkout', '--', 'src/lockoutCore.js'], { cwd: ROOT });
}

// LINE ENDINGS BROKE THIS HARNESS ONCE AND THE FAILURE LOOKED LIKE A RESULT.
//
// `git checkout` restores the file with CRLF under `core.autocrlf`, while the
// working copy had LF. After the first run, every multi-line anchor below
// stopped matching and the harness reported two mutations as SKIPPED — which
// renders in the same column as a finding and would have been read as one.
//
// **The harness changed the line endings of the file it was measuring, and then
// mis-reported the consequence as a property of the tests.** Normalise both
// sides so an anchor matches whatever the checkout produced.
const lf = (s) => s.replace(/\r\n/g, '\n');

function runTests() {
  // Returns the failing FILES, the failing TEST NAMES, and the assertion count.
  //
  // THE NAMES ARE THE SURFACE. A count of blind spots is meaningless without
  // knowing how much of the suite these mutations could reach at all: three
  // survivors out of a suite where every test was in scope is a different
  // finding from three out of a suite where forty tests were never exercised.
  const failed = [];
  const names = new Set();
  let failCount = 0;
  for (const t of TESTS) {
    try {
      const out = execFileSync(process.execPath, [t], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      const m = /^ℹ fail (\d+)$/m.exec(out);
      if (m && Number(m[1]) > 0) { failed.push(path.basename(t)); failCount += Number(m[1]); }
      for (const n of out.matchAll(/^✖ (.+?) \(/gm)) names.add(n[1]);
    } catch (e) {
      const out = (e.stdout || '') + (e.stderr || '');
      const m = /^ℹ fail (\d+)$/m.exec(out);
      const n = m ? Number(m[1]) : 1;      // a crash counts as caught
      failed.push(path.basename(t));
      failCount += n;
      for (const nm of out.matchAll(/^✖ (.+?) \(/gm)) names.add(nm[1]);
    }
  }
  return { failed, failCount, names };
}

function main() {
  const dirty = execFileSync('git', ['status', '--porcelain', 'src/lockoutCore.js'],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) {
    console.error('src/lockoutCore.js is dirty. Commit or stash first — this ' +
                  'harness restores from git and would discard your changes.');
    process.exit(2);
  }

  const original = lf(fs.readFileSync(SRC, 'utf8'));

  console.log('=== BASELINE ===');
  const base = runTests();
  if (base.failCount !== 0) {
    console.error(`  baseline is not green (${base.failCount} failures). Fix first.`);
    process.exit(2);
  }
  console.log('  green\n');

  const blind = [];
  const everFired = new Set();
  console.log('=== MUTATIONS ===');
  for (const mut of MUTATIONS) {
    if (!original.includes(lf(mut.find))) {
      console.log(`  ${mut.name.padEnd(34)} SKIPPED — anchor not found (source moved)`);
      blind.push({ ...mut, reason: 'anchor not found' });
      continue;
    }
    fs.writeFileSync(SRC, original.replace(lf(mut.find), lf(mut.repl)), 'utf8');
    let res;
    try {
      res = runTests();
    } finally {
      restore();
    }
    const caught = res.failCount > 0;
    for (const n of res.names) everFired.add(n);
    console.log(`  ${mut.name.padEnd(34)} ${caught ? 'caught' : '*** NOT CAUGHT ***'}` +
                `  ${caught ? `${res.failCount} assertion(s) in ${res.failed.join(', ')}` : ''}`);
    if (!caught) blind.push({ ...mut, reason: 'no test failed' });
  }

  restore();
  const after = execFileSync('git', ['status', '--porcelain', 'src/lockoutCore.js'],
    { cwd: ROOT, encoding: 'utf8' }).trim();

  // THE SURFACE — how much of the suite these mutations could reach at all.
  //
  // A count of blind spots means nothing without it. Three survivors in a suite
  // where every test was in scope is a different finding from three in a suite
  // where forty tests were never exercised by any mutation chosen.
  const totalTests = TESTS.reduce((acc, t) => {
    const src = fs.readFileSync(t, 'utf8');
    return acc + (src.match(/^test\(/gm) || []).length;
  }, 0);

  console.log('\n=== SURFACE ===');
  console.log(`  tests in the suite                  : ${totalTests}`);
  console.log(`  tests that failed under >=1 mutation : ${everFired.size}`);
  console.log(`  never exercised by THIS mutation set : ${totalTests - everFired.size}`);
  console.log('  The last number is a fact about these mutations, NOT proof the');
  console.log('  remaining tests are vacuous. Add mutations to shrink it.');

  console.log('\n=== RESULT ===');
  if (!blind.length) {
    console.log('  Every mutation was caught. No blind spot found by THIS set.');
  } else {
    console.log(`  ${blind.length} BLIND SPOT(S):`);
    for (const b of blind) console.log(`    - ${b.name}: ${b.claim}\n      (${b.reason})`);
  }
  console.log(`\n  tree after restore: ${after ? 'DIRTY — ' + after : 'clean'}`);
  console.log('\n  WHAT THIS CANNOT SHOW: that the suite is complete. It tests the');
  console.log('  claims listed above and nothing else. A mutation absent from this');
  console.log('  file is not a claim this harness has cleared.');

  if (after) process.exit(2);
  process.exitCode = blind.length ? 1 : 0;
}

main();
