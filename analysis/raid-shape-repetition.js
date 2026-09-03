'use strict';

// WHAT THE OWNER'S SENTENCE IMPLIES FOR THE MODEL — the measurable half.
//
//   node analysis/raid-shape-repetition.js
//
// The owner, 3 Sep 2026, asked whether Plane of Hate's group and raid instances
// share a lockout:
//
//     "No, they are not shared. Each hate raid instance is unique and separate."
//
// The first sentence settles the group-vs-raid question. THE SECOND SENTENCE HAS
// TWO READINGS THAT IMPLY OPPOSITE MODELS:
//
//   (a) NO WEEKLY LOCK ON RAID CONTENT. "Unique and separate" in the ordinary
//       MMO sense — each entry spins up a fresh private copy. If so, raid
//       instances are not lockable units at all, the grid must not grow rows
//       for them, and it must say raid content is untracked.
//
//   (b) MANY SEPARATE LOCKS. Each raid instance is its own lockable unit, so
//       one row per raid zone is the wrong shape for raid content.
//
// I WROTE THIS SCRIPT BELIEVING THE CORPUS COULD DISCRIMINATE THEM, and my
// intended discriminator does not: counting distinct instances per (character,
// zone, week) cannot count instances at all. It counts TIERS, which the grid
// already models as separate cells and which say nothing about locks.
//
// ~~"The client never writes an instance identifier, so this is not answerable
// from logs by anyone, with any corpus, ever."~~ **I WROTE THAT HERE AND SAID IT
// TO THE DIRECTOR. IT IS FALSE.** REFUTED 3 Sep 2026, by grepping my own corpus
// for every line shape containing "instance" instead of reasoning from the
// shapes I had already modelled:
//
//     Player Avenrae creating instance The Plane of Sky 716.
//     Player Avenrae creating instance The Ruins of Old Paineel 4583.
//
// **63 such lines, 63 distinct N, none reused, range 13-20,807.** Not tiers —
// tiers are 0-4. It is a server-side instance serial, and `parseLine` returns
// null for it. The claim was never measured; I inferred it from the four zone
// shapes I had modelled, which is reasoning from my own configuration to a
// claim about the game.
//
// WHAT THE INSTRUMENT ACTUALLY SUPPORTS, measured:
//   - 63 of 63 creations are followed by a zone-in to the SAME zone, so an id
//     is attributable to a tier via the following entry line.
//   - It fires ONLY when your own character creates the instance — the player
//     field was the logging character in all 63. Entering someone else's
//     instance writes nothing. 63 creations against 256 instanced zone-ins.
//   - For Hate it does NOT settle the question today: exactly 2 creations, in
//     different weeks by different characters. But it means the question is
//     answerable from FUTURE logs rather than requiring an alt+Z reading.
//
// The script is kept because the question will be asked again, and now because
// it records how the universal was wrong. It also measures the one thing that
// IS established and load-bearing — roster-boss kills by instance shape.
//
// Reads the owner's raw logs read-only and writes nothing.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:/Users/Lindsey/Desktop/EQL Source/eql-source/state/logs',
  'C:/Users/Lindsey/Desktop/EQL Source',
  'C:/Users/Public/Daybreak Game Company/Installed Games/EverQuest Legends/Logs',
];

function logFiles() {
  const out = [];
  for (const d of DIRS) {
    let names = [];
    try { names = fs.readdirSync(d); } catch (e) { console.error('MISSING DIR ' + d); continue; }
    for (const n of names) if (/^eqlog_.*\.txt$/i.test(n)) out.push(path.join(d, n));
  }
  return out.sort();
}

// The weekly period is anchored on the reset WEEKDAY. The hour has never been
// measured, so a visit on the boundary day itself cannot be assigned to a
// period — it is counted separately rather than guessed into one.
const RESET_WEEKDAY = core.RESET_RULE.weekday;      // 2 = Tuesday
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function periodKey(at) {
  // `civilWeekday` takes the PARSED STAMP, not the civil integer. Passing the
  // integer returns NaN, which propagates into an Invalid Date and throws —
  // loudly, which is the only reason this is not a silently wrong bucketing.
  const wd = core.civilWeekday(at);
  if (typeof wd !== 'number' || Number.isNaN(wd)) throw new Error('bad weekday for ' + JSON.stringify(at));
  if (wd === RESET_WEEKDAY) return null;            // boundary day — unassignable
  const back = (wd - RESET_WEEKDAY + 7) % 7;
  const d = new Date(Date.UTC(at.year, at.month - 1, at.day));
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const files = logFiles();
  if (!files.length) { console.error('NO FILES — refusing to report zeros as a measurement'); process.exit(1); }
  console.log(files.length + ' log files\n');

  // (character, zone, period) -> Map(instance identity -> first stamp)
  const raid = new Map();
  const group = new Map();
  const boundaryDay = { raid: 0, group: 0 };
  const seen = new Set();

  const identity = (ev) =>
    ev.zone + (ev.group ? ' - Group' : '') + (ev.solo ? ' - Solo' : '') + ' D' + ev.difficulty;

  // The headline claim, measured HERE rather than quoted from another pass.
  const ROSTER = new Set();
  for (const r of core.RAIDS) for (const b of r.bosses) ROSTER.add(b);
  // `unknown` is kept apart from `open`: a kill before any zone-in line in the
  // file has no known location, and calling that 'open world' would invent one.
  const rosterKills = { group: 0, raid: 0, open: 0, solo: 0, unknown: 0 };
  const killSeen = new Set();

  for (const f of files) {
    const ch = core.characterFromLogFilename(path.basename(f)) || '?';
    let cur = null;
    const rl = readline.createInterface({ input: fs.createReadStream(f, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      const ev = core.parseLine(line);
      if (!ev) continue;
      if (ev.kind === 'entered') cur = ev;                 // `not-a-zone` leaves it alone
      if (ev.kind === 'kill' && ROSTER.has(ev.slain)) {
        const a = ev.at;
        const k = ch + '|' + a.year + a.month + a.day + a.hour + a.minute + a.second + '|' + ev.slain;
        if (!killSeen.has(k)) {
          killSeen.add(k);
          const where = !cur ? 'unknown'
            : !cur.instanced ? 'open'
            : cur.solo ? 'solo' : cur.group ? 'group' : 'raid';
          rosterKills[where]++;
        }
      }
      if (ev.kind !== 'entered' || !ev.instanced) continue;
      const at = ev.at;
      const stamp = `${at.year}-${String(at.month).padStart(2, '0')}-${String(at.day).padStart(2, '0')} ` +
                    `${String(at.hour).padStart(2, '0')}:${String(at.minute).padStart(2, '0')}:${String(at.second).padStart(2, '0')}`;
      const dedupe = ch + '|' + stamp + '|' + identity(ev);
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);

      const p = periodKey(at);
      const bucket = ev.group ? group : raid;
      if (p === null) { ev.group ? boundaryDay.group++ : boundaryDay.raid++; continue; }
      const key = ch + ' | ' + ev.zone + ' | week of ' + p;
      if (!bucket.has(key)) bucket.set(key, new Map());
      const m = bucket.get(key);
      const id = identity(ev);
      // Set of DAYS this exact unit was entered on — the same unit re-entered
      // on one day is one visit as far as a lock is concerned.
      if (!m.has(id)) m.set(id, new Set());
      m.get(id).add(stamp.slice(0, 10));
    }
  }

  function report(name, bucket) {
    const rows = [...bucket].filter(([, m]) => m.size > 0).sort();
    const multi = rows.filter(([, m]) => m.size > 1);
    console.log('=== ' + name + ' ===');
    console.log('  (character, zone, week) buckets with at least one entry: ' + rows.length);
    console.log('  buckets covering more than one TIER in a week:           ' + multi.length +
                '   <- NOT a lockout fact: the grid already models each tier as its own cell');
    console.log();
    return { rows: rows.length, multi: multi.length };
  }

  const r = report('RAID-SHAPE instances (Zone N)', raid);
  const g = report('GROUP-SHAPE instances (Zone - Group N)', group);
  console.log('entries on the reset weekday itself, unassignable to a period: ' +
              boundaryDay.raid + ' raid, ' + boundaryDay.group + ' group');

  // THE ONLY OBSERVABLE THAT BEARS ON "unique and separate": the same
  // (zone, tier) raid unit entered on two DIFFERENT DAYS inside one period.
  console.log('=== SAME raid unit (zone + tier), re-entered on a different day in one period ===');
  let repeats = 0;
  for (const [k, m] of [...raid].sort()) {
    for (const [id, days] of m) {
      if (days.size > 1) {
        repeats++;
        console.log('  ' + k + '  ' + id + '  on ' + days.size + ' days: ' + [...days].sort().join(', '));
      }
    }
  }
  if (!repeats) console.log('  none');

  console.log('\n=== WHAT THIS CAN AND CANNOT SETTLE ===');
  console.log('THE ZONE-IN LINE cannot: it carries zone, shape and tier and nothing else, so');
  console.log('  two entries into "The Plane of Hate 4 (Refined)" are identical whether they');
  console.log('  are one instance re-entered or two fresh ones.');
  console.log();
  console.log('BUT ANOTHER LINE CAN, and I claimed otherwise before I looked:');
  console.log('  "Player <You> creating instance <Zone> <N>." carries a server-side instance');
  console.log('  serial — 63 lines, 63 distinct N, never reused, 13 to 20,807. parseLine');
  console.log('  returns null for it today. It fires only when YOUR character creates the');
  console.log('  instance, so it sees 63 of 256 instanced zone-ins, and it states no tier');
  console.log('  (the following zone-in does, and pairs 63 of 63).');
  console.log('  For Hate it does not settle the question yet — 2 creations, different weeks,');
  console.log('  different characters — but it makes the question answerable from FUTURE');
  console.log('  logs rather than requiring an alt+Z reading.');
  console.log();
  console.log('DOES establish, and it is the load-bearing one. Roster-boss kills by shape:');
  console.log('    group instance : ' + rosterKills.group);
  console.log('    RAID instance  : ' + rosterKills.raid);
  console.log('    open world     : ' + rosterKills.open);
  console.log('    solo instance  : ' + rosterKills.solo);
  console.log('    no zone-in yet : ' + rosterKills.unknown + '   (location UNKNOWN, not open world)');
  console.log('  ' + rosterKills.raid + ' roster kills in the raid shape, across ' + r.rows +
              ' (character, zone, week) raid-shape');
  console.log('  buckets. We have NO completion data for raid content at all, so the grid');
  console.log('  cannot describe it — and with the owner\'s answer it must not be read as');
  console.log('  describing it.');
  console.log();
  console.log('The same-unit repeats above are NOT evidence either way: LOCKOUT_MODEL is a');
  console.log('6-day ROLLING replay timer, so re-entering one instance across several days is');
  console.log('exactly what the recorded model already predicts.');
})();
