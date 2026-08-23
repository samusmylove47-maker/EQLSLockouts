'use strict';

// Before/after capture for a deliberately-run raid.
//
//   node capture.js before      run this BEFORE the raid
//   node capture.js after       run this AFTER — it diffs against the last `before`
//
// Writes a text snapshot and a JSON snapshot into captures/, and on `after`
// prints exactly which cells changed and which log lines caused it.
//
// This reads the LIVE game log, not the archived copies:
//   <install>/Logs/eqlog_<Character>_<server>.txt
// The archives under state/logs/ are stale snapshots and would show yesterday.
//
// Raw logs never commit. The .txt and .json written here contain only grid
// state and the roster kill lines that produced it — no chat.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('./src/lockoutCore');

const LIVE_LOGS = 'C:\\Users\\Public\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs';
// Archived copies, fed first so coverage reaches back before the reset. Without
// them the live file alone starts mid-period and every cell is not_looked.
const ARCHIVES = [
  'C:\\Users\\Lindsey\\Desktop\\EQL Source\\eql-source\\state\\logs',
  'C:\\Users\\Lindsey\\Desktop\\EQL Source',
];
const OUT_DIR = path.join(__dirname, 'captures');
const MARK = { completed: '##', open: ' .', unknown: ' ?', not_looked: ' -' };

function logFilesFor(character) {
  const out = [];
  for (const dir of [...ARCHIVES, LIVE_LOGS]) {
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      if (new RegExp(`^eqlog_${character}_`, 'i').test(n) && n.endsWith('.txt')) {
        out.push(path.join(dir, n));
      }
    }
  }
  // Live last, so the newest lines land last. Order does not affect state —
  // `now` never touches it — but it keeps the read predictable.
  return out;
}

async function build(character) {
  const st = core.createState(character);
  const files = logFilesFor(character);
  for (const f of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(f, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) core.applyLine(st, line);
  }
  return { st, files };
}

function renderGrid(grid, character, files) {
  const L = [];
  L.push('='.repeat(72));
  L.push(`  ${character} — as of ${grid.period.coverageTo || 'nothing observed'}`);
  L.push('='.repeat(72));
  L.push('');
  if (grid.notLookedCount === 25) {
    L.push('  NOT LOOKED — the record does not cover this period.');
  } else {
    const bits = [`${grid.openCount} still open`];
    if (grid.uncertainCount) bits.push(`${grid.uncertainCount} uncertain`);
    if (grid.notLookedCount) bits.push(`${grid.notLookedCount} not looked at`);
    L.push(`  ${bits.join('   ·   ')}      (${grid.completedCount} of 25 done)`);
  }
  L.push('');
  L.push('  ' + 'boss'.padEnd(14) + core.DIFFICULTY_LABELS.map((l, i) => `D${i}`.padStart(4)).join(''));
  for (const e of core.ROSTER) {
    const row = grid.cells.filter((c) => c.boss === e.key).sort((a, b) => a.difficulty - b.difficulty);
    L.push('  ' + e.label.padEnd(14) + row.map((c) => MARK[c.state].padStart(4)).join(''));
  }
  L.push('');
  L.push('    ##  completed        .  still open        ?  cannot tell        -  not looked at');
  L.push('');
  L.push(`  period       : since ${grid.period.boundaryWeekday} ${grid.period.boundaryDay}` +
         `  (reset hour NOT RECORDED)`);
  L.push(`  coverage     : ${grid.period.coverageFrom} .. ${grid.period.coverageTo}`);
  L.push(`  spans period : ${grid.period.coverageSpansPeriod}`);
  if (grid.period.coverageHoles.length) {
    for (const h of grid.period.coverageHoles) {
      L.push(`     HOLE      : ${h.from} .. ${h.to}  (${h.hours} h unobserved)`);
    }
  }
  L.push(`  files read   : ${files.length}`);
  return L.join('\n');
}

function cellKey(c) { return `${c.label} D${c.difficulty}`; }

(async () => {
  const label = (process.argv[2] || 'snapshot').replace(/[^a-z0-9_-]/gi, '');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const characters = new Set();
  for (const dir of [LIVE_LOGS, ...ARCHIVES]) {
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      const ch = core.characterFromLogFilename(n);
      if (ch && n.endsWith('.txt')) characters.add(ch);
    }
  }

  const snapshot = { label, characters: {} };
  const text = [];

  for (const ch of [...characters].sort()) {
    const { st, files } = await build(ch);
    if (st.lastSeen === null) continue;
    const grid = core.projectGrid(st, core.fromCivil(st.lastSeen));
    text.push(renderGrid(grid, ch, files));
    text.push('');
    snapshot.characters[ch] = {
      asOf: grid.period.coverageTo,
      cells: grid.cells.map((c) => ({ key: cellKey(c), state: c.state, because: c.because })),
      kills: st.kills.map((k) => ({
        boss: k.boss,
        at: core.formatCivil(k.at),
        zone: k.zone,
        shape: k.instanced ? (k.group ? 'group' : 'raid') : 'open-world',
        difficulty: k.difficulty,
        difficultyStated: k.difficultyStated,
      })),
      openCount: grid.openCount,
      completedCount: grid.completedCount,
    };
  }

  const body = text.join('\n');
  process.stdout.write('\n' + body + '\n');

  const stamp = snapshot.characters[Object.keys(snapshot.characters)[0]]?.asOf || 'unknown';
  const safe = stamp.replace(/[: ]/g, '-');
  fs.writeFileSync(path.join(OUT_DIR, `${label}.txt`), body + '\n', 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, `${label}.json`), JSON.stringify(snapshot, null, 2), 'utf8');
  process.stdout.write(`\nwrote captures/${label}.txt and captures/${label}.json  (log clock ${safe})\n`);

  // -- the diff, which is the point of the exercise ------------------------
  const beforePath = path.join(OUT_DIR, 'before.json');
  if (label === 'after' && fs.existsSync(beforePath)) {
    const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
    process.stdout.write(`\n${'='.repeat(72)}\n  WHAT CHANGED\n${'='.repeat(72)}\n`);
    let any = false;
    for (const ch of Object.keys(snapshot.characters)) {
      const b = before.characters[ch];
      const a = snapshot.characters[ch];
      if (!b) continue;
      const bm = new Map(b.cells.map((c) => [c.key, c.state]));
      const changed = a.cells.filter((c) => bm.get(c.key) !== c.state);
      const newKills = a.kills.filter((k) => !b.kills.some((x) => x.at === k.at && x.boss === k.boss));
      if (!changed.length && !newKills.length) continue;
      any = true;
      process.stdout.write(`\n  ${ch}:  ${b.openCount} open -> ${a.openCount} open` +
        `   ${b.completedCount} done -> ${a.completedCount} done\n`);
      for (const c of changed) {
        process.stdout.write(`     ${c.key.padEnd(22)} ${String(bm.get(c.key)).padEnd(11)} -> ${c.state}\n`);
        process.stdout.write(`        ${c.because}\n`);
      }
      for (const k of newKills) {
        process.stdout.write(`     NEW KILL  ${k.at}  ${k.boss}  ${k.shape}` +
          `${k.difficultyStated ? '/D' + k.difficulty : '/D? (tier not stated)'}  zone=${JSON.stringify(k.zone)}\n`);
      }
    }
    if (!any) process.stdout.write('\n  Nothing changed. Either the raid has not been logged yet, or the\n' +
      '  lines it wrote are not ones this module models — which is itself a finding.\n');
    process.stdout.write('\n');
  }
})();
