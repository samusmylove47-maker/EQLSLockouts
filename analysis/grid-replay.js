'use strict';

// Replays the whole 434 MB corpus through the grid, one character at a time.
//
//   node analysis/grid-replay.js
//
// This is the acceptance test the grid actually has to pass. A fixture proves
// the code runs; only the real log proves it survives two boxed characters,
// overlapping duplicate files, open-world kills, invites never accepted, and
// bosses whose names contain other bosses' names.
//
// `now` is each character's LAST OBSERVED MOMENT — the honest posture for a
// replay. Asking about a later moment correctly degrades cells to not_looked,
// because coverage no longer reaches the question.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:\\Users\\Lindsey\\Desktop\\EQL Source\\eql-source\\state\\logs',
  'C:\\Users\\Lindsey\\Desktop\\EQL Source',
];
const MARK = { completed: '##', available: ' .', unknown: ' ?', not_looked: ' -' };

function logFiles() {
  const out = [];
  for (const dir of DIRS) {
    for (const n of fs.readdirSync(dir)) if (/^eqlog_.*\.txt$/i.test(n)) out.push(path.join(dir, n));
  }
  return out.sort();
}

(async () => {
  const states = new Map();
  for (const full of logFiles()) {
    const ch = core.characterFromLogFilename(full);
    if (!states.has(ch)) states.set(ch, core.createState(ch));
    const st = states.get(ch);
    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) core.applyLine(st, line);
  }

  for (const [ch, st] of states) {
    const now = core.fromCivil(st.lastSeen);
    const grid = core.projectGrid(st, now);

    process.stdout.write(`\n${'='.repeat(72)}\n  ${ch} — as of ${core.formatCivil(now)}\n${'='.repeat(72)}\n\n`);
    const bits = [`${grid.openCount} still open`];
    if (grid.uncertainCount) bits.push(`${grid.uncertainCount} uncertain`);
    if (grid.notLookedCount) bits.push(`${grid.notLookedCount} not looked at`);
    process.stdout.write(`  ${bits.join('   ·   ')}      (${grid.completedCount} of 25 done)\n\n`);

    process.stdout.write('  ' + 'boss'.padEnd(14) + core.DIFFICULTY_LABELS.map((l, i) => `D${i}`.padStart(4)).join('') + '\n');
    for (const entry of core.ROSTER) {
      const row = grid.cells.filter((c) => c.boss === entry.key).sort((a, b) => a.difficulty - b.difficulty);
      process.stdout.write('  ' + entry.label.padEnd(14) + row.map((c) => MARK[c.state].padStart(4)).join('') + '\n');
    }

    process.stdout.write(`\n  period since ${grid.period.boundaryWeekday} ${grid.period.boundaryDay}`);
    process.stdout.write(`   coverage ${grid.period.coverageFrom} .. ${grid.period.coverageTo}\n`);

    // Every roster kill in the whole corpus, not just this period — this is the
    // part that says whether the grid is seeing what the logs actually contain.
    process.stdout.write(`\n  ALL ${st.kills.length} roster kills in the corpus:\n`);
    const byBoss = new Map();
    for (const k of st.kills) {
      if (!byBoss.has(k.boss)) byBoss.set(k.boss, []);
      byBoss.get(k.boss).push(k);
    }
    for (const entry of core.ROSTER) {
      const ks = byBoss.get(entry.key) || [];
      if (!ks.length) { process.stdout.write(`    ${entry.label.padEnd(13)} none\n`); continue; }
      const tiers = ks.map((k) => {
        if (!k.instanced) return 'open-world';
        if (!k.difficultyStated) return `${k.group ? 'group' : 'raid'}/D?`;
        return `${k.group ? 'group' : 'raid'}/D${k.difficulty}`;
      });
      const counts = tiers.reduce((m, t) => m.set(t, (m.get(t) || 0) + 1), new Map());
      process.stdout.write(`    ${entry.label.padEnd(13)} ${ks.length.toString().padStart(2)} kills  ` +
        [...counts.entries()].sort().map(([t, n]) => `${t}×${n}`).join('  ') + '\n');
    }

    // Attribution honesty: how far back was the zone-in we blamed?
    const gaps = st.kills.filter((k) => k.secondsSinceZoneIn !== null).map((k) => k.secondsSinceZoneIn);
    if (gaps.length) {
      gaps.sort((a, b) => a - b);
      const med = gaps[Math.floor(gaps.length / 2)];
      process.stdout.write(`\n  zone-in to kill: min ${gaps[0]}s  median ${med}s  max ${gaps[gaps.length - 1]}s` +
        `   (${st.kills.length - gaps.length} kills with no preceding zone-in)\n`);
    }
  }
})();
