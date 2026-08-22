'use strict';

// Runs the parsing core over the owner's whole log corpus and writes
// analysis/findings.json.
//
// DERIVE, NEVER TYPE. Every figure quoted in HANDOFF.md is read out of this
// file's output. Nothing is typed beside the data it claims to come from.
//
//   node analysis/derive.js
//
// This is also the acceptance test the deliverable actually has to pass: does
// the module survive 440 MB of real, messy, two-character, interleaved log?

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore');

const DIRS = [
  'C:\\Users\\Lindsey\\Desktop\\EQL Source\\eql-source\\state\\logs',
  'C:\\Users\\Lindsey\\Desktop\\EQL Source',
];
const OUT = path.join(__dirname, 'findings.json');
const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };

function logFiles() {
  const out = [];
  for (const dir of DIRS) {
    for (const name of fs.readdirSync(dir)) {
      if (/^eqlog_.*\.txt$/i.test(name)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isFile()) out.push(full);
      }
    }
  }
  return out.sort();
}

(async () => {
  const files = logFiles();

  // ONE STATE PER CHARACTER. Merging Avenrae's and Shara's task history
  // fabricates reset brackets seconds wide — see the note on createState.
  const states = new Map();
  const stateFor = (file) => {
    const ch = core.characterFromLogFilename(file);
    if (!ch) throw new Error(`cannot determine character from ${file}`);
    if (!states.has(ch)) states.set(ch, core.createState(ch));
    return states.get(ch);
  };

  const perFile = [];
  let totalLines = 0;
  let totalBytes = 0;

  for (const full of files) {
    const size = fs.statSync(full).size;
    totalBytes += size;
    let lines = 0;
    const state = stateFor(full);
    const before = state.events.length;
    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      lines++;
      core.applyLine(state, line);
    }
    totalLines += lines;
    perFile.push({
      file: path.basename(full),
      character: core.characterFromLogFilename(full),
      dir: path.dirname(full),
      bytes: size,
      lines,
      eventsAdded: state.events.length - before,
    });
    process.stderr.write(`  ${path.basename(full)}  ${lines} lines\n`);
  }

  const views = [...states.entries()].map(([ch, st]) => [ch, st, core.project(st, NOW)]);

  const characters = views.map(([ch, st, view]) => {
    // Narrowest first — the narrowest bracket is the only one that constrains
    // anything, and reporting it first stops a wide one being read as precise.
    const brackets = (view.reset.brackets || [])
      .slice()
      .sort((a, b) => a.widthHours - b.widthHours)
      .map((b) => ({
        boss: b.boss,
        cadence: b.cadence,
        afterObserved: b.after,
        beforeObserved: b.before,
        widthHours: Number(b.widthHours.toFixed(3)),
        afterWeekday: b.afterWeekday,
        beforeWeekday: b.beforeWeekday,
      }));

    return {
      character: ch,
      coverage: view.coverage,
      dropped: st.dropped,
      tasks: Object.values(st.tasks).map((t) => ({
        task: t.task,
        boss: t.boss,
        cadence: t.cadence,
        assignments: t.assignments.map((a) => core.formatCivil(a.at)),
        completions: t.completions.map((c) => core.formatCivil(c.at)),
      })),
      // NAMED itemsGiven*, NOT grants*. The Director read `grantsTotal: 24`
      // beside `requestsGranted: 6` and could not reconcile them, which is a
      // fair reading of the old names. They count different things:
      //   itemsGivenTotal  — EVERY "You have been given: <item>" line, any item
      //   requestsGranted  — only cadence-labelled WEEKLY TASK grants
      // Shara's 24 is 6 Void-Touched Potential + 9 Hamed's Ring of Tears +
      // 9 Talisman of Kejaar Kerrath, the last two from the non-cadence
      // repeatable tasks she ran on 13 Aug. Avenrae did not run those, so hers
      // is 6 and the two numbers coincide — which is what made the pair look
      // like a contradiction rather than two different measurements.
      itemsGivenTotal: view.grants.total,
      itemsGivenByItem: view.grants.items.reduce((acc, g) => {
        acc[g.item] = (acc[g.item] || 0) + 1;
        return acc;
      }, {}),
      voidTokenGrants: view.grants.items
        .filter((g) => g.item === 'Void-Touched Potential')
        .map((g) => g.at),
      requestsGranted: view.requests.filter((r) => r.result === 'granted').length,
      requestsRefused: view.requests.filter((r) => r.result === 'refused').length,
      requestsUnknown: view.requests.filter((r) => r.result === 'unknown').length,
      period: view.period,
      resetProvenance: view.reset.provenance,
      resetBrackets: brackets,
      resetIntersects: view.reset.intersects === true,
      resetIntersectionHours:
        view.reset.intersectionHours == null ? null : Number(view.reset.intersectionHours.toFixed(3)),
      instances: Object.values(st.instances)
        .sort((a, b) => b.seen - a.seen)
        .map((i) => ({
          zone: i.zone,
          kind: i.group ? 'group' : 'raid',
          difficulty: i.difficulty,
          label: i.difficultyLabel,
          seen: i.seen,
        })),
    };
  });

  const findings = {
    generatedBy: 'analysis/derive.js',
    generatedFor: '2026-08-21',
    note:
      'Every figure quoted in HANDOFF.md is read out of this file. State is ' +
      'kept per character: merging two grouped characters fabricates reset ' +
      'brackets seconds wide.',
    corpus: { files: files.length, bytes: totalBytes, lines: totalLines, perFile },
    difficultyTable: core.DIFFICULTY_LABELS.map((label, i) => ({ index: i, label })),
    characters,
  };

  fs.writeFileSync(OUT, JSON.stringify(findings, null, 2), 'utf8');

  process.stdout.write(`\nwrote ${OUT}\n`);
  process.stdout.write(`corpus: ${files.length} files, ${totalBytes.toLocaleString()} bytes, ${totalLines.toLocaleString()} lines\n`);
  for (const c of characters) {
    process.stdout.write(`\n=== ${c.character} ===\n`);
    process.stdout.write(`  coverage ${c.coverage.from} .. ${c.coverage.to}\n`);
    process.stdout.write(`  dropped ${c.dropped.duplicate} duplicate, ${c.dropped.unstamped} unstamped\n`);
    const weekly = c.tasks.filter((t) => t.cadence);
    process.stdout.write(`  tasks ${c.tasks.length} (${weekly.length} cadence-labelled)  Void tokens ${c.voidTokenGrants.length}  instances ${c.instances.length}\n`);
    process.stdout.write(`  reset: ${c.resetProvenance}\n`);
    for (const b of c.resetBrackets) {
      process.stdout.write(`    ${String(b.boss).padEnd(14)} after ${b.afterObserved}  before ${b.beforeObserved}   ${b.widthHours} h\n`);
    }
    if (c.resetBrackets.length) {
      process.stdout.write(`    intersects: ${c.resetIntersects}  intersection: ${c.resetIntersectionHours} h\n`);
    }
  }
})();
