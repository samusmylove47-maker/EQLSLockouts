'use strict';
// THE MATCHED PAIRS FOR `actionability()`.
//
// An interface that has only ever been seen to return `unknown` is not a
// three-way answer, it is a stub with three labels. Every test below exists to
// drive ONE of the three values, and the file fails if any value turns out to
// be unreachable.
//
// This is the fault this project has found in its own instruments four times:
// a detector that cannot return one of its answers. It is cheaper to prove the
// reachability now than to discover at 02:00 that `no` was decorative.

const test = require('node:test');
const assert = require('node:assert');
const core = require('../src/lockoutCore.js');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p = (n) => String(n).padStart(2, '0');

function line(day, h, m, text, s = 0, month = 8, year = 2026) {
  const x = new Date(Date.UTC(year, month - 1, day, h, m, s));
  return `[${DAYS[x.getUTCDay()]} ${MONTHS[month - 1]} ${p(day)} ` +
         `${p(h)}:${p(m)}:${p(s)} ${year}] ${text}`;
}

// Contiguous coverage so cells are not `not_looked`.
//
// THE INTERVAL IS LOAD-BEARING AND WAS WRONG FIRST TIME. `SPAN_GAP_MS` is 30
// minutes: points further apart than that do not merge, so a 120-minute
// heartbeat produced 12 ZERO-WIDTH spans per day, an observed fraction of ~0,
// and every cell read `not_looked`. Five tests failed against the fixture
// rather than against the code. Emit inside the merge window or the fixture is
// measuring nothing.
const HEARTBEAT_INTERVAL_MIN = 20;            // < SPAN_GAP_MS (30 min)
function heartbeat(fromDay, toDay) {
  const out = [];
  for (let d = fromDay; d <= toDay; d++) {
    for (let m = 0; m < 1440; m += HEARTBEAT_INTERVAL_MIN) {
      out.push(line(d, Math.floor(m / 60), m % 60, 'You have entered Nektulos Forest.'));
    }
  }
  return out;
}

// A grant: the hail, then the task.
//
// THE OFFSETS ARE SECONDS AND THAT IS NOT A DETAIL. `GRANT_WINDOW_MS` is 3000
// and `CONTROL_AFTER_MS` is 5000 — three and five SECONDS. A first version of
// this file put the task one MINUTE after the hail and every pairing silently
// came back `unknown`, which read as the engine failing when it was the fixture
// being unrealistic. The real corpus pairs these within a second or two.
function grant(day, h, boss) {
  return [
    line(day, h, 0, "You say, 'danger'", 0),
    line(day, h, 0, `You have been assigned the task 'Potential of the Void - ${boss} - Weekly'.`, 2),
  ];
}

// A refusal: the hail, plus the Voidling closing line as the positive control.
function refusal(day, h) {
  return [
    line(day, h, 0, "You say, 'danger'", 0),
    line(day, h, 0, "Voidling says, 'Your hubris risks our very reality itself.'", 3),
  ];
}

// Friday 21 Aug. The most recent Tuesday before it is 18 Aug — the boundary day.
const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };
const NAG = "Nagafen's Lair";

const build = (lines) => core.applyLines(core.createState('Avenrae'), lines);

// ---------------------------------------------------------------------------
// THE THREE VALUES MUST EACH BE REACHABLE
// ---------------------------------------------------------------------------

test('`no` IS REACHABLE — three grants this period spends the cap', () => {
  const st = build([
    ...heartbeat(15, 21),
    ...grant(19, 10, 'Lord Nagafen'),
    ...grant(19, 12, 'Lady Vox'),
    ...grant(20, 10, 'Master Yael'),
  ]);
  const r = core.actionability(st, NOW, { raid: NAG, difficulty: 3 });

  assert.equal(r.answer, 'no', `expected no; got ${r.answer} — ${r.because}`);
  assert.equal(r.gates.tokenCap.grantsObserved, 3);
  assert.equal(r.gates.tokenCap.spent, true);
  assert.equal(r.unknownKind, null, '`no` is an answer, not a kind of not-knowing');
});

test('`yes` IS REACHABLE — tokens remain and the raid is reachable', () => {
  const st = build([
    ...heartbeat(15, 21),
    ...grant(19, 10, 'Lord Nagafen'),
  ]);
  const r = core.actionability(st, NOW, { raid: NAG, difficulty: 3 });

  assert.equal(r.answer, 'yes', `expected yes; got ${r.answer} — ${r.because}`);
  assert.equal(r.gates.tokenCap.grantsObserved, 1);
  assert.equal(r.gates.tokenCap.spent, false);
});

test('`unknown` IS REACHABLE — and it is LOUD, not falsy', () => {
  const st = build([]);                       // nothing seen at all
  const r = core.actionability(st, NOW, { raid: NAG, difficulty: 3 });

  assert.equal(r.answer, 'unknown');
  assert.equal(r.unknownKind, 'coverage');
  // THE RULING: not-knowing must not be falsy. A caller writing `if (r.answer)`
  // must not get a value that quietly reads as "no".
  assert.ok(r.answer, 'the not-knowing value must be truthy so it cannot be skipped');
  assert.notEqual(r.answer, false);
  assert.match(r.because, /MORE LOG WOULD FIX THIS/);
});

// ---------------------------------------------------------------------------
// THE PAIR THAT MATTERS MOST: the cap and the grid are different systems
// ---------------------------------------------------------------------------

test('A BOSS OPEN ON THE GRID WHILE THE CAP IS SPENT ANSWERS `no`', () => {
  // This is the recommendation that loses trust in one click: the grid says
  // "Nagafen is open, go and farm it" while the player has no tokens left.
  const lines = [
    ...heartbeat(15, 21),
    ...grant(19, 10, 'Lady Vox'),
    ...grant(19, 12, 'Master Yael'),
    ...grant(20, 10, 'Innoruuk'),
  ];
  const st = build(lines);

  const grid = core.projectGrid(st, NOW);
  const cell = grid.cells.find((c) => c.raid === NAG && c.difficulty === 3);
  assert.equal(cell.state, 'open', 'precondition: the grid must say OPEN here');

  const r = core.actionability(st, NOW, { raid: NAG, difficulty: 3 });
  assert.equal(r.answer, 'no',
    'the grid says open and the cap is spent — the cap decides');
  assert.match(r.because, /cap/i);
});

test('A REFUSED HAIL WITH A POSITIVE CONTROL ANSWERS `no`, and says it is about the CAP', () => {
  const st = build([
    ...heartbeat(15, 21),
    ...refusal(20, 14),
  ]);
  const r = core.actionability(st, NOW, { raid: NAG, difficulty: 3 });

  assert.equal(r.answer, 'no');
  assert.equal(r.gates.tokenCap.refusedWithPositiveControl, true);
  assert.match(r.because, /never about this boss/,
    'a refusal is a statement about the allowance, not about the boss');
});

// ---------------------------------------------------------------------------
// `completed` MUST NOT BLOCK — repeats still pay a drop
// ---------------------------------------------------------------------------

test('A COMPLETED CELL IS STILL ACTIONABLE — a locked-out kill pays a drop', () => {
  const lines = [
    ...heartbeat(15, 21),
    ...grant(19, 10, 'Lord Nagafen'),
    line(19, 11, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."),
    line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!'),
  ];
  const st = build(lines);

  const grid = core.projectGrid(st, NOW);
  const cell = grid.cells.find((c) => c.raid === NAG && c.difficulty === 3);
  assert.equal(cell.state, 'completed', 'precondition: the cell must be completed');

  const r = core.actionability(st, NOW, { raid: NAG, difficulty: 3 });
  assert.equal(r.answer, 'yes',
    'mapping completed -> unactionable would delete real upgrades from the ranking');
  assert.match(r.because, /guaranteed drop/);
});

// ---------------------------------------------------------------------------
// THE SEAM — no item ids
// ---------------------------------------------------------------------------

test('AN ITEM ID IS REFUSED, and the error says where the seam is', () => {
  const st = build(heartbeat(15, 21));
  assert.throws(
    () => core.actionability(st, NOW, { item: 'Cloak of Flames' }),
    (e) => e instanceof TypeError && /no loot table/.test(e.message));
  assert.throws(
    () => core.actionability(st, NOW, { itemId: 12345 }),
    (e) => e instanceof TypeError);
});

test('AN UNKNOWN RAID IS `unknown`, NOT `no`', () => {
  // The roster is evidence of structure, not a list of what exists. Answering
  // `no` here would assert the raid does not exist, which we cannot source.
  const st = build(heartbeat(15, 21));
  const r = core.actionability(st, NOW, { raid: 'The Plane of Sky', difficulty: 3 });
  assert.equal(r.answer, 'unknown');
  assert.equal(r.unknownKind, 'raid-not-in-roster');
});

// ---------------------------------------------------------------------------
// THE LIMIT MUST TRAVEL WITH EVERY ANSWER
// ---------------------------------------------------------------------------

test('EVERY answer carries what it does NOT answer', () => {
  const st = build([...heartbeat(15, 21), ...grant(19, 10, 'Lord Nagafen')]);
  for (const d of [0, 1, 2, 3, 4]) {
    const r = core.actionability(st, NOW, { raid: NAG, difficulty: d });
    assert.match(r.doesNotAnswer, /LOOT lockout/,
      'the loot lockout is not in any log and every answer must say so');
    assert.ok(['yes', 'no', 'unknown'].includes(r.answer), 'three-way only');
    assert.notEqual(typeof r.answer, 'boolean', 'NEVER a boolean');
  }
});

test('the token cap ships its own sample size', () => {
  assert.equal(core.TOKEN_CAP.tokens, 3);
  assert.equal(core.TOKEN_CAP.sampleCharacterWeeks, 3);
  assert.match(core.TOKEN_CAP.caveat, /n=3/,
    'a cap measured over three character-weeks must say so where it is read');
});
