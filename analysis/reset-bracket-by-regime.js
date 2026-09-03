'use strict';

// A MATCHED PAIR ACROSS THE 18 AUGUST REGIME BOUNDARY.
//
//   node analysis/reset-bracket-by-regime.js
//
// A staff broadcast on `Tue Aug 18 00:36:13 2026` announced a known issue with
// the weekly reset, resolved by the next morning's patch. Our corpus spans it,
// and the load-bearing constants sit on opposite sides: RESET_RULE's bracket
// and TOKEN_CAP are pre-patch, LOCKOUT_MODEL is post-patch. See docs/CANON.md.
//
// THE QUESTION, AND ONLY THIS ONE: does observed reset behaviour differ between
// the two brackets? NOTHING IS SPLIT AND NOTHING IS RE-DERIVED. Deciding what
// to do about the answer is a modelling decision and is the Director's.
//
// 18 AUGUST IS UNASSIGNABLE IN FULL. The broadcast is an announcement, not the
// change — the patch landed "in the morning" after it — so the seam is
// somewhere inside that day, and no observation from it is used.
//
// THE INSTRUMENT, AND MY FIRST ONE WAS WRONG. I first looked for `refused ->
// granted` transitions in classifyRequests, and found SEVEN before the seam and
// ZERO after it, which reads as "the post-patch regime has no reset". It does
// not. The token `Void-Touched Potential` arrives on task COMPLETION, so the
// post-patch grants had no classifiable hail beside them. The weekly budget is
// spent on task ASSIGNMENT, so assignment is the signal and the grant is not.
// A signal absent on one side of a comparison is the first thing to distrust
// about the instrument, not the first thing to believe about the world.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:/Users/Lindsey/Desktop/EQL Source/eql-source/state/logs',
  'C:/Users/Lindsey/Desktop/EQL Source',
  'C:/Users/Public/Daybreak Game Company/Installed Games/EverQuest Legends/Logs',
];

const cv = (y, mo, d, h, mi, s) => core.civilOf({ year: y, month: mo, day: d, hour: h, minute: mi, second: s });
const SEAM_LO = cv(2026, 8, 18, 0, 0, 0);
const SEAM_HI = cv(2026, 8, 19, 0, 0, 0);
const regimeOf = (civil) => (civil < SEAM_LO ? 'BEFORE' : civil >= SEAM_HI ? 'AFTER' : 'SEAM');
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A hail and the assignment it produced are ONE interaction. GRANT_WINDOW_MS is
// 3s, so an assignment arriving 30s after its hail leaves that hail classified
// `refused` — which would then be read as a bound on a reset. Excluded, and the
// rule is stated rather than tuned: a refusal followed by an assignment within
// five minutes is the same exchange, not evidence of an exhausted budget.
const SAME_EXCHANGE_MS = 5 * 60 * 1000;
// A new weekly period is a long gap in assignments. 48h was my first guess and
// it MERGED two real periods — Mon 10 Aug and Tue 11 Aug are 26.9h apart and are
// plainly different weeks. The threshold is not tuned to taste: the script
// prints the largest WITHIN-period gap against the smallest BETWEEN-period gap
// so a reader can see whether 24h sits in a clear valley or on a knife edge. If
// those two numbers ever get close, this instrument has stopped working and the
// output says so rather than quietly picking a side.
const NEW_PERIOD_MS = 24 * 60 * 60 * 1000;

function logFiles() {
  const out = [];
  for (const d of DIRS) {
    let names = [];
    try { names = fs.readdirSync(d); } catch (e) { console.error('MISSING DIR ' + d); continue; }
    for (const n of names) if (/^eqlog_.*\.txt$/i.test(n)) out.push(path.join(d, n));
  }
  return out.sort();
}

(async () => {
  const files = logFiles();
  if (!files.length) { console.error('NO FILES — refusing to report zeros as a measurement'); process.exit(1); }

  const byChar = new Map();
  for (const f of files) {
    const ch = core.characterFromLogFilename(path.basename(f)) || '?';
    if (!byChar.has(ch)) byChar.set(ch, core.createState(ch));
    const rl = readline.createInterface({ input: fs.createReadStream(f, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) core.applyLine(byChar.get(ch), line);
  }
  console.log(files.length + ' files, characters: ' + [...byChar.keys()].join(', '));
  console.log('18 Aug 2026 treated as UNASSIGNABLE in full\n');

  const brackets = { BEFORE: [], AFTER: [] };
  const periodSizes = { BEFORE: [], AFTER: [] };

  for (const [ch, st] of byChar) {
    const assigns = [];
    for (const t of Object.values(st.tasks)) {
      if (!t.cadence) continue;
      for (const a of t.assignments) assigns.push(a.civil);
    }
    assigns.sort((a, b) => a - b);
    const refusals = core.classifyRequests(st)
      .filter((r) => r.result === 'refused')
      .map((r) => r.civil)
      .filter((c) => !assigns.some((a) => a > c && a - c <= SAME_EXCHANGE_MS))
      .sort((a, b) => a - b);

    // Split assignments into weekly periods on the long gap, and record the two
    // numbers that say whether the threshold is safe.
    const periods = [];
    for (const a of assigns) {
      const last = periods[periods.length - 1];
      if (!last || a - last[last.length - 1] > NEW_PERIOD_MS) periods.push([a]);
      else last.push(a);
    }
    let maxIntra = 0, minInter = Infinity;
    for (let i = 1; i < assigns.length; i++) {
      const gap = assigns[i] - assigns[i - 1];
      if (gap > NEW_PERIOD_MS) minInter = Math.min(minInter, gap);
      else maxIntra = Math.max(maxIntra, gap);
    }
    if (assigns.length > 1) {
      console.log('   threshold check: largest WITHIN-period gap ' + (maxIntra / 3600000).toFixed(1) +
        'h vs smallest BETWEEN-period gap ' +
        (minInter === Infinity ? 'n/a' : (minInter / 3600000).toFixed(1) + 'h') +
        (minInter !== Infinity && minInter / maxIntra < 1.15 ? '   *** KNIFE EDGE — DISTRUST THIS SPLIT ***' : '   (clear valley)'));
    }

    console.log('=== ' + ch + ' — ' + assigns.length + ' assignments in ' + periods.length + ' period(s), ' +
                refusals.length + ' refusals after same-exchange filtering');
    for (const p of periods) {
      const start = core.fromCivil(p[0]);
      const reg = regimeOf(p[0]);
      if (reg !== 'SEAM') periodSizes[reg].push(p.length);
      console.log('   ' + reg.padEnd(6) + ' period of ' + p.length + ' starting ' +
                  core.formatCivil(start) + ' ' + WD[core.civilWeekday(start)]);
      // The reset bracket: last refusal before this period's first assignment.
      const prior = refusals.filter((r) => r < p[0]);
      if (!prior.length) { console.log('        no prior refusal — period start not bracketed'); continue; }
      const lo = prior[prior.length - 1], hi = p[0];
      const rl2 = regimeOf(lo), rh = regimeOf(hi);
      if (rl2 === 'SEAM' || rh === 'SEAM' || rl2 !== rh) {
        console.log('        bracket touches the seam or spans it — DISCARDED, not assigned to a regime');
        continue;
      }
      const f = core.fromCivil(lo), t = core.fromCivil(hi);
      brackets[rl2].push({ ch, lo, hi, f, t });
      console.log('        reset bracket: ' + core.formatCivil(f) + ' ' + WD[core.civilWeekday(f)] +
                  '  ..  ' + core.formatCivil(t) + ' ' + WD[core.civilWeekday(t)] +
                  '   (' + ((hi - lo) / 3600000).toFixed(1) + 'h)');
    }
    console.log();
  }

  console.log('=== THE COMPARISON ===');
  for (const reg of ['BEFORE', 'AFTER']) {
    const bs = brackets[reg];
    console.log('\n  ' + reg + ': ' + bs.length + ' bracket(s), ' +
                'period sizes ' + (periodSizes[reg].join('/') || 'none'));
    for (const b of bs) {
      console.log('    ' + WD[core.civilWeekday(b.f)] + ' ' + core.formatCivil(b.f).slice(11) +
                  '  ..  ' + WD[core.civilWeekday(b.t)] + ' ' + core.formatCivil(b.t).slice(11) +
                  '   [' + b.ch + ']');
    }
  }

  const both = brackets.BEFORE.length && brackets.AFTER.length;
  console.log('\n=== VERDICT ===');
  if (!both) {
    console.log('  CANNOT COMPARE — one side has no bracket. A gap in the sample, which is');
    console.log('  neither agreement nor disagreement.');
  } else {
    const days = (bs) => {
      const s = new Set();
      for (const b of bs) { s.add(core.civilWeekday(b.f)); s.add(core.civilWeekday(b.t)); }
      return [...s].sort();
    };
    const db = days(brackets.BEFORE), da = days(brackets.AFTER);
    console.log('  BEFORE brackets touch: ' + db.map((d) => WD[d]).join('/'));
    console.log('  AFTER  brackets touch: ' + da.map((d) => WD[d]).join('/'));
    const same = db.length === da.length && db.every((d, i) => d === da[i]);
    console.log('  ' + (same
      ? 'AGREE — both regimes bracket the reset to the same weekday transition.'
      : 'DISAGREE — the regimes bracket different weekdays.'));
    console.log('  Period sizes: BEFORE ' + periodSizes.BEFORE.join('/') +
                ', AFTER ' + periodSizes.AFTER.join('/') +
                ' — TOKEN_CAP now has evidence on BOTH sides, where it had only pre-patch before.');
  }

  console.log('\n=== WHAT THIS DOES NOT SETTLE ===');
  console.log('  THE BRACKETS ARE WIDER THAN 24h, so neither pins a weekday on its own:');
  console.log('  each is consistent with a late-Monday reset as well as a Tuesday one. That');
  console.log('  matches RESET_RULE already being `stated` by the owner and merely CONTAINED');
  console.log('  by a measurement.');
  console.log('  THE HOUR IS UNMEASURED IN BOTH REGIMES, so a change to the reset HOUR would');
  console.log('  be invisible to this comparison. Agreement here is agreement about the');
  console.log('  weekday transition and nothing finer.');
  console.log('  AND THE BRACKETS ARE NOT INTERSECTED. Combining them into one tighter window');
  console.log('  would assume the very thing under test — that the regimes are the same —');
  console.log('  which is the corroboration-across-a-boundary error this whole exercise is about.');
})();
