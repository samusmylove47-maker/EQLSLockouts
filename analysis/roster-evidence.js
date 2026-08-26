'use strict';

// Proves every roster key is a string the game actually writes, and records the
// near-misses that make a substring match dangerous.
//
//   node analysis/roster-evidence.js
//
// Writes sources/raw/roster-evidence.json, which is COMMITTED and which
// test/lockout.test.js asserts against. The point: a roster typo and a
// genuinely uncompleted raid render identically, so a typo must fail the build
// rather than show an empty row forever.
//
// The raw logs are gitignored, so this artifact is how a cloud reader — or a
// test running anywhere — checks the roster against real client output.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:\\Users\\Lindsey\\Desktop\\EQL Source\\eql-source\\state\\logs',
  'C:\\Users\\Lindsey\\Desktop\\EQL Source',
  // The LIVE log. The archives end 18 Aug; the bosses the alt+Z window named on
  // 25 Aug — Terror, Dread, Fright, Maestro of Rancor — appear only here.
  'C:\\Users\\Public\\Daybreak Game Company\\Installed Games\\EverQuest Legends\\Logs',
];
const OUT = path.join(__dirname, '..', 'sources', 'raw', 'roster-evidence.json');

function logFiles() {
  const out = [];
  for (const dir of DIRS) {
    for (const n of fs.readdirSync(dir)) if (/^eqlog_.*\.txt$/i.test(n)) out.push(path.join(dir, n));
  }
  return out.sort();
}

(async () => {
  // Every distinct slain name, with how many times each shape produced it.
  // De-duplicated on (character, timestamp, name) so the overlapping log files
  // do not treble the counts.
  const seen = new Map();      // name -> {thirdPerson, firstPerson}
  const dedupe = new Set();

  for (const full of logFiles()) {
    const ch = core.characterFromLogFilename(full);
    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const ev = core.parseLine(line);
      if (!ev || ev.kind !== 'kill') continue;
      const k = `${ch}|${core.civilOf(ev.at)}|${ev.slain}|${ev.byYou}`;
      if (dedupe.has(k)) continue;
      dedupe.add(k);
      const rec = seen.get(ev.slain) || { thirdPerson: 0, firstPerson: 0 };
      if (ev.byYou) rec.firstPerson++; else rec.thirdPerson++;
      seen.set(ev.slain, rec);
    }
  }

  // One entry per BOSS, flattened out of the raid list, because the evidence
  // question is per name: does the game ever write this exact string?
  const roster = [].concat(...core.RAIDS.map(
    (r) => r.bosses.map((b) => ({ key: b, label: b, raid: r.key }))
  )).map((r) => {
    const rec = seen.get(r.key) || { thirdPerson: 0, firstPerson: 0 };
    // Names that CONTAIN the roster key but are not it. These are why the match
    // must be exact equality: a substring roster would score all of them.
    const nearMisses = [...seen.entries()]
      .filter(([name]) => name !== r.key && name.includes(r.key.split(',')[0].split('-')[0].trim()))
      .map(([name, c]) => ({ name, thirdPerson: c.thirdPerson, firstPerson: c.firstPerson }))
      .sort((a, b) => (b.thirdPerson + b.firstPerson) - (a.thirdPerson + a.firstPerson));
    return {
      key: r.key,
      label: r.label,
      exactKills: rec.thirdPerson + rec.firstPerson,
      thirdPerson: rec.thirdPerson,
      firstPerson: rec.firstPerson,
      nearMisses,
      nearMissKills: nearMisses.reduce((n, m) => n + m.thirdPerson + m.firstPerson, 0),
    };
  });

  // EVERY named mob killed, not only the roster. The alt+Z window shows the
  // roster is DISCOVERABLE — a tracker that learns its bosses from observed
  // data beats one that ships a list and goes stale on the next patch. This is
  // the raw material for that, and it is what the name-mapping test asserts
  // against, so a mapping can never point at a string the game never writes.
  //
  // THE ARTICLE HEURISTIC IS A FLAG, NOT A FILTER, AND THAT MATTERS.
  //
  // "A leading article means trash" is tempting — `A fire giant warrior has
  // been slain` against `Lord Nagafen has been slain` — and it is WRONG. Two
  // real raid bosses in this game are written with one: **`a dracoliche`** and
  // **`the Hand of Veeshan`**, both listed as bosses in raids-measured.json.
  // Filtering on it dropped `a dracoliche` out of this file entirely, which
  // then made the alt+Z window's "Dracoliche" row unmappable — the exact
  // missing-lockout failure the mapping is supposed to prevent.
  //
  // So every distinct slain name is kept, and `looksNamed` records what the
  // heuristic would have said. Pets keep the boss's name as a prefix —
  // `Terror pet` — and are flagged too, because that is a live substring hazard.
  const named = [...seen.entries()]
    .map(([name, c]) => ({
      name,
      kills: c.thirdPerson + c.firstPerson,
      isPet: / pet$/.test(name),
      looksNamed: !/^(a |an |A |An |The |the )/.test(name),
    }))
    .sort((a, b) => b.kills - a.kills);

  fs.writeFileSync(OUT, JSON.stringify({
    generatedBy: 'analysis/roster-evidence.js',
    namedMobs: named,
    note:
      'Every roster key must have exactBoss > 0 or the roster is wrong. ' +
      'nearMisses are names containing the key that are NOT the boss — the ' +
      'reason the match is exact equality and never substring.',
    distinctSlainNames: seen.size,
    roster,
  }, null, 2), 'utf8');

  process.stdout.write(`wrote ${OUT}\n`);
  process.stdout.write(`distinct slain names in corpus: ${seen.size}\n\n`);
  for (const r of roster) {
    process.stdout.write(
      `  ${r.label.padEnd(13)} key=${JSON.stringify(r.key).padEnd(32)} ` +
      `kills=${String(r.exactKills).padStart(3)} (3rd ${r.thirdPerson}, 1st ${r.firstPerson})` +
      (r.nearMissKills ? `   NEAR-MISSES: ${r.nearMissKills} kills across ${r.nearMisses.length} other names` : '') +
      '\n'
    );
    for (const m of r.nearMisses) {
      process.stdout.write(`        ${String(m.thirdPerson + m.firstPerson).padStart(4)}  ${m.name}\n`);
    }
  }
})();
