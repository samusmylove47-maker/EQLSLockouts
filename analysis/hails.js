'use strict';

// Every Voidling exchange in the corpus, classified GRANTED or REFUSED.
//
// This is the lockout detector, and it is an observable NEGATIVE with a
// positive control built into the mechanic itself:
//
//   You say, 'Hail, voidling'
//   Voidling says, '... accept the risk and the [danger]...'
//   You say, 'danger'
//   You have been assigned the task '...'            <- GRANTED
//   Voidling says, 'Your hubris risks our very reality itself.'
//
//   You say, 'Hail, voidling'
//   Voidling says, '... accept the risk and the [danger]...'
//   You say, 'danger'
//   Voidling says, 'Your hubris risks our very reality itself.'   <- REFUSED
//
// The two are byte-identical but for the task line. The Voidling's closing
// line fires either way, which is why this is safe: it proves the exchange
// happened and that the channel was not filtered. An empty result and a
// filtered capture are NOT byte-identical here — the standing hazard for this
// whole project does not apply to this signal.
//
//   node analysis/hails.js

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:\\Users\\Lindsey\\Desktop\\EQL Source\\eql-source\\state\\logs',
  'C:\\Users\\Lindsey\\Desktop\\EQL Source',
];

// Only the player's OWN exchange counts. Other people's hails are in the log
// too and say nothing about our lockout state.
const SELF_DANGER = /^You say, 'danger'$/;
const VOIDLING = /^Voidling says, '/;
const CLOSING = /^Voidling says, 'Your hubris risks our very reality itself\.'$/;

// TWO DEFECTS FOUND BY RUNNING THE FIRST VERSION OF THIS SCRIPT, both of which
// would have shipped a detector that reports REFUSED for a granted task:
//
// 1. THE CLOSING LINE CAN PRECEDE THE TASK LINE. Measured, verbatim:
//      [Tue Aug 11 20:40:44] You say, 'danger'
//      [Tue Aug 11 20:40:44] Voidling says, 'Your hubris risks our very reality itself.'
//      [Tue Aug 11 20:40:44] You have been assigned the task '... Lady Vox - Weekly'.
//    A state machine that closes the exchange on the first closing line
//    records REFUSED and then throws the grant away. The first version of this
//    script did exactly that and produced a false 0.474-hour reset bracket.
//    So the closing line is NOT a terminator. It is corroboration only.
//
// 2. A CLOSING LINE IS NOT RELIABLY MINE. Several players hail the same
//    Voidling within seconds and the replies interleave. Attribution has to
//    come from the one line that is unambiguously first-person — `You say,
//    'danger'` — and from a fixed time window after it.
//
// So: an attempt is the player's own 'danger'. It is GRANTED if a
// cadence-labelled task line lands within GRANT_WINDOW_S. Otherwise REFUSED —
// but only if a Voidling was demonstrably present and talking, which is the
// positive control. With no Voidling line nearby the attempt is UNKNOWN and
// is not counted as evidence in either direction.
const GRANT_WINDOW_S = 3;
const CONTROL_BEFORE_S = 20;
const CONTROL_AFTER_S = 5;
// Repeated 'danger' spam is one attempt, not several.
const COLLAPSE_S = 6;

function logFiles() {
  const out = [];
  for (const dir of DIRS) {
    for (const n of fs.readdirSync(dir)) if (/^eqlog_.*\.txt$/i.test(n)) out.push(path.join(dir, n));
  }
  return out.sort();
}

(async () => {
  const byChar = new Map();

  for (const full of logFiles()) {
    const ch = core.characterFromLogFilename(full);
    if (!byChar.has(ch)) byChar.set(ch, new Map());
    const seen = byChar.get(ch);

    // Single pass collecting three streams, then classify. Classifying inline
    // is what produced the ordering bug: the decision has to be made with the
    // whole window visible, not on the first line that looks like an ending.
    const attempts = [];
    const grants = [];
    const voidlingLines = [];
    const closings = [];

    const rl = readline.createInterface({ input: fs.createReadStream(full, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      const s = core.splitStamp(line);
      if (!s) continue;
      const civil = core.civilOf(s.at);

      if (SELF_DANGER.test(s.message)) {
        attempts.push({ civil, at: core.formatCivil(s.at) });
      } else if (VOIDLING.test(s.message)) {
        voidlingLines.push(civil);
        if (CLOSING.test(s.message)) closings.push(civil);
      } else {
        const ev = core.parseLine(line);
        if (ev && ev.kind === 'task-assigned' && ev.cadence) grants.push({ civil, boss: ev.boss });
      }
    }

    // Collapse 'danger' spam into one attempt each.
    const collapsed = [];
    for (const a of attempts) {
      const last = collapsed[collapsed.length - 1];
      if (last && a.civil - last.civil <= COLLAPSE_S * 1000) { collapsed[collapsed.length - 1] = a; continue; }
      collapsed.push(a);
    }

    for (const a of collapsed) {
      const grant = grants.find((g) => g.civil >= a.civil && g.civil - a.civil <= GRANT_WINDOW_S * 1000);
      const control = voidlingLines.some(
        (v) => v >= a.civil - CONTROL_BEFORE_S * 1000 && v <= a.civil + CONTROL_AFTER_S * 1000
      );
      const result = grant ? 'GRANTED' : control ? 'REFUSED' : 'UNKNOWN';
      if (!seen.has(a.at)) {
        seen.set(a.at, {
          at: a.at,
          civil: a.civil,
          result,
          boss: grant ? grant.boss : null,
          control,
          closingSeen: closings.some((c) => c >= a.civil - 2000 && c <= a.civil + CONTROL_AFTER_S * 1000),
        });
      }
    }
  }

  for (const [ch, m] of byChar) {
    const rows = [...m.values()].sort((a, b) => a.civil - b.civil);
    const granted = rows.filter((r) => r.result === 'GRANTED');
    const refused = rows.filter((r) => r.result === 'REFUSED');
    const unknown = rows.filter((r) => r.result === 'UNKNOWN');
    process.stdout.write(`\n================ ${ch} ================\n`);
    process.stdout.write(`classified exchanges: ${rows.length}   GRANTED ${granted.length}   REFUSED ${refused.length}\n\n`);
    for (const r of rows) {
      process.stdout.write(`  ${r.at}  ${r.result.padEnd(8)} ${r.boss || ''}\n`);
    }

    // The reset bracket, tightened by refusals. The last REFUSED before the
    // first GRANT of the new period is later evidence that the old period was
    // still in force than the last completion is.
    const firstAug11 = granted.find((g) => g.at >= '2026-08-11');
    if (firstAug11) {
      const lastRefusedBefore = refused.filter((r) => r.civil < firstAug11.civil).pop();
      if (lastRefusedBefore) {
        const h = (firstAug11.civil - lastRefusedBefore.civil) / 3600000;
        process.stdout.write(`\n  TIGHTENED RESET BRACKET\n`);
        process.stdout.write(`    old period still in force at: ${lastRefusedBefore.at}  (a REFUSED hail)\n`);
        process.stdout.write(`    new period in force by      : ${firstAug11.at}  (${firstAug11.boss})\n`);
        process.stdout.write(`    width: ${h.toFixed(3)} h\n`);
      }
    }
  }
})();
