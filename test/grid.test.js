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
function heartbeat(fromDay, toDay, month = 8, year = 2026) {
  const out = [];
  for (let d = fromDay; d <= toDay; d++) {
    for (const h of [1, 7, 13, 19]) {
      const dt = new Date(Date.UTC(year, month - 1, d, h, 0, 0));
      const p = (n) => String(n).padStart(2, '0');
      out.push(`[${DAYS[dt.getUTCDay()]} ${MONTHS[month - 1]} ${p(d)} ${p(h)}:00:00 ${year}] You have entered Nektulos Forest.`);
    }
  }
  return out;
}

// A Friday. The most recent Tuesday before it is 18 Aug.
const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };

// ---------------------------------------------------------------------------
// The roster
// ---------------------------------------------------------------------------

test('ROSTER: every key is a string the game actually writes', () => {
  // THE FAILURE THIS PREVENTS: an unmatched roster row and a genuinely
  // uncompleted raid render identically. A typo would show an empty row forever
  // and look exactly like the warning this tool exists to give. The evidence
  // file is derived from the real corpus, so a typo fails the build instead.
  assert.equal(core.ROSTER.length, 5);
  for (const entry of core.ROSTER) {
    const found = ROSTER_EVIDENCE.roster.find((r) => r.key === entry.key);
    assert.ok(found, `roster key ${JSON.stringify(entry.key)} is absent from the evidence file`);
    assert.ok(found.exactKills > 0,
      `roster key ${JSON.stringify(entry.key)} matched 0 kills in real data — it is a typo`);
  }
});

test('ROSTER: the three name traps are the game strings, not the owner wording', () => {
  const keys = core.ROSTER.map((r) => r.key);
  assert.ok(keys.includes('Innoruuk, the Prince of Hate'), 'not bare "Innoruuk"');
  assert.ok(keys.includes('Cazic-Thule'), 'hyphenated; "Cazic Thule" returns 0 kills');
  // And the owner's wording survives as a label.
  assert.equal(core.ROSTER.find((r) => r.key === 'Innoruuk, the Prince of Hate').label, 'Innoruuk');
  assert.equal(core.ROSTER.find((r) => r.key === 'Cazic-Thule').label, 'Cazic Thule');
});

test('ROSTER: the match is exact equality, never substring', () => {
  // Measured: names containing "Innoruuk" that are NOT the boss account for
  // 141 kills against the boss's 9. A substring roster over-counts ~15x.
  const inno = ROSTER_EVIDENCE.roster.find((r) => r.label === 'Innoruuk');
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
  assert.equal(new Set(grid.cells.map((c) => c.boss)).size, 5);
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
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Innoruuk');
  assert.equal(row.find((c) => c.difficulty === 3).state, 'completed');
  for (const d of [0, 1, 2, 4]) {
    assert.equal(row.find((c) => c.difficulty === d).state, 'open',
      `D${d} must stay open — completing one tier does not complete the row`);
  }
});

test('GRID: a bare "- Group" kill lands in unknown, NEVER in the D0 cell', () => {
  // The client stated no difficulty. Our own raids-measured.json infers a zero
  // for eight such fights and is wrong to; this module refuses to.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Wed Aug 19 20:00:00 2026] You have entered The Plane of Fear - Group.',
    '[Wed Aug 19 20:30:00 2026] You have slain Cazic-Thule!',

  ]);
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Cazic Thule');
  assert.equal(row.filter((c) => c.state === 'completed').length, 0,
    'an unstated difficulty completes nothing');
  assert.equal(row.find((c) => c.difficulty === 0).state, 'unknown',
    'and it must NOT be reported as D0');
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

test('GRID: a kill on the boundary day is unknown, not completed', () => {
  // The reset HOUR has never been measured, so a Tuesday kill could fall either
  // side of the turnover. Calling it completed would hide a raid the user can
  // still do — the dangerous direction for a tool that exists to prevent that.
  const st = core.createState('Avenrae');
  core.applyLines(st, [
    ...heartbeat(17, 21),
    '[Tue Aug 18 12:00:00 2026] You have entered The Permafrost Caverns - Group 2 (Adaptive).',
    '[Tue Aug 18 12:30:00 2026] Lady Vox has been slain by X!',

  ]);
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Lady Vox' && c.difficulty === 2);
  assert.equal(cell.state, 'unknown');
  assert.match(cell.because, /reset hour is not recorded/);
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
  const row = core.projectGrid(st, NOW).cells.filter((c) => c.label === 'Innoruuk');
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
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Innoruuk' && c.difficulty === 4);
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
  const amb = onDay.cells.find((c) => c.label === 'Innoruuk' && c.difficulty === 3);
  assert.equal(amb.state, 'unknown');
  assert.match(amb.because, /whether the turnover has happened/);

  // Asked about the Monday before, there is no ambiguity: one period, kill in it.
  const before = core.projectGrid(st, { year: 2026, month: 8, day: 17, hour: 12, minute: 0, second: 0 });
  assert.equal(before.period.nowIsOnBoundaryDay, false);
  assert.equal(before.cells.find((c) => c.label === 'Innoruuk' && c.difficulty === 3).state, 'completed');
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
  const cell = core.projectGrid(st, NOW).cells.find((c) => c.label === 'Innoruuk' && c.difficulty === 4);
  assert.equal(cell.state, 'completed');
  assert.equal(cell.repeatKills, 1, 'the repeat is recorded');
  assert.match(cell.because, /kill at D4 on 2026-08-19/, 'the FIRST completion is the one reported');
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
  assert.equal(core.ROSTER.filter((r) => r.weeklyTaskObserved).length, 3,
    'three bosses were observed carrying a weekly IN OUR CORPUS');
  // The field must not be named or read as a claim about the boss.
  for (const r of core.ROSTER) {
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
  assert.match(core.LOCKOUT_MODEL.derivation, /6d exactly|6 days/);
  assert.ok(core.LOCKOUT_MODEL.caveats.length >= 2);
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
