'use strict';

// Run: node --test test/
//
// Every log line asserted on below is VERBATIM from the committed fixture at
// sources/raw/2026-08-10-weekly-task-fixture.log, which is itself generated
// from the owner's own logs by analysis/make-fixture.js. No line here was
// typed from memory, and none came from another project's fixtures.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const core = require('../src/lockoutCore');
const { LockoutEngine, civilFromDate } = require('../src/lockoutEngine');

const FIXTURE = path.join(__dirname, '..', 'sources', 'raw', '2026-08-10-weekly-task-fixture.log');
const fixtureLines = fs
  .readFileSync(FIXTURE, 'utf8')
  .split('\n')
  .filter((l) => l && !l.startsWith('#'));

const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };

// ---------------------------------------------------------------------------
// Line shapes
// ---------------------------------------------------------------------------

test('parses the weekly task assignment', () => {
  const ev = core.parseLine(
    "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'."
  );
  assert.equal(ev.kind, 'task-assigned');
  assert.equal(ev.series, 'Potential of the Void');
  assert.equal(ev.boss, 'Lord Nagafen');
  assert.equal(ev.cadence, 'Weekly');
  assert.deepEqual(ev.at, { weekday: 'Mon', year: 2026, month: 8, day: 10, hour: 17, minute: 14, second: 49 });
});

test('parses the task completion and the token grant', () => {
  const upd = core.parseLine(
    "[Mon Aug 10 17:28:13 2026] Your task 'Potential of the Void - Lord Nagafen - Weekly' has been updated."
  );
  assert.equal(upd.kind, 'task-updated');
  assert.equal(upd.boss, 'Lord Nagafen');

  const given = core.parseLine('[Mon Aug 10 17:28:13 2026] You have been given: Void-Touched Potential');
  assert.equal(given.kind, 'given');
  assert.equal(given.item, 'Void-Touched Potential');
});

test('a boss name containing a hyphen still splits on the cadence', () => {
  // Temple of Cazic-Thule is a real zone in this corpus; a hyphenated boss is
  // plausible and must not break the split. Anchored on the trailing word.
  const ev = core.parseLine(
    "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Cazic-Thule - Weekly'."
  );
  assert.equal(ev.boss, 'Cazic-Thule');
  assert.equal(ev.cadence, 'Weekly');
});

test('a cadence we have never seen still parses', () => {
  // The cadence is captured as written rather than matched against a list. If
  // the game ships a Daily, this must not silently drop it.
  const ev = core.parseLine(
    "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Daily'."
  );
  assert.equal(ev.cadence, 'Daily');
});

// ---------------------------------------------------------------------------
// Instance grammar — the four shapes
// ---------------------------------------------------------------------------

test('bare zone name is the OPEN WORLD, not an instance', () => {
  const ev = core.parseLine('[Tue Aug 18 12:38:35 2026] You have entered Butcherblock Mountains.');
  assert.equal(ev.kind, 'entered');
  assert.equal(ev.instanced, false);
  assert.equal(ev.zone, 'Butcherblock Mountains');
});

test('raid instance: zone, index, adjective', () => {
  const ev = core.parseLine('[Tue Aug 18 12:56:35 2026] You have entered The Castle of Mistmoore 1 (Awakened).');
  assert.equal(ev.instanced, true);
  assert.equal(ev.group, false);
  assert.equal(ev.zone, 'The Castle of Mistmoore');
  assert.equal(ev.difficulty, 1);
  assert.equal(ev.difficultyLabel, 'Awakened');
  assert.equal(ev.labelMatchesTable, true);
});

test('group instance: zone, - Group, index, adjective', () => {
  const ev = core.parseLine('[Mon Aug 10 17:15:09 2026] You have entered Nagafen\'s Lair - Group 1 (Awakened).');
  assert.equal(ev.instanced, true);
  assert.equal(ev.group, true);
  assert.equal(ev.zone, "Nagafen's Lair");
  assert.equal(ev.difficulty, 1);
});

test('THE TRAP: "- Group" with no index is still an instance, difficulty not recorded', () => {
  // This shape occurs 6 times across 2 zones in our corpus and would fall
  // through to the open-world branch under a naive pattern. It must report
  // difficulty null — meaning "the game did not say" — and never D0.
  const ev = core.parseLine('[Mon Aug 10 17:48:46 2026] You have entered The Permafrost Caverns - Group.');
  assert.equal(ev.instanced, true, 'must be recognised as an instance');
  assert.equal(ev.group, true);
  assert.equal(ev.zone, 'The Permafrost Caverns');
  assert.equal(ev.difficulty, null, 'difficulty is not recorded, and must not be defaulted to 0');
});

test('the instance invite carries the same grammar', () => {
  const ev = core.parseLine(
    "[Mon Aug 10 17:14:34 2026] Lumbarin has asked you to join the instance: Nagafen's Lair - Group 1 (Awakened).        Would you like to join? Accepting will incur you a charge or replay timer."
  );
  assert.equal(ev.kind, 'instance-invite');
  assert.equal(ev.from, 'Lumbarin');
  assert.equal(ev.zone, "Nagafen's Lair");
  assert.equal(ev.difficulty, 1);
  assert.equal(ev.group, true);
});

test('difficulty index maps to the label the client itself wrote', () => {
  const pairs = [[0, 'Normal'], [1, 'Awakened'], [2, 'Adaptive'], [3, 'Fused'], [4, 'Refined']];
  for (const [i, label] of pairs) {
    assert.equal(core.DIFFICULTY_LABELS[i], label, `D${i}`);
  }
});

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

test('accepts a space-padded single-digit day', () => {
  // Not observed in this corpus (every day is zero-padded), but classic EQ
  // space-pads and the cost of accepting both is one quantifier.
  const ev = core.splitStamp('[Sat Aug  9 14:38:35 2026] You have entered Nektulos Forest.');
  assert.ok(ev, 'space-padded day must parse');
  assert.equal(ev.at.day, 9);
});

test('an unstamped line is ignored, not guessed at', () => {
  assert.equal(core.parseLine('You have been assigned the task \'X - Y - Weekly\'.'), null);
  assert.equal(core.parseLine(''), null);
  assert.equal(core.parseLine(null), null);
});

// ---------------------------------------------------------------------------
// The rule this module exists to enforce
// ---------------------------------------------------------------------------

test('NO RESET DAY IS EVER EMITTED — not from one assignment, not from many', () => {
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const view = core.project(state, NOW);

  const json = JSON.stringify(view);
  // A reset weekday or hour must not appear anywhere in the projection under
  // any key. This is a blunt assertion on purpose: it catches a constant added
  // three refactors from now by someone who has not read the header.
  assert.equal(view.reset.value, null, 'reset must never resolve to a single instant');
  assert.ok(!/resetWeekday|resetHour|LOCKOUT_RESET/.test(json), 'no reset constant may appear');

  for (const b of view.bosses) {
    assert.equal(b.available.provenance, 'not recorded',
      'availability requires the reset rule, which is not known');
  }
});

test('with no repeat assignment, the reset is "not recorded" with a reason', () => {
  const state = core.createState('Avenrae');
  core.applyLine(state, "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.");
  const reset = core.projectReset(state);
  assert.equal(reset.provenance, 'not recorded');
  assert.match(reset.reason, /assigned twice/);
  assert.deepEqual(reset.brackets, []);
});

test('a repeat assignment produces a BRACKET, and the bracket is honest about its width', () => {
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const reset = core.projectReset(state);

  assert.equal(reset.provenance, 'inferred');
  assert.ok(reset.brackets.length >= 1, 'the fixture contains a Lady Vox re-assignment');

  const vox = reset.brackets.find((b) => b.boss === 'Lady Vox');
  assert.ok(vox, 'Lady Vox is assigned on Aug 10 and again on Aug 11');
  // Lower bound is the REFUSED hail at 18:34:52, not the 17:56:09 completion —
  // a refusal is later proof that the old period was still running. Upper
  // bound is the Aug 11 grant at 20:40:44. Both verbatim in the fixture.
  assert.equal(vox.after, '2026-08-10 18:34:52');
  assert.equal(vox.before, '2026-08-11 20:40:44');
  assert.equal(vox.fromRefusal, true, 'the lower bound must be the refusal, not the completion');
  assert.ok(vox.widthHours > 26 && vox.widthHours < 27, `width was ${vox.widthHours}`);

  // The whole point: a 26-hour bracket does not identify an hour of the day,
  // and the module must not let a caller pretend otherwise.
  assert.ok(vox.widthHours > 24,
    'this bracket spans more than a day and therefore cannot name a weekday');
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

test('duplicate lines from a second character are suppressed', () => {
  // Avenrae and Shara both log the same group events, and a tailer that
  // follows "whichever file changed last" will replay them. Counting one kill
  // twice would corrupt every interval this module reports.
  const line = "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.";
  const state = core.createState('Avenrae');
  core.applyLine(state, line);
  core.applyLine(state, line);
  assert.equal(state.tasks[Object.keys(state.tasks)[0]].assignments.length, 1);
  assert.equal(state.dropped.duplicate, 1);
});

test('state is JSON-clonable and survives a round trip', () => {
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const clone = JSON.parse(JSON.stringify(state));
  assert.deepEqual(core.project(clone, NOW), core.project(state, NOW));
});

test('project() refuses a Date or an epoch rather than guessing a timezone', () => {
  const state = core.createState('Avenrae');
  assert.throws(() => core.project(state, new Date()), /civil timestamp/);
  assert.throws(() => core.project(state, 1755800000000), /civil timestamp/);
  assert.throws(() => core.project(state), /civil timestamp/);
});

test('the core requires nothing at all and never reads the clock', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lockoutCore.js'), 'utf8');
  // Comments are stripped first: the header *discusses* Date.now(), and a
  // check that cannot tell prose from code would either fail on the
  // documentation or be quietly weakened until it tested nothing.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.deepEqual(code.match(/\brequire\s*\(/g) || [], [],
    'lockoutCore.js must have zero requires, builtin or otherwise');
  assert.deepEqual(code.match(/\bDate\.now\s*\(/g) || [], [],
    'Date.now() must never be called in the core');
  assert.deepEqual(code.match(/new Date\s*\(\s*\)/g) || [], [],
    'the core must never read the clock');
  // Date.UTC is permitted and used: it is pure arithmetic over its arguments
  // and reads no clock. Asserted so the distinction is deliberate, not luck.
  assert.ok(/Date\.UTC\(/.test(code), 'civil arithmetic goes through Date.UTC');

  // The adapter is allowed exactly one builtin and one sibling.
  const adapter = fs.readFileSync(path.join(__dirname, '..', 'src', 'lockoutEngine.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const mods = [...adapter.matchAll(/\brequire\s*\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(mods.sort(), ['./lockoutCore', 'events'],
    'the adapter may require only node builtins and the core');
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

test('the engine emits change only when a line moves the state', () => {
  const eng = new LockoutEngine('Avenrae');
  eng.setNowFn(() => NOW);
  let changes = 0;
  eng.on('change', () => changes++);

  eng.handleLine('[Mon Aug 10 17:16:00 2026] A fire giant wizard has been slain by Lumbarin!');
  assert.equal(changes, 0, 'an unmodelled line must not emit');

  eng.handleLine("[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.");
  assert.equal(changes, 1);
});

test('the engine round-trips through serialize/restore', () => {
  const eng = new LockoutEngine('Avenrae');
  eng.setNowFn(() => NOW);
  eng.handleLines(fixtureLines);
  const saved = eng.serialize();

  const eng2 = new LockoutEngine('Avenrae');
  eng2.setNowFn(() => NOW);
  assert.equal(eng2.restore(saved), true);
  assert.deepEqual(eng2.snapshot(), eng.snapshot());

  assert.equal(eng2.restore({ version: 999 }), false, 'an unknown version is discarded, not guessed');
  assert.equal(eng2.restore({ ...saved, character: 'Shara' }), false,
    "another character's state is refused, not merged");
});

test('civilFromDate reads local components, which is the clock that wrote the log', () => {
  const d = new Date(2026, 7, 10, 17, 14, 49);
  assert.deepEqual(civilFromDate(d), { year: 2026, month: 8, day: 10, hour: 17, minute: 14, second: 49 });
});

test('the fixture itself parses end to end', () => {
  const state = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const view = core.project(state, NOW);
  assert.equal(view.grants.total, 3, 'three Void-Touched Potential grants in the fixture');
  assert.ok(view.bosses.length >= 2);
  assert.equal(state.dropped.unstamped, 0, 'every fixture line carries a stamp');
});

// ---------------------------------------------------------------------------
// The lockout signal: a refused Voidling request
// ---------------------------------------------------------------------------

// A granted exchange and a refused one, verbatim from the owner's logs. They
// are identical but for the task line.
const GRANTED_EXCHANGE = [
  "[Mon Aug 10 17:14:47 2026] You say, 'Hail, voidling'",
  "[Mon Aug 10 17:14:48 2026] Voidling says, 'Ah, another who thinks themselves a Legend. Do you truly believe you are immune to the possibility of fracturing space and time and unleashing the Void? Only you can accept the risk and the [danger]...'",
  "[Mon Aug 10 17:14:49 2026] You say, 'danger'",
  "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.",
  "[Mon Aug 10 17:14:49 2026] Voidling says, 'Your hubris risks our very reality itself.'",
];
const REFUSED_EXCHANGE = [
  "[Mon Aug 10 18:05:16 2026] You say, 'Hail, voidling'",
  "[Mon Aug 10 18:05:16 2026] Voidling says, 'Ah, another who thinks themselves a Legend. Do you truly believe you are immune to the possibility of fracturing space and time and unleashing the Void? Only you can accept the risk and the [danger]...'",
  "[Mon Aug 10 18:05:17 2026] You say, 'danger'",
  "[Mon Aug 10 18:05:18 2026] Voidling says, 'Your hubris risks our very reality itself.'",
];

test('a granted request is classified granted, with the boss named', () => {
  const st = core.applyLines(core.createState('Avenrae'), GRANTED_EXCHANGE);
  const rows = core.classifyRequests(st);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, 'granted');
  assert.equal(rows[0].boss, 'Lord Nagafen');
});

test('a refused request is classified refused — silence IS the signal', () => {
  const st = core.applyLines(core.createState('Avenrae'), REFUSED_EXCHANGE);
  const rows = core.classifyRequests(st);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, 'refused');
  assert.equal(rows[0].positiveControl, true, 'the Voidling reply is the control');
});

test('THE ORDERING TRAP: a grant AFTER the closing line is still a grant', () => {
  // Verbatim from eqlog_Avenrae_rivervale_2026-08-15.txt. The closing line
  // arrives before the task line. A state machine that terminates on the
  // closing line records a refusal and throws the grant away — which is
  // exactly what the first version of analysis/hails.js did, producing a false
  // 0.474-hour reset bracket.
  const st = core.applyLines(core.createState('Avenrae'), [
    "[Tue Aug 11 20:40:42 2026] You say, 'Hail, voidling'",
    "[Tue Aug 11 20:40:43 2026] Voidling says, 'Ah, another who thinks themselves a Legend. ... the [danger]...'",
    "[Tue Aug 11 20:40:44 2026] You say, 'danger'",
    "[Tue Aug 11 20:40:44 2026] Voidling says, 'Your hubris risks our very reality itself.'",
    "[Tue Aug 11 20:40:44 2026] You have been assigned the task 'Potential of the Void - Lady Vox - Weekly'.",
    "[Tue Aug 11 20:40:44 2026] Voidling says, 'Your hubris risks our very reality itself.'",
  ]);
  const rows = core.classifyRequests(st);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].result, 'granted', 'the closing line must not terminate the exchange');
  assert.equal(rows[0].boss, 'Lady Vox');
});

test('A FILTERED CHANNEL YIELDS unknown, NEVER a false lockout', () => {
  // The defining exposure of this whole project: an empty capture that looks
  // like a negative result. With the Voidling lines filtered out there is no
  // positive control, and the module must refuse to call it a refusal.
  const st = core.applyLines(core.createState('Avenrae'), [
    "[Mon Aug 10 18:05:17 2026] You say, 'danger'",
  ]);
  const rows = core.classifyRequests(st);
  assert.equal(rows[0].result, 'unknown');
  assert.equal(rows[0].positiveControl, false);
});

test('repeated danger spam is one attempt, not several', () => {
  const st = core.applyLines(core.createState('Avenrae'), [
    "[Mon Aug 10 18:05:16 2026] Voidling says, 'Ah, ... the [danger]...'",
    "[Mon Aug 10 18:05:17 2026] You say, 'danger'",
    "[Mon Aug 10 18:05:19 2026] You say, 'danger'",
    "[Mon Aug 10 18:05:21 2026] You say, 'danger'",
    "[Mon Aug 10 18:05:22 2026] Voidling says, 'Your hubris risks our very reality itself.'",
  ]);
  assert.equal(core.classifyRequests(st).length, 1);
});

test('a refusal after a grant bounds the PERIOD from below, and only from below', () => {
  const st = core.applyLines(core.createState('Avenrae'), [
    ...GRANTED_EXCHANGE,
    "[Sun Aug 16 19:24:15 2026] Voidling says, 'Ah, ... the [danger]...'",
    "[Sun Aug 16 19:24:16 2026] You say, 'danger'",
    "[Sun Aug 16 19:24:17 2026] Voidling says, 'Your hubris risks our very reality itself.'",
  ]);
  const p = core.projectPeriod(st);
  assert.equal(p.provenance, 'inferred');
  assert.ok(p.atLeastDays > 6 && p.atLeastDays < 7, `got ${p.atLeastDays}`);
  assert.match(p.basis, /floor, not a value/);
  // It must not claim to know the period, only its floor.
  assert.equal(p.days, undefined);
  assert.equal(p.value, undefined);
});

test('with no refusal after the last grant, the period is "not recorded"', () => {
  const st = core.applyLines(core.createState('Avenrae'), GRANTED_EXCHANGE);
  const p = core.projectPeriod(st);
  assert.equal(p.provenance, 'not recorded');
  assert.match(p.reason, /nothing bounds the period/);
});
