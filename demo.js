'use strict';

// EQLS Lockouts — the grid, as text.
//
//   node demo.js
//
// No dependencies, no install, no network. Reads the committed fixture and
// prints what remains.
//
// WHAT REMAINS, NOT WHAT IS DONE. The owner's reason, in their words:
//
//   "we humans experience our own form of compression drift, and only remember
//    that we've done some of those raids, not precisely which ones... The
//    tracker becomes the human safeguard against forgetting to complete raids
//    by the reset deadline."
//
// So the first line is the count of open cells, the open list comes next, and
// the completed rows recede. A grid that leads with completions is a
// scoreboard; this is a checklist of what is still owed.

const fs = require('fs');
const path = require('path');
const core = require('./src/lockoutCore');

// '~~' is CONDITIONAL: a kill on the reset day itself. The cell knows the
// exact instant that decides it and prints it below, rather than shrugging.
const MARK = { completed: '##', open: ' .', conditional: ' ~', unknown: ' ?', not_looked: ' -' };

function readFixture() {
  return fs
    .readFileSync(path.join(__dirname, 'sources', 'raw', '2026-08-10-weekly-task-fixture.log'), 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'));
}

function render(grid, title, note) {
  const out = [];
  out.push('');
  out.push('='.repeat(72));
  out.push(`  ${title}`);
  out.push('='.repeat(72));

  // THE LEAD. This is the whole feature and it goes first.
  if (grid.notLookedCount === 25) {
    out.push('');
    out.push('  NOT LOOKED — nothing has been read yet.');
    out.push('');
    out.push('  This is NOT "you have 25 raids to do". It is "I do not know".');
    out.push('  Point me at your Logs folder and I will tell you which are open.');
  } else {
    out.push('');
    const bits = [`${grid.openCount} still open`];
    if (grid.conditionalCount) bits.push(`${grid.conditionalCount} turning on the reset hour`);
    if (grid.uncertainCount) bits.push(`${grid.uncertainCount} uncertain`);
    if (grid.notLookedCount) bits.push(`${grid.notLookedCount} not looked at`);
    out.push(`  ${bits.join('   ·   ')}      (${grid.completedCount} of 25 done)`);
    out.push('');
    if (grid.open.length) {
      out.push('  STILL OPEN:');
      for (const c of grid.open) {
        out.push(`      ${c.label.padEnd(13)} D${c.difficulty} ${c.difficultyLabel}`);
      }
    }
    // TURNS ON THE RESET HOUR. These are not "cannot tell" — they are answered
    // with a stated condition, and the condition is a clock time the player can
    // reason about. This section is the difference between a tool that refuses
    // to guess and a tool that refuses to help.
    if (grid.conditional.length) {
      out.push('');
      out.push('  TURNS ON THE RESET HOUR — we know exactly what would settle it:');
      for (const c of grid.conditional) {
        out.push(`      ${c.label.padEnd(13)} D${c.difficulty} ${c.difficultyLabel}`);
        out.push(`         DONE if ${c.decidedBy.doneIf}`);
        out.push(`         OPEN if ${c.decidedBy.openIf}`);
      }
    }
    if (grid.uncertain.length) {
      out.push('');
      out.push('  UNCERTAIN — may or may not already be done:');
      const byReason = new Map();
      for (const c of grid.uncertain) {
        const k = c.because;
        if (!byReason.has(k)) byReason.set(k, []);
        byReason.get(k).push(`${c.label} D${c.difficulty}`);
      }
      for (const [reason, list] of byReason) {
        out.push(`      ${list.join(', ')}`);
        out.push(`         why: ${reason}`);
      }
    }
  }

  // The grid itself, receding.
  out.push('');
  out.push('  ' + 'raid'.padEnd(14) + core.DIFFICULTY_LABELS.map((l, i) => `D${i}`.padStart(4)).join(''));
  for (const entry of core.RAIDS) {
    const row = grid.cells.filter((c) => c.raid === entry.key).sort((a, b) => a.difficulty - b.difficulty);
    out.push('  ' + entry.label.padEnd(14) + row.map((c) => MARK[c.state].padStart(4)).join(''));
  }
  out.push('');
  out.push('    ##  completed since the reset        .  still open');
  out.push('     ~  turns on the reset hour          ?  cannot tell');
  out.push('     -  not looked at');

  out.push('');
  out.push(`  reset rule : ${grid.resetRule.weekdayName}, hour NOT RECORDED`);
  out.push(`  source     : ${grid.resetRule.source} (${grid.resetRule.provenance}, not measured by us)`);
  out.push(`  our measure: reset falls inside ${grid.resetRule.measuredBracketPacific} Pacific`);
  out.push(`  period     : since ${grid.period.boundaryWeekday} ${grid.period.boundaryDay}`);
  out.push(`  coverage   : ${grid.period.coverageFrom || 'nothing'} .. ${grid.period.coverageTo || 'nothing'}` +
           `  (spans the period: ${grid.period.coverageSpansPeriod})`);
  if (note) { out.push(''); out.push(`  ${note}`); }
  out.push('');
  return out.join('\n');
}

// -- run 1: the fixture, as of the last line it contains --------------------
// `now` is the last observed moment, which is the honest posture for a replay:
// "here is what I know as of the last line I read". A live tailer has the same
// thing, because its last line is a second or two old.
//
// Pass a LATER `now` and the grid correctly degrades to not_looked, because
// coverage would no longer span up to the moment being asked about. That is the
// design working, not a bug — see run 2.
const st = core.applyLines(core.createState('Avenrae'), readFixture());
process.stdout.write(render(
  core.projectGrid(st, core.fromCivil(st.lastSeen)),
  'AVENRAE — from the committed fixture, as of its last line',
  'The fixture is a 93-line excerpt of two evenings, so most cells were never\n' +
  '  observed either way. For the full picture over 434 MB of real log:\n' +
  '      node analysis/grid-replay.js'
));

// -- run 2: the not_looked posture -----------------------------------------
process.stdout.write(render(
  core.projectGrid(core.createState('Avenrae'), { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 }),
  'FRESH INSTALL — nothing read yet',
  'THIS IS THE POINT: a fresh install shows 0 open, not 25.\n' +
  '  "I have not looked" and "you have not done it" are the same picture and\n' +
  '  different facts. Showing 25 open here would be a comfortable lie.'
));
