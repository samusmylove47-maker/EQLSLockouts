'use strict';

// SUPERSEDED BY analysis/hails.js — kept because its measurement is still
// sound and it is how the real mechanism was found.
//
// Its premise is WRONG: it assumes entering a group instance grants the weekly
// task. It does not. The task is granted at the Voidling in the STATIC zone, on
// saying 'danger', 11-25 seconds BEFORE the instance is entered. This script
// measured that offset as a negative number and that anomaly is what led to the
// hail exchange. The correlation it reports is real; the causal direction in the
// title is not. Use hails.js for the lockout state.
//
// Does entering a weekly boss's GROUP instance always grant the weekly task?
//
// Every one of the six observed grants followed a `- Group` entry, and no
// grant followed a raid-version entry. If group entry ALWAYS granted the task,
// then an entry with no grant is the lockout signal — an observable negative,
// which is the thing this whole project has been looking for.
//
// This script tests that by pairing every group-instance entry into a weekly
// boss's zone against whether a task grant landed within a window of it.
//
//   node analysis/group-entries.js
//
// It is a MEASUREMENT, not a claim. The output states what was seen; the
// interpretation is in HANDOFF.md and is hedged there.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:\\Users\\Lindsey\\Desktop\\EQL Source\\eql-source\\state\\logs',
  'C:\\Users\\Lindsey\\Desktop\\EQL Source',
];

// Zone -> weekly boss, derived from the six observed grants rather than from a
// wiki. Each pairing is a measurement: the task named that boss and the entry
// was into that zone, within seconds.
const ZONE_BOSS = {
  "Nagafen's Lair": 'Lord Nagafen',
  'The Permafrost Caverns': 'Lady Vox',
  'The Ruins of Old Paineel': 'Master Yael',
};

// How close a grant must be to an entry to count as caused by it. The six
// observed pairs land between -26s and +45s; 180s is generous and the script
// reports the actual offsets so the choice can be checked rather than trusted.
const WINDOW_S = 180;

function logFiles() {
  const out = [];
  for (const dir of DIRS) {
    for (const name of fs.readdirSync(dir)) {
      if (/^eqlog_.*\.txt$/i.test(name)) out.push(path.join(dir, name));
    }
  }
  return out.sort();
}

(async () => {
  const byChar = new Map();

  for (const full of logFiles()) {
    const ch = core.characterFromLogFilename(full);
    if (!byChar.has(ch)) byChar.set(ch, { entries: [], grants: [] });
    const bucket = byChar.get(ch);

    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const ev = core.parseLine(line);
      if (!ev) continue;
      const civil = core.civilOf(ev.at);
      if (ev.kind === 'entered' && ev.instanced && ZONE_BOSS[ev.zone]) {
        bucket.entries.push({ civil, zone: ev.zone, group: ev.group, difficulty: ev.difficulty, at: core.formatCivil(ev.at) });
      }
      if (ev.kind === 'task-assigned' && ev.cadence) {
        bucket.grants.push({ civil, boss: ev.boss, at: core.formatCivil(ev.at) });
      }
    }
  }

  for (const [ch, b] of byChar) {
    // Dedupe entries: the same zone-in appears in overlapping log files.
    const seen = new Set();
    const entries = b.entries.filter((e) => {
      const k = `${e.civil}|${e.zone}|${e.group}|${e.difficulty}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).sort((a, x) => a.civil - x.civil);

    const gseen = new Set();
    const grants = b.grants.filter((g) => {
      const k = `${g.civil}|${g.boss}`;
      if (gseen.has(k)) return false;
      gseen.add(k);
      return true;
    });

    process.stdout.write(`\n================ ${ch} ================\n`);
    process.stdout.write(`entries into a weekly boss's zone (instanced): ${entries.length}   cadence-task grants: ${grants.length}\n\n`);

    let groupWith = 0, groupWithout = 0, raidWith = 0, raidWithout = 0;
    const offsets = [];

    for (const e of entries) {
      const boss = ZONE_BOSS[e.zone];
      const hit = grants.find(
        (g) => g.boss === boss && Math.abs(g.civil - e.civil) <= WINDOW_S * 1000
      );
      if (hit) offsets.push((hit.civil - e.civil) / 1000);
      if (e.group) { hit ? groupWith++ : groupWithout++; }
      else { hit ? raidWith++ : raidWithout++; }

      const d = e.difficulty === null ? '-' : `D${e.difficulty}`;
      process.stdout.write(
        `  ${e.at}  ${(e.group ? 'GROUP' : 'raid ')} ${d.padEnd(3)} ${e.zone.padEnd(26)} ` +
        `${hit ? `TASK +${((hit.civil - e.civil) / 1000).toFixed(0)}s` : 'no task'}\n`
      );
    }

    process.stdout.write(`\n  GROUP entries: ${groupWith} granted a task, ${groupWithout} did not\n`);
    process.stdout.write(`  raid  entries: ${raidWith} granted a task, ${raidWithout} did not\n`);
    if (offsets.length) {
      process.stdout.write(`  grant offset from entry: min ${Math.min(...offsets)}s  max ${Math.max(...offsets)}s\n`);
    }
    const orphan = grants.filter(
      (g) => !entries.some((e) => ZONE_BOSS[e.zone] === g.boss && Math.abs(g.civil - e.civil) <= WINDOW_S * 1000)
    );
    process.stdout.write(`  grants with no matching zone entry in window: ${orphan.length}` +
      (orphan.length ? ` -> ${orphan.map((g) => `${g.at} ${g.boss}`).join(', ')}` : '') + '\n');
  }
})();
