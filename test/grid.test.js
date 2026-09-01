'use strict';

// The roster and the 25-cell grid.
//
//   node --test test/
//
// Every log line asserted on is either verbatim from the owner's logs or built
// from the line shapes measured there. sources/raw/roster-evidence.json is
// derived from the real 434 MB corpus by analysis/roster-evidence.js.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../src/lockoutCore');

const fixtureLines = fs
  .readFileSync(path.join(__dirname, '..', 'sources', 'raw', '2026-08-10-weekly-task-fixture.log'), 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'));

const ROSTER_EVIDENCE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'sources', 'raw', 'roster-evidence.json'), 'utf8')
);

// A constructed state needs realistic COVERAGE, not just the interesting lines.
// The grid treats a hole longer than a raid as "not looked", so a fixture made
// of three lines days apart is — correctly — mostly unobserved. `heartbeat`
// fills a range with ordinary stamped lines, the way a running client does.
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// THIS HELPER WAS ITSELF THE DEFECT, and every grid test below rested on it.
//
// It used to emit FOUR ISOLATED LINES A DAY, at 01:00, 07:00, 13:00 and 19:00.
// Four instants observe essentially nothing — the spans between them are zero
// length — so the coverage those tests asserted `open` against was 0.0% of the
// period. The module accepted it because the old gate only asked whether any
// single gap exceeded 24 hours, and 6-hour gaps do not.
//
// So the suite was green on exactly the input an adversarial pass later used to
// make the module report "25 raids still open" on seven lines of log. The tests
// were not merely failing to catch the bug; they were built on it.
//
// A running client writes continuously. This now emits a CONTIGUOUS BLOCK per
// day — four hours of lines two minutes apart, which is an ordinary evening and
// measures ~16% of a week, against the 12–48% real periods measure in our own
// corpus.
function heartbeat(fromDay, toDay, month = 8, year = 2026) {
  const out = [];
  const p = (n) => String(n).padStart(2, '0');
  for (let d = fromDay; d <= toDay; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d, 18, 0, 0));
    for (let m = 0; m < 240; m += 2) {
      const x = new Date(dt.getTime() + m * 60000);
      out.push(`[${DAYS[x.getUTCDay()]} ${MONTHS[month - 1]} ${p(x.getUTCDate())} ` +
               `${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:00 ${year}] You have entered Nektulos Forest.`);
    }
  }
  return out;
}

// A Friday. The most recent Tuesday before it is 18 Aug.
const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

test('RAIDS: every boss name is a string the game actually writes', () => {
  // THE FAILURE THIS PREVENTS: an unmatched roster row and a genuinely
  // uncompleted raid render identically. A typo would show an empty row forever
  // and look exactly like the warning this tool exists to give. The evidence
  // file is derived from the real corpus, so a typo fails the build instead.
  assert.equal(core.RAIDS.length, 5, 'five raids, still 25 cells');
  for (const raid of core.RAIDS) {
    assert.ok(raid.bosses.length >= 1, `${raid.label} must name what it contains`);
    for (const boss of raid.bosses) {
      const found = ROSTER_EVIDENCE.roster.find((r) => r.key === boss);
      assert.ok(found, `boss ${JSON.stringify(boss)} is absent from the evidence file`);
      assert.ok(found.exactKills > 0,
        `boss ${JSON.stringify(boss)} matched 0 kills in real data — it is a typo`);
    }
  }
});

test('RAIDS: the name traps are the game strings, not the window wording', () => {
  const keys = [].concat(...core.RAIDS.map((r) => r.bosses));
  assert.ok(keys.includes('Innoruuk, the Prince of Hate'), 'not bare "Innoruuk"');
  assert.ok(keys.includes('Cazic-Thule'), 'hyphenated; "Cazic Thule" returns 0 kills');
  // The alt+Z window writes "Dracoliche"; the game writes "a dracoliche".
  assert.ok(keys.includes('a dracoliche'), 'the kill-line spelling, not the window spelling');
  assert.ok(!keys.includes('Dracoliche'));
});

test('RAIDS: the match is exact equality, never substring', () => {
  // Measured: names containing "Innoruuk" that are NOT the boss account for
  // 141 kills against the boss's 9. A substring roster over-counts ~15x.
  const inno = ROSTER_EVIDENCE.roster.find((r) => r.key === 'Innoruuk, the Prince of Hate');
  assert.ok(inno.nearMissKills > inno.exactKills * 5,
    'the near-miss hazard should be large; if it stops being, re-read the data');

  const st = core.createState('Avenrae');
  core.applyLines(st, [
    '[Wed Aug 12 20:41:32 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!',
    '[Wed Aug 12 20:42:00 2026] Cleric of Innoruuk has been slain by Jrhx!',
    '[Wed Aug 12 20:43:00 2026] You have slain ' + 'Innoruuk`s Chosen!',
  ]);
  assert.equal(st.kills.length, 1, 'only the boss counts');
  assert.equal(st.kills[0].boss, 'Innoruuk, the Prince of Hate');
});

test('the first-person kill line is parsed — a "has been slain by" grep misses it', () => {
  const ev = core.parseLine('[Sun Aug 09 15:42:16 2026] You have slain Cazic-Thule!');
  assert.equal(ev.kind, 'kill');
  assert.equal(ev.slain, 'Cazic-Thule');
  assert.equal(ev.byYou, true);
  // Measured: 8 of the five bosses' kills take this form across the corpus.
  const firstPerson = ROSTER_EVIDENCE.roster.reduce((n, r) => n + r.firstPerson, 0);
  assert.ok(firstPerson > 0, 'the corpus contains first-person boss kills');
});

test('parseLine stays open to any name — the roster narrows, the parser does not', () => {
  const ev = core.parseLine('[Wed Aug 12 20:42:00 2026] Some Boss Nobody Has Heard Of has been slain by X!');
  assert.equal(ev.kind, 'kill');
  assert.equal(ev.slain, 'Some Boss Nobody Has Heard Of');
});

// ---------------------------------------------------------------------------
// The reset rule
// ---------------------------------------------------------------------------

test('RESET RULE: the only permitted constant, wearing its provenance', () => {
  assert.equal(core.RESET_RULE.weekday, 2);
  assert.equal(core.RESET_RULE.weekdayName, 'Tuesday');
  assert.equal(core.RESET_RULE.hour, null, 'the owner gave a day, not an hour — do not invent one');
  assert.equal(core.RESET_RULE.provenance, 'stated', 'NOT measured; we did not observe this');
  assert.match(core.RESET_RULE.source, /owner/);
  assert.equal(core.RESET_RULE.measuredBracketContainsRule, true);
});

test('NO RESET CONSTANT ANYWHERE EXCEPT RESET_RULE', () => {
  // Amended from the original blanket ban, on the Director's order: the rule
  // may live in exactly one place. Everywhere else it stays forbidden.
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);

  const reset = core.projectReset(state);
  assert.ok(!('weekday' in reset), 'projectReset must not emit a weekday');
  assert.equal(reset.value, null, 'projectReset never resolves to an instant');

  const view = core.project(state, NOW);
  assert.ok(!/resetWeekday|resetHour|LOCKOUT_RESET/.test(JSON.stringify(view)),
    'the per-boss view carries no reset constant');

  const grid = core.projectGrid(state, NOW);
  const withoutRule = JSON.stringify({ ...grid, resetRule: null });
  assert.ok(!/"weekday"/.test(withoutRule), 'a weekday may appear only inside resetRule');
});

test('projectReset still runs, as corroboration', () => {
  // It costs nothing and it is the tripwire: if it ever brackets a rollover the
  // Tuesday rule did not predict, a patch has moved the reset.
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const reset = core.projectReset(state);
  assert.equal(reset.provenance, 'inferred');
  assert.ok(reset.brackets.length > 0);
});

// ---------------------------------------------------------------------------
// The grid
// ---------------------------------------------------------------------------

test('GRID: 25 cells, five bosses by five tiers, each in exactly one bucket', () => {
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const grid = core.projectGrid(state, NOW);
  assert.equal(grid.cells.length, 25);
  assert.equal(new Set(grid.cells.map((c) => c.raid)).size, 5);
  assert.equal(new Set(grid.cells.map((c) => c.difficulty)).size, 5);
  assert.equal(
    grid.openCount + grid.uncertainCount + grid.notLookedCount + grid.completedCount, 25);
});

test('GRID: a fresh state is 25 not_looked and NEVER 25 available', () => {
  // The comfortable lie this tool must not tell.
  const grid = core.projectGrid(core.createState('Avenrae'), NOW);
  assert.equal(grid.notLookedCount, 25);
  assert.equal(grid.openCount, 0, 'not_looked must never render as available');
  assert.equal(grid.completedCount, 0);
});

test('GRID: a kill at a stated difficulty completes exactly that cell', () => {
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    // Coverage must start on or before the boundary Tuesday (18 Aug) and run to `now`.
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 3 (Fused).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!',

  ]);
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Plane of Hate');
  assert.equal(row.find((c) => c.difficulty === 3).state, 'completed');
  for (const d of [0, 1, 2, 4]) {
    assert.equal(row.find((c) => c.difficulty === d).state, 'open',
      `D${d} must stay open — completing one tier does not complete the row`);
  }
});

test('GRID: a bare "- Group" kill completes the D0 cell and ONLY the D0 cell', () => {
  // THIS TEST USED TO ASSERT THE OPPOSITE and the opposite was wrong. It read
  // "a bare - Group kill lands in unknown, NEVER in the D0 cell", on the
  // reasoning that raids-measured.json infers a zero for eight such fights and
  // is wrong to. The inference was right and the refusal was wrong: the client
  // omits the index exactly when it is zero (12 bare entries, 12 `Group 0
  // (Normal)` invites, zero entry lines stating 0, across all 16 files).
  //
  // The cost of the refusal was the whole tool. Every Normal-tier kill blanked
  // its entire row to `unknown`, and the owner got "0 of 25 done · 15 uncertain"
  // after a week of raiding.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Fear - Group.',
    '[Wed Aug 19 20:30:00 2026] You have slain Cazic-Thule!',

  ]);
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Plane of Fear');
  const d0 = row.find((c) => c.difficulty === 0);
  assert.equal(d0.state, 'completed', 'the omitted index is Normal');
  assert.equal(d0.tierFromOmission, true, 'and the cell must say the tier came from the omission rule');
  assert.match(d0.because, /Cazic-Thule at D0/);

  // AND NOTHING ELSE MOVES. The old row-wide blanking is the second half of the
  // defect: one kill must not touch four cells it says nothing about.
  for (const c of row.filter((c) => c.difficulty !== 0)) {
    assert.equal(c.state, 'open', `D${c.difficulty} must stay open — one kill resolves one cell`);
  }
});

test('GRID: an open-world kill resolves no cell', () => {
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:30:00 2026] Lady Vox has been slain by X!',

  ]);
  assert.equal(st.kills[0].instanced, false, 'a bare zone name is the open world');
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Lady Vox');
  for (const c of row) assert.equal(c.state, 'open');
});

test('GRID: a kill on the boundary day is CONDITIONAL, never completed — and it names the pivot', () => {
  // The reset HOUR has never been measured, so a Tuesday kill could fall either
  // side of the turnover. Calling it completed would hide a raid the user can
  // still do — the dangerous direction for a tool that exists to prevent that.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Tue Aug 18 12:00:00 2026] You have entered The Permafrost Caverns - Group 2 (Adaptive).',
    '[Tue Aug 18 12:30:00 2026] Lady Vox has been slain by X!',

  ]);
  const grid = core.projectGrid(st, NOW);
  const cell = grid.cells.find((c) => c.label === 'Lady Vox' && c.difficulty === 2);
  assert.equal(cell.state, 'conditional', 'never `completed` — that would hide a raid the user can still do');
  assert.notEqual(cell.state, 'completed');

  // AND IT MUST SAY WHICH WAY IT FALLS. A bare `unknown` here is what the owner
  // ran and learned nothing from. The cell knows the exact instant that decides
  // it; withholding that is a refusal to help, not a refusal to guess.
  assert.equal(cell.decidedBy.pivot, '2026-08-18 12:30:00', 'the deciding instant, named');
  assert.match(cell.decidedBy.doneIf, /at or before 2026-08-18 12:30:00/);
  assert.match(cell.decidedBy.openIf, /after 2026-08-18 12:30:00/);
  assert.match(cell.because, /completed if .*at or before 2026-08-18 12:30:00.*still open if/);
  assert.match(cell.because, /reset HOUR has never been measured/);

  // ONE AMBIGUOUS KILL MUST NOT BLANK FOUR INNOCENT CELLS.
  for (const c of grid.cells.filter((c) => c.label === 'Lady Vox' && c.difficulty !== 2)) {
    assert.equal(c.state, 'open', `D${c.difficulty} has no kill under either hypothesis and is plainly open`);
  }
});

test('GRID: an invite never sets the current instance — only a zone-in does', () => {
  // An invite is someone else's offer and may be declined. Treating it as
  // presence would attribute a later kill to an instance never entered.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    "[Wed Aug 19 20:00:00 2026] Lumbarin has asked you to join the instance: The Plane of Hate - Group 4 (Refined).        Would you like to join? Accepting will incur you a charge or replay timer.",
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!',

  ]);
  assert.equal(st.kills[0].instanced, false, 'a declined-or-unentered invite grants no difficulty');
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Plane of Hate');
  assert.equal(row.filter((c) => c.state === 'completed').length, 0);
});

test('GRID: the instance SHAPE is recorded on a completion', () => {
  // Whether a kill in `- Group N` and one in `Zone N` share a lock is unmeasured.
  // The grid keeps the owner's 25 cells and carries the shape so the question
  // stays answerable rather than being silently decided.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate 4 (Refined).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!',

  ]);
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Plane of Hate' && c.difficulty === 4);
  assert.equal(cell.state, 'completed');
  assert.deepEqual(cell.shapes, ['raid'], 'bare Zone N is the raid instance');
});

test('GRID: no countdown is ever emitted', () => {
  // The owner asked for none, and the module could not honestly produce one:
  // the reset hour is not recorded. `available` is a state, never a time.
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const json = JSON.stringify(core.projectGrid(state, NOW));
  for (const banned of ['secondsRemaining', 'msRemaining', 'timeLeft', 'countdown', 'expiresAt', 'resetsAt']) {
    assert.ok(!json.includes(banned), `the grid must not emit ${banned}`);
  }
});

test('GRID: on the boundary day itself, both hypotheses are evaluated', () => {
  // Because the reset HOUR is not recorded, on Tuesday we do not know whether
  // the turnover has happened. An earlier revision silently assumed it had, and
  // reported "25 still open" on a Tuesday afternoon for a character who had
  // raided all week. Safe direction, but an assumption dressed as a fact.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(10, 18),
    '[Thu Aug 13 20:00:00 2026] You have entered The Plane of Hate - Group 3 (Fused).',
    '[Thu Aug 13 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!',

  ]);

  // Asked about Tuesday 18th: if the reset has happened, the Thursday kill is
  // last week and the cell is open. If it has not, the cell is done. Unknown.
  const onDay = core.projectGrid(st, { year: 2026, month: 8, day: 18, hour: 14, minute: 0, second: 0 });
  assert.equal(onDay.period.nowIsOnBoundaryDay, true);
  const amb = onDay.cells.find((c) => c.label === 'Plane of Hate' && c.difficulty === 3);
  assert.equal(amb.state, 'conditional');
  assert.match(amb.because, /whether the turnover has happened/);
  // Both branches must be NAMED, not merely counted as a disagreement.
  // Asked on Tue 18th about a kill on Thu 13th: if the turnover HAS happened,
  // that kill belongs to last week and the cell is open; if it has NOT, the
  // period is still last week's and the kill counts. So the branches read
  // "open" if it has / "completed" if it has not — and getting that order
  // backwards is exactly the mistake this assertion exists to catch.
  assert.match(amb.because, /"open" if it has, "completed" if it has not/);
  assert.equal(amb.decidedBy.doneIf, 'the turnover has not happened yet');
  assert.equal(amb.decidedBy.openIf, 'the turnover has already happened');

  // Asked about the Monday before, there is no ambiguity: one period, kill in it.
  const before = core.projectGrid(st, { year: 2026, month: 8, day: 17, hour: 12, minute: 0, second: 0 });
  assert.equal(before.period.nowIsOnBoundaryDay, false);
  assert.equal(before.cells.find((c) => c.label === 'Plane of Hate' && c.difficulty === 3).state, 'completed');
});

test('a non-zone "You have entered" must NOT clear the instance', () => {
  // THE BUG THIS CAUGHT, verbatim from the owner's log:
  //   [Mon Aug 10 18:05:40] You have entered The Ruins of Old Paineel - Group 1 (Awakened).
  //   [Mon Aug 10 18:05:40] You have entered an area where levitation effects do not function.
  //   [Mon Aug 10 18:11:22] Master Yael has been slain by Cavity!
  // The levitation notice parsed as a bare zone name, which is the open world,
  // which cleared the instance — and that completion silently lost its
  // difficulty. One real raid, dropped by a message about levitation.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 18:05:40 2026] You have entered The Ruins of Old Paineel - Group 1 (Awakened).',
    '[Wed Aug 19 18:05:40 2026] You have entered an area where levitation effects do not function.',
    '[Wed Aug 19 18:11:22 2026] Master Yael has been slain by Cavity!',

  ]);
  assert.equal(st.kills.length, 1);
  assert.equal(st.kills[0].instanced, true, 'the instance must survive the levitation notice');
  assert.equal(st.kills[0].difficulty, 1);
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Master Yael' && c.difficulty === 1);
  assert.equal(cell.state, 'completed');
});

test('the complete non-zone set comes from the client string table, not the corpus', () => {
  // eqstr_us.txt holds exactly three entries beginning "You have entered":
  //   3342 ...an area where levitation effects do not function.
  //   5151 ...an Arena (PvP) area.
  //   5492 the zone template itself.
  // The Arena line never occurred in our logs and would have bitten identically,
  // which is why the list is read from the client rather than from what we saw.
  assert.equal(core.parseLine('[Mon Aug 10 18:05:40 2026] You have entered an Arena (PvP) area.').kind, 'not-a-zone');
  assert.equal(core.parseLine('[Mon Aug 10 18:05:40 2026] You have entered an area where levitation effects do not function.').kind, 'not-a-zone');
  // A shape we have never seen, starting lower-case, is ignored and flagged
  // rather than silently treated as a zone.
  const unseen = core.parseLine('[Mon Aug 10 18:05:40 2026] You have entered some new notice the next patch adds.');
  assert.equal(unseen.kind, 'not-a-zone');
  assert.equal(unseen.unrecognised, true);
});

test('two different bosses in the same second are both recorded', () => {
  // dedupeKey had no `kill` case and fell through to `<second>|kill`, so a
  // second boss dying in the same second was silently discarded — a lost
  // completion, which is the wrong direction for a tool built to stop someone
  // forgetting a raid.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 2 (Adaptive).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by X!',
    '[Wed Aug 19 20:30:00 2026] Lady Vox has been slain by X!',

  ]);
  assert.equal(st.kills.length, 2, 'both kills survive');
  assert.deepEqual(st.kills.map((k) => k.boss).sort(), ['Innoruuk, the Prince of Hate', 'Lady Vox']);
});

test('COVERAGE: a hole in the MIDDLE of the period is not_looked, not open', () => {
  // Endpoint checking is not enough. This record starts before the boundary and
  // ends after `now`, but is missing the two days containing the reset. Reading
  // "open" off that would be the comfortable lie.
  const st = core.createState('Avenrae');
  core.applyLines(st, [...heartbeat(14, 16), ...heartbeat(20, 21)]);
  const grid = core.projectGrid(st, NOW);
  assert.equal(grid.period.coverageSpansPeriod, false);
  assert.ok(grid.period.coverageHoles.length > 0, 'the hole must be reported');
  assert.equal(grid.openCount, 0);
  assert.equal(grid.notLookedCount, 25);
  assert.match(grid.cells[0].because, /no record of/);
});

test('COVERAGE: an ordinary overnight gap is tolerated but still REPORTED', () => {
  // The owner confirmed on 23 Aug that logging is sometimes off, so a gap is
  // NOT assumed empty. But treating every night as missing coverage would make
  // the tool useless. So: gaps under the 24 h judgement threshold are tolerated
  // for cell state, and every one of them is still listed.
  const st = core.createState('Avenrae');
  core.applyLines(st, heartbeat(17, 21));
  const grid = core.projectGrid(st, NOW);
  assert.equal(grid.period.coverageSpansPeriod, true);
  assert.deepEqual(grid.period.coverageHoles, [], 'no gap exceeds the threshold');
  assert.ok(grid.period.coverageGaps.length > 0, 'but the nightly gaps ARE reported');
  assert.ok(grid.period.coverageGaps.every((g) => g.tolerated));
  assert.ok(grid.openCount > 0);
  assert.match(grid.period.coverageAssumption, /not logging/);
  assert.equal(grid.period.coverageGapToleranceHours, 24);
});

test('REPEATS: a second kill at the same tier is recorded, never counted', () => {
  // Measured: Avenrae killed Innoruuk at D4 on 12, 15 AND 16 Aug — one
  // character, one tier, one week. A kill proves completion, not consumption.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by X!',
    '[Thu Aug 20 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).',
    '[Thu Aug 20 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by X!',
  ]);
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Plane of Hate' && c.difficulty === 4);
  assert.equal(cell.state, 'completed');
  assert.equal(cell.repeatKills, 1, 'the repeat is recorded');
  assert.match(cell.because, /Innoruuk, the Prince of Hate at D4 on 2026-08-19/,
    'the FIRST completion is the one reported, and it names WHICH boss');
  assert.match(cell.because, /not counted/);
});

test('EVIDENCE: completed is observed, open is inferred, and the grid says so', () => {
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by X!',
  ]);
  const grid = core.projectGrid(st, NOW);
  const done = grid.cells.find((c) => c.state === 'completed');
  const open = grid.cells.find((c) => c.state === 'open');
  assert.equal(done.evidence, 'observed');
  assert.match(open.evidence, /inferred/);
  assert.match(grid.period.evidenceNote, /OBSERVED/);
  assert.match(grid.period.evidenceNote, /proves completion, not/);
});

test('THE WEEKLY TASK IS NOT PER BOSS — it is the first three raids of the week', () => {
  // The owner, 23 Aug 2026: "these are only given to the player for the first 3
  // raids you complete each week." I had reported the opposite — that Innoruuk
  // and Cazic-Thule "have no Voidling weekly" — reading a property of our
  // sample as a property of the game.
  //
  // Measured, and it fits exactly: Avenrae's week of 11 Aug holds 18 roster
  // boss kills against 3 task grants and 3 tokens.
  assert.equal(core.RAIDS.filter((r) => r.weeklyTaskObserved).length, 3,
    'three raids were observed carrying a weekly IN OUR CORPUS');
  // The field must not be named or read as a claim about the raid.
  for (const r of core.RAIDS) {
    assert.ok(!('weeklyTask' in r), 'the old, wrong field name must be gone');
    assert.equal(typeof r.weeklyTaskObserved, 'boolean');
  }
  const grid = core.projectGrid(core.applyLines(core.createState('Avenrae'), heartbeat(17, 21)), NOW);
  assert.equal(grid.cells.filter((c) => c.weeklyTaskObserved).length, 15);
});

// ---------------------------------------------------------------------------
// The alt+Z window: three objects, and the second name trap
// ---------------------------------------------------------------------------

test('THREE OBJECTS: the weekly, the lockout and the replay timer stay separate', () => {
  // The owner's alt+Z window shows all three at once with different periods.
  // Merging any two of them is the error the module was built to refuse.
  assert.equal(core.RESET_RULE.kind, undefined, 'the weekly is a WEEKDAY rule, not a rolling one');
  assert.equal(core.RESET_RULE.weekdayName, 'Tuesday');

  assert.equal(core.LOCKOUT_MODEL.kind, 'rolling');
  assert.equal(core.LOCKOUT_MODEL.days, 6);
  assert.equal(core.LOCKOUT_MODEL.provenance, 'observed', 'read off the client, not stated or inferred');

  assert.equal(core.REPLAY_MODEL.kind, 'rolling');
  assert.equal(core.REPLAY_MODEL.minutes, 60);
  assert.match(core.REPLAY_MODEL.governs, /re-entry/);
  assert.match(core.REPLAY_MODEL.doesNotGovern, /loot/);

  // Three distinct periods. If two ever coincide, something has been merged.
  const periods = new Set([
    'weekday:' + core.RESET_RULE.weekdayName,
    'rolling-days:' + core.LOCKOUT_MODEL.days,
    'rolling-mins:' + core.REPLAY_MODEL.minutes,
  ]);
  assert.equal(periods.size, 3);
});

test('THE LOCKOUT ANCHOR IS NOT RECORDED, and says so', () => {
  // All 28 boss rows read the same value to the second. Four runs spanning two
  // hours cannot each stamp their own timer and land identically, so the timer
  // does not start at the kill — but which event it DOES start at is a separate
  // question, and the module must not answer it by preference.
  assert.equal(core.LOCKOUT_MODEL.anchorEvent, null);
  assert.match(core.LOCKOUT_MODEL.anchorNote, /not recorded|does not say/i);
  assert.ok(core.LOCKOUT_MODEL.caveats.length >= 3);
});

test('THE PERIOD IS CONDITIONAL AND THE DIFFERENCE IS THE MEASUREMENT', () => {
  // An earlier revision claimed the two timers "solve each other" and that six
  // days "falls out". They do not and it does not. Two readings give two
  // equations in THREE unknowns (both periods and the elapsed time); subtracting
  // cancels the elapsed time and leaves only the DIFFERENCE of the periods.
  //
  // That difference is exact and assumption-free. The absolute period is not.
  const m = core.LOCKOUT_MODEL;

  assert.equal(m.differenceFromReplaySeconds, 514800, 'exactly 5d 23h');
  assert.equal(m.differenceProvenance, 'observed');
  // Verified from the two readings rather than trusted:
  const replayRemaining = 58 * 60 + 5;
  const bossRemaining = 5 * 86400 + 23 * 3600 + 58 * 60 + 5;
  assert.equal(bossRemaining - replayRemaining, m.differenceFromReplaySeconds);

  // The period must never be labelled as measured.
  assert.equal(m.daysProvenance, 'conditional');
  assert.match(m.condition, /one hour/);

  // And the alternatives must be carried, because "no other value fits" was the
  // false claim. Each one is self-consistent to the second.
  assert.ok(m.alternatives.length >= 3);
  for (const alt of m.alternatives) {
    const R = { '1h': 3600, '90m': 5400, '2h': 7200, '3h': 10800 }[alt.replayPeriod];
    assert.ok(R, `unhandled alternative ${alt.replayPeriod}`);
    const elapsed = R - replayRemaining;
    assert.ok(elapsed >= 0, `${alt.replayPeriod} would have already expired`);
    const B = bossRemaining + elapsed;
    assert.ok(Math.abs(B / 86400 - alt.lockoutDays) < 0.001,
      `${alt.replayPeriod} implies ${B / 86400} days, not ${alt.lockoutDays}`);
  }
  assert.match(m.settledBy, /alt\+Z|Replay Timer/);
});

test('NAME MAPPING: the window and the kill lines disagree, and only where recorded', () => {
  // An unmapped name renders as a MISSING lockout, which looks exactly like a
  // raid still owed — the roster trap through a second door.
  assert.equal(core.WINDOW_TO_KILL_NAME['Innoruuk'], 'Innoruuk, the Prince of Hate');
  assert.equal(core.WINDOW_TO_KILL_NAME['a dracoliche'], undefined, 'keyed on the WINDOW name');
  assert.equal(core.WINDOW_TO_KILL_NAME['Dracoliche'], 'a dracoliche');

  // EVERY window name must resolve to a string the game actually writes —
  // either directly, or through the mapping. Checked against every distinct
  // slain name in the corpus, not just the five-boss roster, because the window
  // names four bosses the roster never had.
  const windowNames = [].concat(...Object.values(core.OBSERVED_ZONES));
  const everSlain = new Set(ROSTER_EVIDENCE.namedMobs.map((m) => m.name));
  for (const w of windowNames) {
    const mapped = core.WINDOW_TO_KILL_NAME[w] || w;
    assert.ok(everSlain.has(mapped),
      `window name ${JSON.stringify(w)} resolves to ${JSON.stringify(mapped)}, ` +
      'which is not a string the game has ever written — that renders as a MISSING lockout');
  }

  // And no mapping may be redundant: if a window name already matches verbatim,
  // an entry for it is dead weight that will rot.
  for (const [win, kill] of Object.entries(core.WINDOW_TO_KILL_NAME)) {
    assert.ok(!everSlain.has(win),
      `${JSON.stringify(win)} is written verbatim by the game; its mapping to ` +
      `${JSON.stringify(kill)} is unnecessary`);
  }

  // THE ARTICLE HEURISTIC FAILS ON REAL BOSSES, and the evidence file records it.
  // "a dracoliche" and "the Hand of Veeshan" are raid bosses whose names begin
  // with an article. Filtering trash by that rule drops them.
  const dracoliche = ROSTER_EVIDENCE.namedMobs.find((m) => m.name === 'a dracoliche');
  assert.ok(dracoliche, 'a dracoliche must be recorded despite its leading article');
  assert.equal(dracoliche.looksNamed, false, 'and the heuristic must be shown failing on it');
});

test('ZONES: the lockable unit looks like the instance, not the boss', () => {
  // One Plane of Fear run produced lockout rows for all five of its bosses.
  assert.equal(core.OBSERVED_ZONES['The Plane of Fear'].length, 5);
  assert.equal(core.OBSERVED_ZONES['The Plane of Hate'].length, 2);
  // Recorded as evidence of structure, NOT shipped as the list of what exists.
  assert.match(core.LOCKOUT_MODEL.caveats.join(' '), /INSTANCE, not the boss/);
});

// ---------------------------------------------------------------------------
// The row is the raid, not the boss
// ---------------------------------------------------------------------------

test('RAIDS: the row is labelled by what you RUN and names what it CONTAINS', () => {
  // A player decides whether to run Plane of Fear. They do not decide whether to
  // kill Cazic-Thule, and should not have to know which boss we picked to stand
  // for the zone.
  const fear = core.RAIDS.find((r) => r.key === 'The Plane of Fear');
  assert.equal(fear.label, 'Plane of Fear', 'labelled by the raid, not by a boss inside it');
  assert.equal(fear.bosses.length, 5);
  assert.ok(fear.bosses.includes('Cazic-Thule'));

  // Single-boss raids keep the boss name, because there the label was already right.
  const vox = core.RAIDS.find((r) => r.key === 'The Permafrost Caverns');
  assert.equal(vox.label, 'Lady Vox');
  assert.deepEqual(vox.bosses, ['Lady Vox']);

  // Still 25 cells. The change is a label, not a shape.
  const grid = core.projectGrid(core.applyLines(core.createState('Avenrae'), heartbeat(17, 21)), NOW);
  assert.equal(grid.cells.length, 25);
  assert.equal(new Set(grid.cells.map((c) => c.raid)).size, 5);
});

test('RAIDS: ANY boss of a raid completes that raid cell', () => {
  // The shared-lock assumption, made operational. Killing Terror completes the
  // Plane of Fear cell at that tier — five cells moving in lockstep would be
  // noise, and one cell is the unit of the decision a player actually makes.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Fear - Group 3 (Fused).',
    '[Wed Aug 19 20:30:00 2026] Terror has been slain by Orlando!',
  ]);
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Plane of Fear' && c.difficulty === 3);
  assert.equal(cell.state, 'completed');
  assert.match(cell.because, /^Terror at D3/, 'and it names WHICH boss, not just the raid');
  assert.equal(cell.singleBoss, false);
  assert.equal(cell.bosses.length, 5);
});

test('RAIDS: the shared-lock ASSUMPTION is stated, not buried', () => {
  // One cell per raid is right only if the bosses inside share a lock. The alt+Z
  // window is consistent with that and does not prove it — they appeared
  // together after runs that took them together. If they ever diverge, one cell
  // would hide it, and that has to be written down where the model lives.
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lockoutCore.js'), 'utf8');
  assert.match(src, /SHARE a lock/i, 'the assumption must be named');
  assert.match(src, /does not prove it/i, 'and its limit must be named');
  assert.match(src, /one cell would hide it/i, 'and what it would fail to show');
});

test('RAIDS: a kill records both the raid and the boss', () => {
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).',
    '[Wed Aug 19 20:30:00 2026] Maestro of Rancor has been slain by Chrysaetos!',
  ]);
  assert.equal(st.kills.length, 1);
  assert.equal(st.kills[0].raid, 'The Plane of Hate');
  assert.equal(st.kills[0].boss, 'Maestro of Rancor', 'the boss is kept, not flattened to the raid');
  // RAID_OF_BOSS is keyed on the FOLDED name, so both spellings resolve.
  assert.equal(core.RAID_OF_BOSS[core.normaliseBossName('Maestro of Rancor')], 'The Plane of Hate');
  assert.equal(core.RAID_OF_BOSS[core.normaliseBossName('a dracoliche')], 'The Plane of Fear');
  assert.equal(core.RAID_OF_BOSS[core.normaliseBossName('A dracoliche')], 'The Plane of Fear');
});

test('CAPITALISATION: the client capitalises line-initial names, and the match folds case', () => {
  // THE BUG THIS CAUGHT, in code that had already shipped. The same mob is
  // written two ways depending on where it falls in the sentence:
  //     "A dracoliche has been slain by Orlando!"   8 kills, line-initial
  //     "You have slain a dracoliche!"              3 kills, mid-sentence
  // Exact-case equality on 'a dracoliche' caught 3 of 11, and a missed kill
  // renders as a raid still owed — the roster trap arriving through
  // capitalisation rather than through a typo.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    '[Wed Aug 12 20:00:00 2026] You have entered The Plane of Fear - Group 3 (Fused).',
    '[Wed Aug 12 22:31:58 2026] A dracoliche has been slain by Orlando!',
    '[Wed Aug 12 22:32:58 2026] You have slain a dracoliche!',
  ]);
  assert.equal(st.kills.length, 2, 'both spellings must match');
  assert.deepEqual(st.kills.map((k) => k.boss), ['A dracoliche', 'a dracoliche'],
    'and each kill keeps the spelling the game actually wrote');

  // The evidence file records every spelling seen, so a new one surfaces.
  const drac = ROSTER_EVIDENCE.roster.find((r) => r.key === 'a dracoliche');
  assert.ok(drac.spellings.length > 1, 'both spellings must be recorded in the evidence');
  assert.ok(drac.exactKills >= 10, `case-folded count should recover the kills, got ${drac.exactKills}`);
});

test('CAPITALISATION: folding case cannot collide two different raid bosses', () => {
  // Safe here only because the match is exact equality, not substring.
  // "A priest of Nagafen" and "a priest of Nagafen" are the same mob, and
  // neither equals "Lord Nagafen" — which a substring match would have scored.
  const folded = [].concat(...core.RAIDS.map((r) => r.bosses)).map(core.normaliseBossName);
  assert.equal(new Set(folded).size, folded.length, 'no two roster bosses may fold together');

  const st = core.createState('Avenrae');
  core.applyLines(st, [
    '[Wed Aug 12 20:00:00 2026] You have entered ' + "Nagafen's Lair - Group 1 (Awakened).",
    '[Wed Aug 12 20:30:00 2026] A priest of Nagafen has been slain by X!',
    '[Wed Aug 12 20:31:00 2026] a priest of Nagafen has been slain by X!',
  ]);
  assert.equal(st.kills.length, 0, 'neither priest is Lord Nagafen');
});

// ---------------------------------------------------------------------------
// MUTATION PROOF of the boundary-day branch, both directions.
//
// The Director asked for this as: "a run dated Wednesday must produce zero
// unknown cells, and a run dated Tuesday must produce them."
//
// I AM NOT WRITING THAT TEST, BECAUSE IT WOULD LOCK IN A FALSE MODEL, and the
// Director's own point 2 says why: the owner's raids ran on Tuesday 25 Aug
// between 20:31 and 22:37, and asking on Wednesday about a Tuesday kill is
// genuinely ambiguous. A Wednesday run CAN and MUST produce ambiguous cells —
// what it must not do is produce them when nothing ambiguous happened.
//
// So the mutation is on the RIGHT axis: not the weekday of the question, but
// whether a kill fell on the boundary day. Three cases, and each must fail if
// the branch is broken in either direction.
// ---------------------------------------------------------------------------

// Wed 19 Aug 2026. The boundary day is Tue 18 Aug.
const WED = { year: 2026, month: 8, day: 19, hour: 22, minute: 0, second: 0 };

function killAt(stamp, tier) {
  return [
    `[${stamp}] You have entered The Permafrost Caverns - Group ${tier} (${core.DIFFICULTY_LABELS[tier]}).`,
    `[${stamp.replace(/(\d\d):(\d\d):(\d\d)/, (m, h, mi, s) => `${h}:${String(Number(mi) + 1).padStart(2, '0')}:${s}`)}] Lady Vox has been slain by X!`,
  ];
}

test('MUTATION 1/3: Wednesday now, kills ONLY on Wednesday -> zero ambiguous cells', () => {
  // The direction that was broken. If any cell comes back conditional or
  // unknown here, a branch meant to fire on the boundary day is firing off it.
  const st = core.createState('Avenrae');
  core.applyLines(st, [...heartbeat(17, 19), ...killAt('Wed Aug 19 20:00:00 2026', 2)]);
  const g = core.projectGrid(st, WED);

  assert.equal(g.period.boundaryDay, '2026-08-18');
  assert.equal(g.period.nowIsOnBoundaryDay, false, 'Wednesday is not the boundary day');
  assert.equal(g.conditionalCount, 0, 'nothing fell on the boundary day, so nothing is conditional');
  assert.equal(g.uncertainCount, 0, 'and nothing is unknown');
  assert.equal(g.completedCount, 1);
  assert.equal(g.openCount, 24);
  assert.equal(g.cells.find((c) => c.label === 'Lady Vox' && c.difficulty === 2).state, 'completed');
});

test('MUTATION 2/3: Wednesday now, kill ON the preceding Tuesday -> conditional, at that tier ONLY', () => {
  // The direction that must NOT be "fixed" away. This kill is genuinely
  // ambiguous and the tool must say so — while naming the instant that settles
  // it, and touching no other cell.
  const st = core.createState('Avenrae');
  core.applyLines(st, [...heartbeat(17, 19), ...killAt('Tue Aug 18 20:00:00 2026', 2)]);
  const g = core.projectGrid(st, WED);

  assert.equal(g.period.nowIsOnBoundaryDay, false, 'still asking on a Wednesday');
  assert.equal(g.conditionalCount, 1, 'exactly one cell turns on the reset hour');
  assert.equal(g.uncertainCount, 0, 'and none is a bare shrug');
  assert.equal(g.completedCount, 0, 'never completed — that would hide a raid still owed');
  assert.equal(g.openCount, 24, 'the other 24 cells are untouched and plainly open');

  const cell = g.conditional[0];
  assert.equal(cell.label, 'Lady Vox');
  assert.equal(cell.difficulty, 2);
  assert.equal(cell.decidedBy.pivot, '2026-08-18 20:01:00');
  assert.match(cell.because, /completed if the reset fell at or before 2026-08-18 20:01:00, still open if it fell after/);
});

test('MUTATION 3/3: Tuesday now -> the two hypotheses are BOTH named', () => {
  // Covers from the PRIOR boundary day (Tue 11 Aug), not just from the 12th.
  // On the boundary day both windows are live, so coverage is now judged over
  // the whole range that could be the period — a week further back. A fixture
  // that starts inside that range leaves a 42-hour hole at its head and the
  // grid correctly answers `not_looked`. Widening the fixture is the fix; the
  // module is right.
  const st = core.createState('Avenrae');
  core.applyLines(st, [...heartbeat(11, 18), ...killAt('Thu Aug 13 20:00:00 2026', 2)]);
  const g = core.projectGrid(st, { year: 2026, month: 8, day: 18, hour: 14, minute: 0, second: 0 });

  assert.equal(g.period.nowIsOnBoundaryDay, true, 'Tuesday IS the boundary day');
  assert.equal(g.conditionalCount, 1);
  assert.equal(g.uncertainCount, 0);
  assert.match(g.conditional[0].because, /"open" if it has, "completed" if it has not/);
});

test('MUTATION 4/4: the weekday arithmetic lands on Tuesday for all seven days of a week', () => {
  // `back = (dow - 2 + 7) % 7` is the branch's only input. If it is ever wrong,
  // a branch meant to fire one day in seven fires on a day it is not — which is
  // what the Director suspected had happened here. It had not, but the
  // suspicion deserves a standing test rather than a one-off check.
  const st = core.applyLines(core.createState('Avenrae'), heartbeat(17, 23));
  const expected = {
    17: '2026-08-11', // Mon -> previous Tuesday
    18: '2026-08-18', // Tue -> today
    19: '2026-08-18', 20: '2026-08-18', 21: '2026-08-18', 22: '2026-08-18', 23: '2026-08-18',
  };
  for (const [day, boundary] of Object.entries(expected)) {
    const g = core.projectGrid(st, { year: 2026, month: 8, day: Number(day), hour: 12, minute: 0, second: 0 });
    assert.equal(g.period.boundaryDay, boundary, `Aug ${day} must sit in the period beginning ${boundary}`);
    assert.equal(g.period.nowIsOnBoundaryDay, Number(day) === 18, `only Aug 18 is the boundary day`);
  }

  // Month, year and leap-day rollovers, where day arithmetic usually breaks.
  const s2 = core.createState('Avenrae');
  for (const [now, boundary] of [
    [{ year: 2026, month: 3, day: 1, hour: 12, minute: 0, second: 0 }, '2026-02-24'],  // Sun -> back over a month end
    [{ year: 2026, month: 1, day: 1, hour: 12, minute: 0, second: 0 }, '2025-12-30'],  // Thu -> back over a year end
    [{ year: 2028, month: 3, day: 1, hour: 12, minute: 0, second: 0 }, '2028-02-29'],  // Wed -> back onto a leap day
  ]) {
    const g = core.projectGrid(s2, now);
    assert.equal(g.period.boundaryDay, boundary);
    assert.equal(new Date(`${boundary}T00:00:00Z`).getUTCDay(), 2, `${boundary} must be a Tuesday`);
  }
});

test('ROSTER: `alsoDies` is recorded and INERT — it must never complete a cell', () => {
  // The window lists four bosses under Nagafen's Lair and the corpus agrees
  // (Tranix 14/15 group visits, Rokyl 14/15, Skarlon 12/15, each exactly once).
  // They are named, and they complete nothing. Promoting them could only fail
  // in the dangerous direction: a group that kills Tranix and then wipes on
  // Nagafen would be told the raid is done, and would miss it.
  const nag = core.RAIDS.find((r) => r.key === "Nagafen's Lair");
  assert.deepEqual(nag.bosses.slice(), ['Lord Nagafen'], 'exactly one completion key');
  assert.ok(nag.alsoDies.includes('King Tranix'));
  assert.equal(nag.singleBoss, false, 'and the row must stop claiming to be single-boss');

  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered ' + "Nagafen's Lair - Group 3 (Fused).",
    '[Wed Aug 19 20:20:00 2026] King Tranix has been slain by X!',
    '[Wed Aug 19 20:22:00 2026] Magus Rokyl has been slain by X!',
  ]);
  assert.equal(st.kills.length, 0, 'a non-key kill is not even recorded as a roster kill');
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Lord Nagafen');
  for (const c of row) assert.equal(c.state, 'open', 'and it completes nothing');
});

test('ROSTER: singleBoss is MEASURED, not derived from our own list length', () => {
  // It used to be `bosses.length === 1`, which read a claim about the game off
  // our own configuration — Nagafen's Lair "was" single-boss only because we
  // had listed one key.
  const byKey = Object.fromEntries(core.RAIDS.map((r) => [r.key, r]));
  assert.equal(byKey["Nagafen's Lair"].singleBoss, false);
  assert.equal(byKey['The Permafrost Caverns'].singleBoss, false);
  assert.equal(byKey['The Ruins of Old Paineel'].singleBoss, true, 'Master Yael is the only mob at 25/25');
  for (const r of core.RAIDS) {
    assert.equal(typeof r.singleBoss, 'boolean', `${r.key} must state it, not imply it`);
    if (r.singleBoss) assert.equal(r.alsoDies.length, 0, 'single-boss and alsoDies are contradictory');
  }
});

test('THE THIRD KILL SHAPE "<Name> died." is deliberately NOT parsed', () => {
  // 47 lines across the 16 files, 8 inside a `- Group` instance. It is not
  // parsed because it covers PLAYER and PET deaths as well as mob deaths —
  // "Shara died." and "Avenrae died." are both in the corpus — so reading it as
  // a kill would score the owner's own death as a boss kill.
  assert.equal(core.parseLine('[Wed Aug 12 22:55:43 2026] Warlord Skarlon died.'), null);
  assert.equal(core.parseLine('[Wed Aug 12 22:55:43 2026] Avenrae died.'), null,
    'and this is why: the same shape carries the player');

  // The two shapes we DO parse must keep working, so this is a decision about
  // one shape and not a hole in kill parsing generally.
  assert.equal(core.parseLine('[Wed Aug 12 22:55:43 2026] Lord Nagafen has been slain by X!').kind, 'kill');
  assert.equal(core.parseLine('[Wed Aug 12 22:55:43 2026] You have slain Lord Nagafen!').kind, 'kill');

  // THE CLEARANCE: no roster boss has ever appeared in the unparsed shape, so
  // not parsing it costs the grid nothing today. If that changes, this is the
  // decision to revisit.
  const spellings = ROSTER_EVIDENCE.roster.flatMap((r) => r.spellings || [r.key]);
  assert.ok(spellings.length >= 10, 'the evidence file must carry the spellings to clear against');
});

test('ROSTER: alsoDies and singleBoss survive the trip through state and a restore', () => {
  // They did not, first time. `createState` builds a reduced copy of RAIDS and
  // silently dropped both fields, so the module held the measurement, the cell
  // reported `alsoDies: []`, and the tooltip said nothing. Only opening the
  // built page caught it — the tests were all green.
  const st = core.createState('Avenrae');
  const nag = st.raids.find((r) => r.key === "Nagafen's Lair");
  assert.deepEqual(nag.alsoDies, ['King Tranix', 'Magus Rokyl', 'Warlord Skarlon']);
  assert.equal(nag.singleBoss, false);

  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Lord Nagafen' && c.difficulty === 0);
  assert.deepEqual(cell.alsoDies, ['King Tranix', 'Magus Rokyl', 'Warlord Skarlon'],
    'the cell is what the UI renders — the measurement has to reach it');
  assert.equal(cell.singleBoss, false);

  // And across a JSON round trip, which is the core's contract (serialize and
  // restore live on the engine; the core promises only that state is clonable)
  // and is how the page persists a session between reloads.
  const back = JSON.parse(JSON.stringify(st));
  assert.deepEqual(back.raids.find((r) => r.key === "Nagafen's Lair").alsoDies,
    ['King Tranix', 'Magus Rokyl', 'Warlord Skarlon']);
  assert.deepEqual(core.projectGrid(back, NOW).cells.map((c) => c.state),
    core.projectGrid(st, NOW).cells.map((c) => c.state),
    'a cloned state must project identically');
});

test('GRID: a completion carries its date as a FIELD, not inside prose', () => {
  // The page rendered the date by regexing `because`. A shell heredoc ate the
  // backslashes, the pattern became /on (d{4}-d{2}-d{2})/, it matched nothing,
  // and every completion date vanished from the grid with no error anywhere.
  // The mangling was my fault; the fragility was the design. A view reads a
  // field. Reword `because` freely — this must keep working.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by Jrhx!',
  ]);
  const cells = core.projectGrid(st, NOW).cells;
  const done = cells.find((c) => c.label === 'Plane of Hate' && c.difficulty === 4);
  assert.equal(done.state, 'completed');
  assert.equal(done.completedAt, '2026-08-19 20:30:00');
  assert.equal(done.completedBy, 'Innoruuk, the Prince of Hate');

  // Null everywhere else, so a view can key on it without guessing.
  for (const c of cells.filter((c) => c.state !== 'completed')) {
    assert.equal(c.completedAt, null, `${c.label} D${c.difficulty} is ${c.state} and must carry no date`);
    assert.equal(c.completedBy, null);
  }
});

test('THE INFERENCE HAZARD IS STATED IN THE MODULE, and stays stated', () => {
  // Every other caveat in LOCKOUT_MODEL describes an error that more data would
  // eventually expose. This one describes an error that no amount of data ever
  // will: kill timestamps are real, plentiful, and precisely wrong for dating a
  // lockout, so a tracker built on them passes its tests forever.
  //
  // A comment can be deleted by a refactor with nobody noticing. This assertion
  // is the thing that notices.
  const h = core.LOCKOUT_MODEL.inferenceHazard;
  assert.equal(typeof h, 'string', 'LOCKOUT_MODEL must carry inferenceHazard');
  assert.match(h, /NO VOLUME\s+OF KILL DATA WILL EVER REVEAL THE ERROR/,
    'the sentence itself must survive — it is the deliverable, not a summary of one');
  assert.match(h, /6,133/, 'and must carry the measurement that establishes it');
  assert.match(h, /zero spread/);

  // The two facts the hazard rests on must remain true of the model, or the
  // sentence is describing a model we no longer ship.
  assert.equal(core.LOCKOUT_MODEL.anchorEvent, null,
    'anchorEvent must stay null: the anchor is not in the log');
  assert.equal(core.LOCKOUT_MODEL.commonOrigin, true);

  // And nothing in the public output may quietly supply the anchor a caller
  // would need in order to do the inference this warns against.
  const st = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const json = JSON.stringify(core.projectGrid(st, NOW));
  for (const banned of ['lockoutStart', 'lockedAt', 'lockoutExpires', 'expiresAt', 'anchorAt']) {
    assert.ok(!json.includes(banned), `the grid must not emit ${banned} — it does not know it`);
  }
});

// ---------------------------------------------------------------------------
// THE OUTPUT SHAPE IS AN ALLOWLIST, NOT A BAN LIST
//
// The existing countdown ban lists key names — secondsRemaining, expiresAt and
// so on — and an adversarial pass walked straight past it. Working against a
// mirror of this module it added `resetHour: 5`, `nextResetOn`,
// `hoursUntilNextReset`, `availableIn: {days, hours}`, `dueBy`, `resetsAt`,
// `nextAvailableInHours`, `estimatedResetAt` — and, worst of the set, a
// countdown folded into the `because` PROSE, where no key name appears at all.
//
// A ban list can only forbid what somebody already thought of. This module is
// about to be embedded in an application built by people who did not write it
// and who will, quite reasonably, want to add fields. So the test is inverted:
// **every key in the public output must be declared here.** A new field fails
// the suite until a human adds it deliberately, and that is the moment to ask
// whether it is a fact or a guess.
//
// Regenerate deliberately, never reflexively:
//   node -e "..." (see analysis/; walk the output and print sorted paths)
// ---------------------------------------------------------------------------
const GRID_SHAPE = [
  'cells',
  'cells[].alsoDies',
  'cells[].because',
  'cells[].bosses',
  'cells[].completedAt',
  'cells[].completedBy',
  'cells[].decidedBy',
  'cells[].difficulty',
  'cells[].difficultyLabel',
  'cells[].evidence',
  'cells[].label',
  'cells[].raid',
  'cells[].repeatKills',
  'cells[].shapes',
  'cells[].singleBoss',
  'cells[].state',
  'cells[].tierFromOmission',
  'cells[].weeklyTaskObserved',
  'completed',
  'completedCount',
  'conditional',
  'conditionalCount',
  'notLooked',
  'notLookedCount',
  'notLooked[].alsoDies',
  'notLooked[].because',
  'notLooked[].bosses',
  'notLooked[].completedAt',
  'notLooked[].completedBy',
  'notLooked[].decidedBy',
  'notLooked[].difficulty',
  'notLooked[].difficultyLabel',
  'notLooked[].evidence',
  'notLooked[].label',
  'notLooked[].raid',
  'notLooked[].repeatKills',
  'notLooked[].shapes',
  'notLooked[].singleBoss',
  'notLooked[].state',
  'notLooked[].tierFromOmission',
  'notLooked[].weeklyTaskObserved',
  'open',
  'openCount',
  'period',
  'period.boundaryDay',
  'period.boundaryWeekday',
  'period.coverageAssumption',
  'period.coverageFrom',
  'period.coverageGapToleranceHours',
  'period.coverageObservedFraction',
  'period.coverageObservedMinimum',
  'period.coverageGaps',
  'period.coverageGaps[].from',
  'period.coverageGaps[].hours',
  'period.coverageGaps[].to',
  'period.coverageGaps[].tolerated',
  'period.coverageHoles',
  'period.coverageHoles[].from',
  'period.coverageHoles[].hours',
  'period.coverageHoles[].to',
  'period.coverageSpansPeriod',
  'period.coverageTo',
  'period.evidenceNote',
  'period.hourKnown',
  'period.nowIsOnBoundaryDay',
  'period.periodStartedAt',
  'resetRule',
  'resetRule.hour',
  'resetRule.measuredBracketContainsRule',
  'resetRule.measuredBracketPacific',
  'resetRule.note',
  'resetRule.provenance',
  'resetRule.source',
  'resetRule.weekday',
  'resetRule.weekdayName',
  'uncertain',
  'uncertainCount',
];

const VIEW_SHAPE = [
  'bosses',
  'bosses[].available',
  'bosses[].available.provenance',
  'bosses[].available.value',
  'bosses[].boss',
  'bosses[].cadence',
  'bosses[].lastAssigned',
  'bosses[].lastAssigned.hoursAgo',
  'bosses[].lastAssigned.provenance',
  'bosses[].lastAssigned.value',
  'bosses[].lastCompleted',
  'bosses[].lastCompleted.hoursAgo',
  'bosses[].lastCompleted.provenance',
  'bosses[].lastCompleted.value',
  'bosses[].task',
  'bosses[].timesAssigned',
  'bosses[].timesCompleted',
  'caveats',
  'character',
  'coverage',
  'coverage.from',
  'coverage.note',
  'coverage.provenance',
  'coverage.to',
  'dropped',
  'dropped.beyondDedupeHorizon',
  'dropped.duplicate',
  'dropped.unstamped',
  'grants',
  'grants.items',
  'grants.items[].at',
  'grants.items[].item',
  'grants.provenance',
  'grants.total',
  'instances',
  'instances[].difficulty',
  'instances[].difficultyFromOmission',
  'instances[].difficultyLabel',
  'instances[].difficultyStated',
  'instances[].group',
  'instances[].seen',
  'instances[].zone',
  'now',
  'period',
  'period.provenance',
  'period.reason',
  'period.value',
  'requests',
  'requests[].at',
  'requests[].boss',
  'requests[].civil',
  'requests[].positiveControl',
  'requests[].result',
  'reset',
  'reset.basis',
  'reset.brackets',
  'reset.brackets[].after',
  'reset.brackets[].afterCivil',
  'reset.brackets[].afterWeekday',
  'reset.brackets[].before',
  'reset.brackets[].beforeCivil',
  'reset.brackets[].beforeWeekday',
  'reset.brackets[].boss',
  'reset.brackets[].cadence',
  'reset.brackets[].crossesPossibleDstShift',
  'reset.brackets[].fromRefusal',
  'reset.brackets[].task',
  'reset.brackets[].widthHours',
  'reset.caveats',
  'reset.intersectionHours',
  'reset.intersects',
  'reset.narrowest',
  'reset.narrowest.after',
  'reset.narrowest.afterCivil',
  'reset.narrowest.afterWeekday',
  'reset.narrowest.before',
  'reset.narrowest.beforeCivil',
  'reset.narrowest.beforeWeekday',
  'reset.narrowest.boss',
  'reset.narrowest.cadence',
  'reset.narrowest.crossesPossibleDstShift',
  'reset.narrowest.fromRefusal',
  'reset.narrowest.task',
  'reset.narrowest.widthHours',
  'reset.provenance',
  'reset.value',
  'version',
];
function shapeOf(o, pre = '', acc = new Set()) {
  if (Array.isArray(o)) { for (const v of o) shapeOf(v, pre + '[]', acc); return acc; }
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) { const p = pre ? pre + '.' + k : k; acc.add(p); shapeOf(o[k], p, acc); }
    return acc;
  }
  return acc;
}

test('SHAPE: the grid emits exactly the declared keys, and nothing else', () => {
  const st = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const got = [...shapeOf(core.projectGrid(st, NOW))].sort();
  const added = got.filter((k) => !GRID_SHAPE.includes(k));
  const gone = GRID_SHAPE.filter((k) => !got.includes(k));
  assert.deepEqual(added, [],
    'UNDECLARED FIELD(S) in the grid. If this is a new fact, add it to GRID_SHAPE ' +
    'deliberately — and while you are there, check it carries a provenance and is ' +
    'not a countdown: ' + added.join(', '));
  assert.deepEqual(gone, [], 'declared field(s) vanished from the grid: ' + gone.join(', '));
});

test('SHAPE: the per-boss view emits exactly the declared keys', () => {
  const st = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const got = [...shapeOf(core.project(st, NOW))].sort();
  const added = got.filter((k) => !VIEW_SHAPE.includes(k));
  const gone = VIEW_SHAPE.filter((k) => !got.includes(k));
  assert.deepEqual(added, [], 'UNDECLARED FIELD(S) in the view: ' + added.join(', '));
  assert.deepEqual(gone, [], 'declared field(s) vanished from the view: ' + gone.join(', '));
});

test('NO COUNTDOWN IN PROSE EITHER — the hole the key-name ban left open', () => {
  // The attack that got furthest did not add a field at all. It appended
  // " — 41.5h left" to `because`, which the UI renders verbatim and which no
  // key-name ban and no shape allowlist can see. A countdown is a countdown
  // wherever it lives.
  //
  // THIS TEST WAS VACUOUS ON ITS FIRST WRITING and passed against a grid that
  // was carrying the countdown. It walked the committed fixture, which produces
  // 25 not_looked cells and nothing else, so the smuggled branch — guarded on
  // `cellState === 'open'` — never ran. A detector that has only been run on a
  // fixture has not been run; that is the third time this project has learned it.
  //
  // So the state below is built to exercise EVERY cell state, and the coverage
  // assertion underneath makes it impossible for this test to go quiet again.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    // completed — after the boundary day
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Hate - Group 4 (Refined).',
    '[Wed Aug 19 20:30:00 2026] Innoruuk, the Prince of Hate has been slain by X!',
    // conditional — ON the boundary day
    '[Tue Aug 18 12:00:00 2026] You have entered The Permafrost Caverns - Group 2 (Adaptive).',
    '[Tue Aug 18 12:30:00 2026] Lady Vox has been slain by X!',
    // unknown — an instance whose tier the game did not state
    '[Thu Aug 20 19:00:00 2026] You have entered The Ruins of Old Paineel - Solo.',
    '[Thu Aug 20 19:20:00 2026] Master Yael has been slain by X!',
  ]);
  const grid = core.projectGrid(st, NOW);

  const seen = new Set(grid.cells.map((c) => c.state));
  for (const needed of ['completed', 'open', 'conditional', 'unknown']) {
    assert.ok(seen.has(needed),
      `this test is only meaningful if a ${needed} cell exists — it does not, so it proves nothing`);
  }
  // not_looked needs coverage that does NOT span, so it gets its own grid.
  const fresh = core.projectGrid(core.createState('Avenrae'), NOW);
  assert.equal(fresh.notLookedCount, 25);

  const strings = [];
  const walk = (o) => {
    if (typeof o === 'string') { strings.push(o); return; }
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') { Object.values(o).forEach(walk); }
  };
  walk(grid);
  walk(fresh);
  walk(core.project(st, NOW));
  assert.ok(strings.length > 50, 'the walk must actually reach the prose');

  // Shapes a countdown takes in English. Deliberately broad: a false positive
  // costs one conversation, a miss costs the property this module exists for.
  const COUNTDOWN = [
    /\d+(\.\d+)?\s*h(ours?)?\s+(left|remaining|to go|until)/i,
    /\d+(\.\d+)?\s*d(ays?)?\s+(left|remaining|to go|until)/i,
    /\b(in|within)\s+\d+(\.\d+)?\s*(second|minute|hour|day)/i,
    /\b(resets?|available|expires?|unlocks?)\s+(in|at)\s+\d/i,
    /\bcountdown\b/i,
  ];

  // THE DETECTOR IS PROVEN TO DETECT, in the same breath as it is used.
  // Every pattern above was silently broken when this test was first written:
  // a shell heredoc ate \d, \s and \. while leaving \b intact, so the array
  // looked plausible and matched nothing at all. The suite went green against
  // a module that was carrying the exact countdown this test exists to catch.
  // That was the fourth file corrupted the same way in one day, every time
  // with no error anywhere.
  //
  // So the detector is fired at known-bad strings before it is trusted on
  // real ones. A regex that cannot catch its own example is not a test.
  const MUST_CATCH = [
    'Terror at D3 on 2026-08-19 — 41.5h left',
    'no kill observed since the reset, 3 days remaining',
    'available in 2 hours',
    'resets at 5',
    'a countdown nobody asked for',
  ];
  for (const bad of MUST_CATCH) {
    assert.ok(COUNTDOWN.some((re) => re.test(bad)),
      `the countdown detector is broken — it does not match ${JSON.stringify(bad)}`);
  }
  for (const str of strings) {
    for (const re of COUNTDOWN) {
      assert.ok(!re.test(str), `a countdown reached the output as prose: ${JSON.stringify(str.slice(0, 120))}`);
    }
  }

  // The measured bracket is the ONE place a clock time legitimately appears —
  // it is a measurement, not a prediction — so it must still be there.
  assert.match(core.RESET_RULE.measuredBracketPacific, /\d\d:\d\d/,
    'the measured bracket is evidence and must not be scrubbed by this rule');
});

test('NOT LOOKED: seven lines across a week must never read as 25 open', () => {
  // THE WORST DEFECT THIS MODULE HAS HAD, found by an adversarial pass two days
  // before handover. The coverage gate tested only the LARGEST single gap
  // against 24 hours, so seven zone-in lines spaced 23 hours apart — and
  // nothing else — reported `coverageSpansPeriod: true`, zero holes, and
  // **25 raids still open**. A rule about the biggest hole says nothing about
  // how much of the period was seen at all, and near-zero observation passed it
  // trivially. Nine unrelated combat lines were enough to flip a whole week.
  //
  // That is exactly the comfortable lie the not_looked state exists to prevent.
  const DAYS_ = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const sparse = [];
  let t = Date.UTC(2026, 7, 18, 1, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(t);
    sparse.push(`[${DAYS_[d.getUTCDay()]} Aug ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00 2026] You have entered Nektulos Forest.`);
    t += 23 * 3600000;
  }
  const st = core.applyLines(core.createState('Avenrae'), sparse);
  const g = core.projectGrid(st, { year: 2026, month: 8, day: 24, hour: 1, minute: 0, second: 0 });

  assert.equal(g.period.nowIsOnBoundaryDay, false, 'and it is not a boundary-day quirk');
  assert.equal(g.openCount, 0, 'seven lines cannot clear a week');
  assert.equal(g.notLookedCount, 25);
  assert.equal(g.period.coverageSpansPeriod, false);
  assert.match(g.notLooked[0].because, /only 0\.0% of this period is in the log/,
    'and it must say WHICH test failed, not "coverage does not span"');

  // THE OTHER DIRECTION, so the fix cannot be "call everything not_looked".
  // Four hours an evening for six days is ordinary play and must still answer.
  const dense = [];
  let d0 = Date.UTC(2026, 7, 18, 18, 0, 0);
  for (let day = 0; day < 6; day++) {
    for (let m = 0; m < 240; m += 2) {
      const x = new Date(d0 + m * 60000);
      dense.push(`[${DAYS_[x.getUTCDay()]} Aug ${pad(x.getUTCDate())} ${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:00 2026] You have entered Nektulos Forest.`);
    }
    d0 += 86400000;
  }
  const g2 = core.projectGrid(core.applyLines(core.createState('Avenrae'), dense),
    { year: 2026, month: 8, day: 24, hour: 1, minute: 0, second: 0 });
  assert.equal(g2.notLookedCount, 0, 'ordinary play must still get an answer');
  assert.equal(g2.openCount, 25);
  assert.ok(g2.period.coverageObservedFraction > 0.05);
});

test('THRESHOLDS are asserted, because mutating them was silent', () => {
  // Mutation testing found that CONTROL_BEFORE_MS 20s -> 24h, GRANT_WINDOW_MS
  // 3s -> 10min and CONTROL_AFTER_MS 5s -> 1h ALL passed the entire suite. The
  // first is not cosmetic: with the control window widened to a day, a Voidling
  // line six hours before a `danger` turns classifyRequests from ["unknown"] to
  // ["refused"] — the module MANUFACTURES a lockout, in the one direction it is
  // built never to fail, with every test green.
  //
  // No test asserted any of these values. They are published in THRESHOLDS
  // precisely so they are not hidden, and a published constant that nothing
  // checks is a constant that can drift.
  const T = core.THRESHOLDS;
  assert.equal(T.GRANT_WINDOW_MS, 3000, 'a grant follows its request within seconds');
  assert.equal(T.CONTROL_BEFORE_MS, 20000, 'the control window is SECONDS — widen it and refusals are invented');
  assert.equal(T.CONTROL_AFTER_MS, 5000);
  assert.equal(T.COLLAPSE_MS, 6000);
  assert.equal(T.MAX_EVENTS, 5000);
  assert.equal(T.MAX_VOIDLING_REPLIES, 5000);

  // And the behaviour the first one protects, asserted directly rather than
  // trusted to the number.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    "[Mon Aug 10 12:00:00 2026] Voidling says, 'Your hubris risks our very reality itself.'",
    "[Mon Aug 10 18:00:00 2026] You say, 'danger'",
  ]);
  const rows = core.classifyRequests(st);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, 'unknown',
    'a Voidling line SIX HOURS earlier is not a control for this request');
  assert.equal(rows[0].positiveControl, false);
});

test('THE HOUR HAS SOMEWHERE TO GO NOW — and had nowhere before', () => {
  // SESSION C FOUND THIS, and it is a real miss of mine. For eleven days I asked
  // the owner for the reset hour as though the number were the whole blocker.
  // `RESET_RULE.hour` had ZERO uses in the module — no destructuring, no index
  // access. The boundary was a whole day; the hour never entered a computation.
  // A perfect hour handed over would have changed NOT ONE CELL.
  //
  // This test is the proof that it now would. It drives the code path by
  // substituting a RESET_RULE that carries an hour, which is the same shape the
  // real one takes the day it is measured.
  const DAYS_ = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const pad = (n) => String(n).padStart(2, '0');
  const line = (day, h, m, text) =>
    `[${DAYS_[new Date(Date.UTC(2026, 7, day)).getUTCDay()]} Aug ${pad(day)} ${pad(h)}:${pad(m)}:00 2026] ${text}`;

  // Two kills on the BOUNDARY DAY, Tue 18 Aug — one at 06:00, one at 20:00.
  // With the hour unmeasured both are ambiguous. With a 12:00 reset they are on
  // opposite sides of it, and that is the whole point.
  const lines = [
    ...heartbeat(11, 21),
    line(18, 6, 0, 'You have entered The Plane of Hate - Group 3 (Fused).'),
    line(18, 6, 10, 'Innoruuk, the Prince of Hate has been slain by X!'),
    line(18, 20, 0, 'You have entered The Permafrost Caverns - Group 3 (Fused).'),
    line(18, 20, 10, 'Lady Vox has been slain by X!'),
  ];
  const NOW_ = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };

  // ---- as shipped: hour unmeasured ----
  const st = core.applyLines(core.createState('Avenrae'), lines);
  const before = core.projectGrid(st, NOW_);
  assert.equal(core.RESET_RULE.hour, null, 'the hour ships unmeasured, and must');
  assert.equal(before.period.hourKnown, false);
  assert.equal(before.period.periodStartedAt, null, 'no instant to report yet');
  assert.ok(before.conditionalCount >= 2,
    `both boundary-day kills should be conditional; got ${before.conditionalCount}`);

  // ---- with an hour: the ambiguity is arithmetic ----
  // RESET_RULE is frozen, so the path is exercised through a fresh module
  // instance with the field replaced — the same thing that happens when the
  // constant is edited after a measurement.
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lockoutCore.js'), 'utf8')
    .replace('  hour: null,                    // not recorded', '  hour: 12,');
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', src)(mod, mod.exports);
  const measured = mod.exports;
  assert.equal(measured.RESET_RULE.hour, 12, 'the substitution must have taken');

  const st2 = measured.applyLines(measured.createState('Avenrae'), lines);
  const after = measured.projectGrid(st2, NOW_);

  assert.equal(after.period.hourKnown, true);
  assert.equal(after.period.periodStartedAt, '2026-08-18 12:00:00',
    'the period now opens at an instant, and says so');
  assert.equal(after.conditionalCount, 0,
    'CONDITIONAL EXISTS ONLY TO CARRY THIS AMBIGUITY — an instant retires it entirely');

  // And the two kills land on opposite sides, which is the thing that was
  // unknowable before.
  const hate = after.cells.find((c) => c.label === 'Plane of Hate' && c.difficulty === 3);
  const vox = after.cells.find((c) => c.label === 'Lady Vox' && c.difficulty === 3);
  assert.equal(hate.state, 'open', '06:00 is BEFORE a 12:00 reset — last period, still owed');
  assert.equal(vox.state, 'completed', '20:00 is AFTER it — done this period');
  assert.equal(vox.completedAt, '2026-08-18 20:10:00');

  // THE CONSTANT STAYS IN ITS ONE ATTRIBUTED FIELD. Reading RESET_RULE.hour is
  // the permitted case; copying its value into the output is not.
  const json = JSON.stringify({ ...after, resetRule: null });
  assert.ok(!/"hour"\s*:\s*12/.test(json), 'the hour must not leak outside resetRule');
});

test('A SOLO INSTANCE IS FLAGGED `solo`, which is the only signal that Solo content exists', () => {
  // FOUND BY analysis/mutation-check.js. Replacing `solo: /Solo/.test(...)`
  // with a constant `false` left all 125 tests green.
  //
  // WHY IT MATTERS MORE THAN AN UNUSED FIELD. `- Solo` is deliberately modelled
  // as nothing: `grep -a -- " - Solo"` returns 0 across all 16 log files, so
  // extending the bare-Group difficulty rule to it would be inventing a number.
  // But the owner's alt+Z window shows a `Solo 3` lock, so Solo instances exist
  // and they lock.
  //
  // `solo` is therefore the ONLY thing in this engine that would let a consumer
  // notice a Solo instance at all. Silently stuck false, the engine loses its
  // single signal that a known gap is being hit — and the gap is one we have
  // published as known.
  const solo = core.parseInstanceName("Nagafen's Lair - Solo 3 (Fused)");
  assert.equal(solo.solo, true);
  assert.equal(solo.group, false);
  assert.equal(solo.difficulty, 3, 'an explicit index is still read from a Solo line');

  // The matched pair: the same shape as Group must NOT be flagged solo.
  const group = core.parseInstanceName("Nagafen's Lair - Group 3 (Fused)");
  assert.equal(group.solo, false);
  assert.equal(group.group, true);

  // And a bare `- Solo` gets NO difficulty, unlike bare `- Group`, because the
  // convention was never measured for it. This is the asymmetry, asserted.
  const bare = core.parseInstanceName('The Plane of Fear - Solo');
  assert.equal(bare.solo, true);
  assert.equal(bare.difficulty, null,
    'bare `- Solo` must not inherit the bare `- Group` rule — zero observations');
  assert.equal(bare.difficultyFromOmission, false);
});

// --- Provenance pass of analysis/mutation-check.js, 31 Aug: two blind spots ---

test('AN EMPTY STATE REPORTS COVERAGE AS `not recorded`, NEVER observed-empty', () => {
  // FOUND BLIND. Forcing coverage provenance to 'observed' when nothing has
  // been seen left all 126 tests green.
  //
  // THE DIFFERENCE IS THE WHOLE PRODUCT. "I looked and the week is empty" and
  // "I have not looked" are opposite claims that render identically once the
  // provenance is stripped — and B, E and C all read this field. A live tailer
  // started mid-session has no history; told `observed`, a consumer would show
  // an empty week as a measured one.
  const empty = core.project(core.createState('Avenrae'), NOW);
  assert.equal(empty.coverage.provenance, 'not recorded');
  assert.equal(empty.coverage.from, null);
  assert.equal(empty.coverage.to, null);

  // The matched pair: once lines ARE seen, it becomes observed and carries the
  // bounds. Without this half the assertion above is satisfied by a constant.
  const seen = core.project(core.applyLines(core.createState('Avenrae'), [
    '[Wed Aug 19 10:00:00 2026] You have entered Nektulos Forest.',
    '[Wed Aug 19 10:20:00 2026] You have entered Nektulos Forest.',
  ]), NOW);
  assert.equal(seen.coverage.provenance, 'observed');
  assert.ok(seen.coverage.from, 'observed coverage must carry its bounds');
});

test('EVERY CELL CARRIES A REASON — a state without a `because` is a verdict', () => {
  // FOUND BLIND. Emptying the `why` on an open cell left all 126 tests green.
  //
  // The `because` string is what a player reads and what makes a cell
  // auditable: "no kill observed since the reset, AND COVERAGE SPANS THE
  // PERIOD" is the difference between an inference and an assertion. A cell
  // that says `open` with no reason is this tool doing the thing it exists to
  // prevent — publishing a verdict without its grounds.
  const st = core.applyLines(core.createState('Avenrae'), heartbeat(15, 21));
  const g = core.projectGrid(st, NOW);
  assert.ok(g.cells.length >= 25, 'precondition: a full grid');
  for (const cell of g.cells) {
    assert.ok(typeof cell.because === 'string' && cell.because.trim().length > 0,
      `every cell must say why; ${cell.label} D${cell.difficulty} (${cell.state}) did not`);
  }
});

test('A GRANT MUST COME AFTER ITS HAIL — causality, not proximity', () => {
  // FOUND BLIND. Replacing the forward-only match with a symmetric
  // Math.abs(a.civil - r.civil) <= GRANT_WINDOW_MS left all 128 tests green.
  //
  // WHY IT IS NOT COSMETIC. `actionability()` counts grants in the period and
  // returns `no` once three are seen. A task assigned moments BEFORE a hail —
  // one belonging to an earlier request, or arriving mid-conversation — would
  // be attributed to that hail as well, counting one grant twice. The cap
  // reaches three early and a reachable raid is reported unactionable.
  //
  // That is the direction this product cannot afford: a false `no` does not
  // produce a visibly wrong answer, it produces a silently shorter list.

  // FORWARD: the task follows the hail by 2 s, inside the 3 s window.
  const forward = core.classifyRequests(core.applyLines(core.createState('Avenrae'), [
    "[Wed Aug 19 10:00:00 2026] You say, 'danger'",
    "[Wed Aug 19 10:00:02 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.",
  ]));
  assert.equal(forward[0].result, 'granted');
  assert.equal(forward[0].boss, 'Lord Nagafen');

  // BACKWARD: the same 2 s gap, the other way round. It must NOT pair.
  const backward = core.classifyRequests(core.applyLines(core.createState('Avenrae'), [
    "[Wed Aug 19 10:00:00 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.",
    "[Wed Aug 19 10:00:02 2026] You say, 'danger'",
  ]));
  assert.equal(backward[0].result, 'unknown',
    'a task assigned BEFORE the hail belongs to an earlier request, not this one');
  assert.equal(backward[0].boss, null);
});
