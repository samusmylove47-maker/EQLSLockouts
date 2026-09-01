// WHICH OF MY TESTS COULD ONLY EVER HAVE AGREED WITH ME?
//
// A test that certifies a belief rather than testing it passes even when the
// code it covers is broken. That is mechanically decidable: break the source on
// purpose, one targeted change at a time, and see which tests notice.
//
// ── EVERY MUTATION CARRIES A PROBE, AND THAT IS THE POINT (R84) ────────────
//
// The first version of this harness reported a mutation as NOT CAUGHT when the
// mutation was INERT — it assigned `answer` on an `else if` line and the branch
// body overwrote it immediately. I was one step from reporting a real test as
// vacuous. **An inert mutation and an undetected one are indistinguishable in
// the output and point in opposite directions.**
//
// So each mutation now carries a `probe`: a small function run against the
// ORIGINAL and the MUTANT. If its output is identical, the mutation changed
// nothing and its catch verdict is meaningless — reported as INERT, never as a
// finding. **A mutation harness needs its own matched pair.**
//
// ── OUTCOMES NEVER SHARE A COLUMN (failure shape 5) ───────────────────────
//
//   CAUGHT   probe changed, >=1 test failed         the guard is a gate
//   BLIND    probe changed, NO test failed          *** the only real finding
//   INERT    probe unchanged                        verdict meaningless
//   NOANCHOR text not found; the source moved       the harness is stale
//
// SKIPPED-for-a-missing-anchor once rendered in the same column as a finding.
// It fires correctly and destroys its own message. They are separated here.
//
//   node analysis/mutation-check.js
//
// SAFETY: restores src/lockoutCore.js from git between every run, refuses to
// start on a dirty tree, and verifies clean at the end.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'lockoutCore.js');
const TESTS = ['build', 'grid', 'lockout', 'actionability']
  .map((t) => path.join(ROOT, 'test', `${t}.test.js`));

// `git checkout` restores CRLF under core.autocrlf while the working copy may
// be LF. That silently broke every multi-line anchor once.
const lf = (s) => s.replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------
// Probe helpers — small, deterministic, and they must touch the mutated region.
// ---------------------------------------------------------------------------
const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
const line = (d, h, m, text, s = 0) => {
  const x = new Date(Date.UTC(2026, 7, d, h, m, s));
  return `[${DAYS[x.getUTCDay()]} ${MON[7]} ${p2(d)} ${p2(h)}:${p2(m)}:${p2(s)} 2026] ${text}`;
};
const beat = (from, to, everyMin = 20) => {
  const out = [];
  for (let d = from; d <= to; d++) {
    for (let m = 0; m < 1440; m += everyMin) out.push(line(d, Math.floor(m / 60), m % 60, 'You have entered Nektulos Forest.'));
  }
  return out;
};
const grantPair = (d, h, boss) => [
  line(d, h, 0, "You say, 'danger'"),
  line(d, h, 0, `You have been assigned the task 'Potential of the Void - ${boss} - Weekly'.`, 2),
];
const refusalPair = (d, h) => [
  line(d, h, 0, "You say, 'danger'"),
  line(d, h, 0, "Voidling says, 'Your hubris risks our very reality itself.'", 3),
];
const stateOf = (core, lines) => core.applyLines(core.createState('Avenrae'), lines);

// SPARSE COVERAGE: one 20-minute block per day. Gaps are ~23.7 h, under the
// 24 h hole tolerance, so `holes` stays empty and the OBSERVED-FRACTION floor
// is the only thing deciding the cells. Built to make two gates visible that a
// fully-covered fixture hides from every probe.
const sparse = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d++) {
    for (let m = 0; m <= 20; m += 10) out.push(line(d, 12, m, 'You have entered Nektulos Forest.'));
  }
  return out;
};

// ---------------------------------------------------------------------------
// The mutations. Each names the CLAIM it tests.
// ---------------------------------------------------------------------------
const MUTATIONS = [
  { name: 'dedupe-early-return-removed',
    claim: 'damage rows must not reach the dedupe index',
    find: "if (ev.kind === 'damage' || ev.kind === 'self-damage' || ev.kind === 'song-pulse') {\n    return state;\n  }",
    repl: 'if (false) {\n    return state;\n  }',
    probe: (c) => stateOf(c, [line(19, 10, 0, 'You hit a giant rat for 50 points of damage.')]).seenCount },

  { name: 'observed-fraction-floor-to-zero',
    claim: 'a barely-observed period reads not_looked, not open',
    find: 'const MIN_OBSERVED_FRACTION = 0.05;',
    repl: 'const MIN_OBSERVED_FRACTION = 0;',
    probe: (c) => { const g = c.projectGrid(stateOf(c, sparse(15, 21)), NOW); return [g.period.coverageSpansPeriod, g.notLookedCount, g.openCount]; } },

  { name: 'cr-strip-removed',
    claim: 'a trailing CR must not silently blank the projection',
    find: 'if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);',
    repl: 'if (false) line = line.slice(0, -1);',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You have entered Nektulos Forest.') + '\r'); return e && e.kind; } },

  { name: 'span-gap-to-zero',
    claim: 'coverage spans merge within 30 minutes',
    find: 'const SPAN_GAP_MS = 30 * 60 * 1000;',
    repl: 'const SPAN_GAP_MS = 0;',
    probe: (c) => stateOf(c, beat(19, 19)).spans.length },

  { name: 'self-damage-branch-disabled',
    claim: 'a self-hit is never counted as outgoing output',
    find: '  if ((m = DAMAGE_SELF_RE.exec(message))) {',
    repl: '  if (false && (m = DAMAGE_SELF_RE.exec(message))) {',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You hit yourself for 50 points of magic damage by Lifetap Strike.')); return e ? [e.kind, e.outgoing] : null; } },

  { name: 'hour-known-forced-true',
    claim: 'the reset hour is unmeasured and conditional cells carry that',
    find: "const hourKnown = typeof resetHour === 'number' && resetHour >= 0 && resetHour < 24;",
    repl: 'const hourKnown = true;',
    probe: (c) => c.projectGrid(stateOf(c, beat(15, 21)), NOW).period.hourKnown },

  { name: 'token-cap-raised-to-99',
    claim: 'three tokens per period is what makes `no` reachable',
    find: '  tokens: 3,',
    repl: '  tokens: 99,',
    probe: (c) => c.actionability(stateOf(c, [...beat(15, 21), ...grantPair(19, 10, 'Lord Nagafen'), ...grantPair(19, 12, 'Lady Vox'), ...grantPair(20, 10, 'Master Yael')]), NOW, { raid: "Nagafen's Lair", difficulty: 3 }).answer },

  { name: 'grant-window-to-zero',
    claim: 'a grant is paired to a hail within 3 seconds',
    find: 'const GRANT_WINDOW_MS = 3000;',
    repl: 'const GRANT_WINDOW_MS = 0;',
    probe: (c) => c.classifyRequests(stateOf(c, grantPair(19, 10, 'Lord Nagafen')))[0].result },

  { name: 'false-no-reintroduced',
    claim: 'a controlled refusal must NOT answer `no` (the 31 Aug defect)',
    find: "    answer = 'unknown';\n    unknownKind = 'refusal-not-cap';",
    repl: "    answer = 'no';\n    unknownKind = 'refusal-not-cap';",
    probe: (c) => c.actionability(stateOf(c, [...beat(15, 21), ...refusalPair(20, 14)]), NOW, { raid: "Nagafen's Lair", difficulty: 3 }).answer },

  { name: 'completed-made-unactionable',
    claim: 'a completed cell is still actionable — repeats pay a drop',
    find: "cells.some((c) => c.state === 'open' || c.state === 'completed')",
    repl: "cells.some((c) => c.state === 'open')",
    probe: (c) => c.actionability(stateOf(c, [...beat(15, 21), ...grantPair(19, 10, 'Lord Nagafen'), line(19, 11, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."), line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!')]), NOW, { raid: "Nagafen's Lair", difficulty: 3 }).answer },

  { name: 'max-seen-to-one',
    claim: 'the dedupe index is large enough that the horizon never fires',
    find: 'const MAX_SEEN = 200000;',
    repl: 'const MAX_SEEN = 1;',
    probe: (c) => c.THRESHOLDS.MAX_EVENTS && stateOf(c, [...beat(19, 20), line(19, 11, 0, 'Lord Nagafen has been slain by Avenrae!')]).seenCount },

  { name: 'horizon-sample-floor-removed',
    claim: 'a rate is refused below a two-day sample',
    find: 'const MIN_HORIZON_SAMPLE_DAYS = 2;',
    repl: 'const MIN_HORIZON_SAMPLE_DAYS = 0;',
    probe: (c) => c.horizon(stateOf(c, beat(20, 20))).provenance },

  { name: 'weekday-trusted-from-client',
    claim: 'the weekday is derived from the date, never trusted from the line',
    find: 'return new Date(civilOf(at)).getUTCDay();',
    repl: "return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(at.weekday);",
    probe: (c) => c.civilWeekday({ weekday: 'Fri', year: 2026, month: 8, day: 10, hour: 0, minute: 0, second: 0 }) },

  // ── ADDED 31 Aug to reach some of the 87 tests no mutation touched ───────

  { name: 'bare-group-difficulty-dropped',
    claim: 'a bare `- Group` is difficulty 0, carried as difficultyFromOmission',
    find: '      difficultyFromOmission: isGroup,',
    repl: '      difficultyFromOmission: false,',
    probe: (c) => JSON.stringify(c.parseInstanceName('The Plane of Fear - Group')) },

  { name: 'boss-name-normaliser-identity',
    claim: 'boss names are normalised before the roster join',
    find: 'function normaliseBossName(name) {',
    repl: 'function normaliseBossName(name) { return String(name);',
    probe: (c) => [c.normaliseBossName('LORD NAGAFEN'), !!c.RAID_OF_BOSS[c.normaliseBossName('Lord Nagafen')]] },

  { name: 'not-a-zone-set-emptied',
    claim: 'a non-zone notice must not be reported as a zone-in',
    find: 'if (NOT_A_ZONE.has(name)) return { kind: \'not-a-zone\', at, text: name };',
    repl: 'if (false) return { kind: \'not-a-zone\', at, text: name };',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You have entered an area where levitation effects do not function.')); return e && [e.kind, e.unrecognised === true]; } },

  { name: 'voidling-closing-matches-anything',
    claim: 'the positive control keys on the CLOSING line, not any Voidling line',
    find: 'closing: VOIDLING_CLOSING_RE.test(message)',
    repl: 'closing: true',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, "Voidling says, 'Some other sentence entirely.'")); return e && e.closing; } },

  { name: 'collapse-window-to-zero',
    claim: 'repeated hails inside 6 s collapse to one request',
    find: 'const COLLAPSE_MS = 6000;',
    repl: 'const COLLAPSE_MS = 0;',
    probe: (c) => c.classifyRequests(stateOf(c, [line(19, 10, 0, "You say, 'danger'"), line(19, 10, 0, "You say, 'danger'", 2)])).length },

  { name: 'voidling-bound-to-one',
    claim: 'the Voidling reply set is bounded, and overflow degrades safely',
    find: 'const MAX_VOIDLING_REPLIES = 5000;',
    repl: 'const MAX_VOIDLING_REPLIES = 1;',
    // MUST USE CLOSING LINES. After the 31 Aug fix only the closing line enters
    // the set, so a probe built from chatter exercises nothing and reports INERT
    // — which is the harness correctly refusing to rule, not a finding.
    probe: (c) => stateOf(c, [
      line(19, 10, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
      line(19, 10, 30, "Voidling says, 'Your hubris risks our very reality itself.'"),
      line(19, 11, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
    ]).voidlingReplies.length },

  { name: 'window-name-mapping-emptied',
    claim: 'alt+Z names map to kill-line names or a lockout reads as missing',
    find: "  'Innoruuk': 'Innoruuk, the Prince of Hate',",
    repl: '',
    probe: (c) => JSON.stringify(c.WINDOW_TO_KILL_NAME) },

  { name: 'reset-rule-provenance-upgraded',
    claim: 'the reset weekday is STATED by the owner, never measured by us',
    find: "  provenance: 'stated',          // NOT 'measured'. We did not observe this.",
    repl: "  provenance: 'observed',",
    probe: (c) => c.RESET_RULE.provenance },

  { name: 'period-gap-tolerance-to-zero',
    claim: 'gaps under 24 h are tolerated rather than blanking the period',
    find: 'const PERIOD_GAP_TOLERANCE_MS = 24 * 60 * 60 * 1000;',
    repl: 'const PERIOD_GAP_TOLERANCE_MS = 0;',
    probe: (c) => { const g = c.projectGrid(stateOf(c, sparse(15, 21)), NOW); return [g.period.coverageSpansPeriod, g.period.coverageHoles.length]; } },
];

function restore() {
  execFileSync('git', ['checkout', '--', 'src/lockoutCore.js'], { cwd: ROOT });
}

function probeOf(mut) {
  delete require.cache[require.resolve(SRC)];
  let core;
  try { core = require(SRC); } catch (e) { return 'LOAD-THREW: ' + e.message; }
  try { return JSON.stringify(mut.probe(core)); } catch (e) { return 'THREW: ' + e.message; }
}

function runTests() {
  const failedFiles = [];
  const names = new Set();
  let failCount = 0;
  for (const t of TESTS) {
    let out;
    try {
      out = execFileSync(process.execPath, [t], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
      if (!/^ℹ fail \d+$/m.test(out)) { failedFiles.push(path.basename(t)); failCount += 1; continue; }
    }
    const m = /^ℹ fail (\d+)$/m.exec(out);
    if (m && Number(m[1]) > 0) { failedFiles.push(path.basename(t)); failCount += Number(m[1]); }
    for (const n of out.matchAll(/^✖ (.+?) \(/gm)) names.add(n[1]);
  }
  return { failedFiles, failCount, names };
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
  console.log('  green');

  // Baseline probe values, from the UNMUTATED module.
  const baseProbe = new Map();
  for (const mut of MUTATIONS) baseProbe.set(mut.name, probeOf(mut));

  const rows = [];
  const everFired = new Set();

  console.log('\n=== MUTATIONS ===');
  for (const mut of MUTATIONS) {
    if (!original.includes(lf(mut.find))) {
      rows.push({ mut, outcome: 'NOANCHOR', detail: 'anchor text not in source' });
      continue;
    }
    fs.writeFileSync(SRC, original.replace(lf(mut.find), lf(mut.repl)), 'utf8');

    // THE MATCHED PAIR: did this mutation change behaviour at all?
    const after = probeOf(mut);
    const before = baseProbe.get(mut.name);
    const live = after !== before;

    let res = { failCount: 0, failedFiles: [], names: new Set() };
    if (live) {
      try { res = runTests(); } finally { /* restored below */ }
    }
    restore();
    delete require.cache[require.resolve(SRC)];

    for (const n of res.names) everFired.add(n);

    if (!live) {
      rows.push({ mut, outcome: 'INERT', detail: `probe unchanged (${before})` });
    } else if (res.failCount > 0) {
      rows.push({ mut, outcome: 'CAUGHT', detail: `${res.failCount} assertion(s) in ${res.failedFiles.join(', ')}` });
    } else {
      rows.push({ mut, outcome: 'BLIND', detail: `probe ${before} -> ${after}, no test failed` });
    }
  }

  restore();
  const after = execFileSync('git', ['status', '--porcelain', 'src/lockoutCore.js'],
    { cwd: ROOT, encoding: 'utf8' }).trim();

  // Outcomes never share a column.
  const group = (o) => rows.filter((r) => r.outcome === o);
  for (const o of ['CAUGHT', 'BLIND', 'INERT', 'NOANCHOR']) {
    const g = group(o);
    if (!g.length) continue;
    console.log(`\n  ${o}  (${g.length})`);
    for (const r of g) console.log(`    ${r.mut.name.padEnd(34)} ${r.detail}`);
  }

  const totalTests = TESTS.reduce((acc, t) =>
    acc + (fs.readFileSync(t, 'utf8').match(/^test\(/gm) || []).length, 0);

  console.log('\n=== SURFACE ===');
  console.log(`  tests in the suite                   : ${totalTests}`);
  console.log(`  tests that failed under >=1 mutation : ${everFired.size}`);
  console.log(`  never exercised by THIS mutation set : ${totalTests - everFired.size}`);
  console.log('  The last number is a fact about these mutations, NOT proof the');
  console.log('  remaining tests are vacuous. Add mutations to shrink it.');

  console.log('\n=== RESULT ===');
  const blind = group('BLIND');
  const inert = group('INERT');
  const noanchor = group('NOANCHOR');
  console.log(`  ${group('CAUGHT').length} caught · ${blind.length} BLIND · ` +
              `${inert.length} inert · ${noanchor.length} no-anchor`);
  for (const r of blind) console.log(`    BLIND: ${r.mut.name} — ${r.mut.claim}`);
  for (const r of inert) console.log(`    INERT (verdict meaningless, fix the mutation): ${r.mut.name}`);
  for (const r of noanchor) console.log(`    NO ANCHOR (harness is stale): ${r.mut.name}`);
  console.log(`\n  tree after restore: ${after ? 'DIRTY — ' + after : 'clean'}`);

  if (after) process.exit(2);
  process.exitCode = (blind.length || inert.length || noanchor.length) ? 1 : 0;
}

main();
