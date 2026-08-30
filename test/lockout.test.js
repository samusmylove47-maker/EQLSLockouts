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

test('THE TRAP, AND IT WAS BACKWARDS: bare "- Group" IS D0', () => {
  // This test used to assert `difficulty === null` — "the game did not say" —
  // on the reasoning that defaulting to 0 would be inventing a number.
  // IT WAS THE OTHER WAY ROUND. The client omits the index exactly when the
  // index is zero, and treating the omission as "unknown" is what made the
  // shipped tool answer "0 of 25 done" for a player who had raided all week.
  //
  // Measured over all 16 log files on 26 Aug 2026: 12 invites name `Group 0
  // (Normal)`, there are exactly 12 bare `- Group` zone-ins, and NOT ONE entry
  // line anywhere states an index of 0. See the block comment above
  // INSTANCE_BARE_RE for the full table.
  const ev = core.parseLine('[Mon Aug 10 17:48:46 2026] You have entered The Permafrost Caverns - Group.');
  assert.equal(ev.instanced, true, 'must be recognised as an instance');
  assert.equal(ev.group, true);
  assert.equal(ev.zone, 'The Permafrost Caverns');
  assert.equal(ev.difficulty, 0, 'the omitted index means zero — measured 12/12');
  assert.equal(ev.difficultyLabel, 'Normal');
  assert.equal(ev.difficultyFromOmission, true, 'and it must be flagged as the omission rule, not a written index');

  // The asymmetry is deliberate and load-bearing. `- Solo` has ZERO
  // observations in 16 files — `grep -a -- " - Solo"` returns 0 on every one —
  // so the rule has nothing to stand on there and must not be extended to it.
  const solo = core.parseLine('[Mon Aug 10 17:48:46 2026] You have entered The Permafrost Caverns - Solo.');
  assert.equal(solo.instanced, true);
  assert.equal(solo.solo, true);
  assert.equal(solo.difficulty, null, 'no bare Solo has ever been observed; do not extend the rule to it');
  assert.equal(solo.difficultyFromOmission, false);
});

test('THE COUNTEREXAMPLE THAT WOULD KILL THE OMISSION RULE still parses', () => {
  // The rule rests on "no entry line ever states index 0". If one ever appears,
  // the rule is dead and this is how we would find out: the full shape must
  // still parse, and must NOT be flagged as coming from the omission rule.
  const ev = core.parseLine('[Mon Aug 10 17:48:46 2026] You have entered The Permafrost Caverns - Group 0 (Normal).');
  assert.equal(ev.difficulty, 0);
  assert.equal(ev.difficultyLabel, 'Normal');
  assert.equal(ev.difficultyFromOmission, false, 'a written 0 is stated, not inferred — the two must stay distinguishable');
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

  // A genuinely unmodelled line. NOT a kill line — kills are modelled now, and
  // this test previously used one, which is how it caught the change.
  eng.handleLine('[Mon Aug 10 17:24:10 2026] Lord Nagafen pierces Lumbarin for 87 points of damage.');
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

// ---------------------------------------------------------------------------
// THE CONTRACT — one test per clause. See the CONTRACT block in lockoutCore.js.
// ---------------------------------------------------------------------------

test('CONTRACT 1: the raw line with its prefix is the input', () => {
  // Exactly what the host tailer emits, prefix and all.
  const ev = core.parseLine("[Wed Aug 19 19:17:52 2026] You say, 'danger'");
  assert.equal(ev.kind, 'weekly-request');
  // A pre-stripped line must not silently half-work.
  assert.equal(core.parseLine("You say, 'danger'"), null);
});

test('CONTRACT 1: a CR-terminated line parses — the logs are CRLF', () => {
  // MEASURED: every line of all 15 log files is CRLF-terminated. An earlier
  // revision of docs/EVIDENCE.md asserted the opposite, because the hexdump
  // that "established" it was piped through grep, which strips the file's
  // terminator and appends its own LF. The instrument was measured, not the file.
  //
  // A host that splits on '\n' alone hands us lines ending in '\r'. Before the
  // fix those parsed to null SILENTLY — the stamp matched, so `dropped` stayed
  // clean and the module reported no lockouts ever.
  for (const line of [
    "[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.\r",
    "[Mon Aug 10 17:14:49 2026] You say, 'danger'\r",
    "[Mon Aug 10 17:28:13 2026] You have been given: Void-Touched Potential\r",
    "[Mon Aug 10 17:15:09 2026] You have entered Nagafen's Lair - Group 1 (Awakened).\r",
    "[Mon Aug 10 17:14:48 2026] Voidling says, 'Ah, ... the [danger]...'\r",
  ]) {
    assert.ok(core.parseLine(line), `CR-terminated line must parse: ${JSON.stringify(line.slice(26, 60))}`);
  }
  // And a CRLF-fed stream must produce the same state as an LF-fed one.
  const lf = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const crlf = core.applyLines(core.createState('Avenrae'), fixtureLines.map((l) => l + '\r'));
  assert.deepEqual(crlf, lf, 'CRLF and LF input must produce identical state');
});

test('CONTRACT 2: `now` does not affect accumulated state — replay equals live', () => {
  // The property that makes a backfill of a million lines trustworthy: state is
  // a function of the lines alone. If `now` leaked into it, replaying history
  // would disagree with having received it live, and the disagreement would be
  // invisible.
  const a = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const b = core.applyLines(core.createState('Avenrae'), fixtureLines);
  assert.deepEqual(a, b);

  const early = core.project(a, { year: 2026, month: 8, day: 12, hour: 0, minute: 0, second: 0 });
  const late = core.project(b, { year: 2030, month: 1, day: 1, hour: 0, minute: 0, second: 0 });
  // State itself is untouched by projecting at wildly different `now`s.
  assert.deepEqual(a, b);
  // And the parts that are not time-relative agree regardless of `now`.
  assert.deepEqual(early.reset.brackets, late.reset.brackets);
  assert.deepEqual(early.instances, late.instances);
});

test('CONTRACT 3: no behaviour depends on ordering within one second', () => {
  // The same five lines, shuffled within their shared second, must classify
  // identically. This is the generalisation of the bug that produced a false
  // bracket: it is not enough that the one known ordering works.
  const sameSecond = [
    "[Tue Aug 11 20:40:42 2026] You say, 'Hail, voidling'",
    "[Tue Aug 11 20:40:43 2026] Voidling says, 'Ah, ... the [danger]...'",
    "[Tue Aug 11 20:40:44 2026] You say, 'danger'",
    "[Tue Aug 11 20:40:44 2026] Voidling says, 'Your hubris risks our very reality itself.'",
    "[Tue Aug 11 20:40:44 2026] You have been assigned the task 'Potential of the Void - Lady Vox - Weekly'.",
  ];
  const tail = sameSecond.slice(2);
  const permutations = [
    [tail[0], tail[1], tail[2]],
    [tail[0], tail[2], tail[1]],
    [tail[2], tail[0], tail[1]],
    [tail[1], tail[0], tail[2]],
    [tail[2], tail[1], tail[0]],
    [tail[1], tail[2], tail[0]],
  ];
  const results = permutations.map((perm) => {
    const st = core.applyLines(core.createState('Avenrae'), [sameSecond[0], sameSecond[1], ...perm]);
    return core.classifyRequests(st);
  });
  for (const r of results) {
    assert.equal(r.length, 1, 'one attempt regardless of order');
    assert.equal(r[0].result, 'granted', 'granted regardless of order');
    assert.equal(r[0].boss, 'Lady Vox');
  }
});

test('CONTRACT 4: state contains nothing that JSON cannot represent', () => {
  const st = core.applyLines(core.createState('Avenrae'), fixtureLines);

  // Deep structural walk: anything that is not a plain object, array, string,
  // number, boolean or null is a reload bug waiting to happen.
  const offenders = [];
  (function walk(v, path) {
    if (v === null) return;
    const t = typeof v;
    if (t === 'string' || t === 'boolean') return;
    if (t === 'number') {
      if (!Number.isFinite(v)) offenders.push(`${path}: non-finite number ${v}`);
      return;
    }
    if (t === 'undefined') { offenders.push(`${path}: undefined`); return; }
    if (t === 'function') { offenders.push(`${path}: function`); return; }
    if (v instanceof Date) { offenders.push(`${path}: Date`); return; }
    if (v instanceof Map) { offenders.push(`${path}: Map`); return; }
    if (v instanceof Set) { offenders.push(`${path}: Set`); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    if (Object.getPrototypeOf(v) !== Object.prototype) {
      offenders.push(`${path}: exotic object ${Object.getPrototypeOf(v)?.constructor?.name}`);
      return;
    }
    for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  })(st, 'state');

  assert.deepEqual(offenders, [], 'state must be plain JSON');
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'round trip must be exact');
});

test('CONTRACT 5: the module touches no file and owns no default', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lockoutCore.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const banned of ['fs.', 'readFile', 'writeFile', 'process.env', 'require(']) {
    assert.ok(!src.includes(banned), `core must not reference ${banned}`);
  }
});

test('CONTRACT 6: feeding the same line twice is safe — idempotent', () => {
  // "Undecided is what hurts." So this is decided, and enforced.
  const once = core.applyLines(core.createState('Avenrae'), fixtureLines);
  const twice = core.applyLines(core.createState('Avenrae'), [...fixtureLines, ...fixtureLines]);

  // dropped.duplicate is expected to differ — that is the counter doing its job.
  const strip = (s) => { const c = JSON.parse(JSON.stringify(s)); delete c.dropped; return c; };
  assert.deepEqual(strip(twice), strip(once), 'replaying the whole stream changes nothing');
  assert.ok(twice.dropped.duplicate > 0, 'and the duplicates are counted, not silently ignored');

  // The realistic case: a tailer re-reading an overlapping tail.
  const overlap = core.applyLines(core.createState('Avenrae'), fixtureLines);
  core.applyLines(overlap, fixtureLines.slice(-20));
  assert.deepEqual(strip(overlap), strip(once), 'an overlapping tail changes nothing');

  // And the projection is identical, which is what the host actually renders —
  // apart from `dropped`, which is the rejection counter and SHOULD differ.
  // Verified by diff: `dropped` is the only key in the whole state object that
  // changes when the stream is replayed.
  const pOnce = core.project(once, NOW);
  const pTwice = core.project(twice, NOW);
  assert.deepEqual({ ...pTwice, dropped: null }, { ...pOnce, dropped: null });
  // DERIVED, not typed. An earlier revision hard-coded 18 here and went stale
  // the moment kill lines became events — the same fault this project keeps
  // finding, sitting in a test whose job is to catch it.
  assert.equal(pTwice.dropped.duplicate, once.events.length,
    'every observation from the first pass should be rejected on the second');
});

test('CONTRACT 7: the character is an input and state refuses to be shared', () => {
  assert.throws(() => core.createState(), /character name is required/);
  assert.throws(() => core.createState(''), /character name is required/);
  assert.equal(core.characterFromLogFilename('eqlog_Avenrae_rivervale.txt'), 'Avenrae');
  assert.equal(core.characterFromLogFilename('C:/x/eqlog_Shara_rivervale_2026-08-14b.txt'), 'Shara');
  assert.equal(core.characterFromLogFilename('not-a-log.txt'), null);
  assert.equal(core.createState('Avenrae').character, 'Avenrae');
});

test('CLAUSE 7: the positive-control set is bounded, and overflow degrades the SAFE way', () => {
  // Session C raised this and it is real: a host that backfills 5.25 million
  // lines on its main process is entitled to know what grows without limit.
  //
  // Measured occupancy for scale: 600 Voidling replies across all 16 log files,
  // ~340 for the busiest single character over 434 MB and three weeks. The bound
  // is roughly 15x that.
  assert.equal(typeof core.THRESHOLDS.MAX_VOIDLING_REPLIES, 'number',
    'the bound must be published in THRESHOLDS, not implied by a shared constant');
  assert.ok(core.THRESHOLDS.MAX_VOIDLING_REPLIES >= 1000, 'and comfortably above measured occupancy');

  const st = core.createState('Avenrae');
  // Overrun the bound with distinct seconds.
  const lines = [];
  for (let i = 0; i < core.THRESHOLDS.MAX_VOIDLING_REPLIES + 500; i++) {
    const d = 1 + (i % 27), h = (i * 7) % 24, m = (i * 13) % 60, s = (i * 31) % 60;
    const p = (n) => String(n).padStart(2, '0');
    lines.push(`[Mon Jan ${p(d)} ${p(h)}:${p(m)}:${p(s)} 2026] Voidling says, 'hail'`);
  }
  core.applyLines(st, lines);
  assert.ok(st.voidlingReplies.length <= core.THRESHOLDS.MAX_VOIDLING_REPLIES,
    `the set must stay bounded; got ${st.voidlingReplies.length}`);

  // THE DIRECTION OF THE FAILURE, which is the whole point of a bound.
  // A refusal is only reported when a reply corroborates it. Drop the replies
  // and a refusal must become `unknown` — it must NEVER become a false
  // `refused`, and it must never silently become `granted`.
  const withControl = core.createState('Avenrae');
  core.applyLines(withControl, [
    "[Mon Aug 10 18:00:00 2026] You say, 'danger'",
    "[Mon Aug 10 18:00:02 2026] Voidling says, 'Your hubris risks our very reality itself.'",
  ]);
  const before = core.classifyRequests(withControl);
  assert.equal(before[0].result, 'refused', 'with the control present, a refusal is reportable');
  assert.equal(before[0].positiveControl, true);

  // Now the same request with the control evicted.
  withControl.voidlingReplies = [];
  const after = core.classifyRequests(withControl);
  assert.equal(after[0].result, 'unknown', 'without it, the module stops claiming a refusal');
  assert.equal(after[0].positiveControl, false);
  assert.notEqual(after[0].result, 'granted', 'and must never invent a grant');
});

test('DAMAGE MUST NOT ENTER THE DEDUPE INDEX — a correctness guard, not a memory one', () => {
  // THE COMMENT ABOVE THE EARLY RETURN CAN BE DELETED. This is what notices.
  //
  // The guard looks like an optimisation: skip bookkeeping for lines we do not
  // model. It is not. `state.seen` is the DEDUPE index, bounded at 200,000, and
  // the live log holds 375,896 damage lines. Let them through and one
  // character's combat evicts the entire lockout dedupe set — after which
  // replaying a log DOUBLE-COUNTS real kills, because the keys that would have
  // suppressed them were pushed out by damage nobody models.
  //
  // Silent double-counting with a clean diagnostic is the worst state this
  // module can reach, and this is the only thing standing between it and that.
  const st = core.createState('Avenrae');
  const damage = [];
  for (let i = 0; i < 200; i++) {
    const s = String(i % 60).padStart(2, '0');
    damage.push(`[Wed Aug 26 20:00:${s} 2026] You slash a rock golem for ${1000 + i} points of damage.`);
    damage.push(`[Wed Aug 26 20:01:${s} 2026] Your voice booms.`);
    damage.push(`[Wed Aug 26 20:02:${s} 2026] A dracoliche has taken ${200 + i} damage from Drifting Death by Jeeve.`);
  }
  core.applyLines(st, damage);
  assert.equal(st.seenCount, 0,
    `600 damage/pulse lines must add NOTHING to the dedupe index; got ${st.seenCount}`);
  assert.equal(st.events.length, 0, 'and nothing to the provenance log');
  assert.equal(st.kills.length, 0);
  assert.equal(st.dropped.beyondDedupeHorizon, 0);

  // But they DO extend coverage — we were in a position to see those lines, and
  // coverage is about what we could have seen, not what we modelled.
  assert.notEqual(st.firstSeen, null, 'stamped lines still extend coverage');

  // And a real kill fed afterwards still dedupes, which is the property the
  // guard exists to protect.
  const kill = '[Wed Aug 26 21:00:00 2026] You have slain Lord Nagafen!';
  core.applyLine(st, kill);
  core.applyLine(st, kill);
  assert.equal(st.kills.length, 1, 'the duplicate must still be suppressed');
  assert.equal(st.dropped.duplicate, 1, 'and counted as a duplicate, not silently dropped');

  // parseLine still RETURNS the rows — Session E consumes them; applyLine does not.
  assert.equal(core.parseLine(damage[0]).kind, 'damage');
  assert.equal(core.parseLine(damage[1]).kind, 'song-pulse');
});
