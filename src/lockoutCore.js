'use strict';

// EQLS Lockouts — parsing core.
//
// Pure. No `require` of anything at all. No Electron, no DOM, no filesystem,
// no timers, and `Date.now()` is never called in this file. Lines in, an
// explicit `now` in, JSON-clonable state out.
//
// WHAT THIS MODULE IS FOR
//
// EverQuest Legends does not print a raid lockout line. We checked: see
// docs/EVIDENCE.md. What it *does* print is a weekly task, by name, on the
// kill:
//
//   You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
//   Your task 'Potential of the Void - Lord Nagafen - Weekly' has been updated.
//   You have been given: Void-Touched Potential
//
// Every other tool that ships this feature infers a lockout from kill history
// and hardcodes a reset day. This module does neither. It records what the
// game said and when, and reports the reset boundary as the *bracket* the
// observations actually support — never as a constant.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE
//
// No reset day is hardcoded. `projectReset()` returns `provenance: 'not
// recorded'` until two assignments of the same task have been observed on
// opposite sides of a turnover. There is no default. There is no fallback
// constant. If you are tempted to add one, read docs/EVIDENCE.md first: the
// only two published implementations of this feature both ship a typed
// Tuesday, and one of them marks it "VERIFY IN GAME" in its own source.
//
// TIME, AND WHY IT IS AWKWARD ON PURPOSE
//
// A log stamp is `[Mon Aug 10 17:14:49 2026]`. It carries no timezone and no
// UTC offset. It is the game client's local wall clock, nothing more. This
// module therefore works entirely in *civil time* and refuses to produce an
// instant. `civilOf()` returns a monotone integer for differencing only; it is
// not an epoch and must not be displayed or persisted as one.
//
// The known cost, stated rather than hidden: across a daylight-saving
// transition, a civil difference is off by the size of the shift. `CAVEAT_DST`
// is attached to every interval this module reports. `crossesPossibleDstShift`
// is emitted on each bracket and is **always null**, because this module has no
// timezone and therefore genuinely cannot decide it — the field exists so a
// host that DOES know its zone can fill it in, not because we computed it.

// ===========================================================================
// THE CONTRACT
// ===========================================================================
//
// Everything below is a promise to the host application. Six of these came from
// Session C, who read a real Electron log-parsing app and listed what a retrofit
// module has to satisfy. They are written here rather than only in the code that
// satisfies them, because a constraint honoured in one function and undocumented
// is a constraint the next edit breaks.
//
// 1. INPUT IS THE RAW LINE, PREFIX AND ALL.
//    Give this module exactly what the tailer emits:
//        [Wed Aug 19 19:17:52 2026] You say, 'danger'
//    Do NOT strip the timestamp first. Host parsers commonly strip it as their
//    first step; here the timestamp IS the measurement, and a stripped line
//    parses to null rather than failing loudly. Lines the module does not model
//    are ignored, so it is safe to feed it everything.
//
// 2. THE CLOCK IS NEVER READ. `now` IS THE ONLY TIME SOURCE.
//    No `Date.now()`, no `new Date()`, no timers, no intervals in this file.
//    Stronger, and this is the property that matters: **`now` does not affect
//    accumulated state at all.** `applyLine` never sees it. It is an argument to
//    `project()` only, where it feeds derived views like `hoursAgo`. So replaying
//    a million lines produces byte-identical state to receiving them live, and a
//    test asserts it.
//
// 3. ONE-SECOND RESOLUTION, AND NO ORDERING WITHIN A SECOND.
//    The log stamps to the second. Two events sharing a stamp arrive in an order
//    the log does not guarantee, and **nothing in this module may depend on that
//    order.**
//
//    This is not theoretical. Two sessions on this project were bitten by it
//    independently, in different codebases: Session C by a mez break and its
//    wear-off sharing a stamp, and this module by the Voidling's closing line
//    arriving BEFORE the task line it was being used to terminate:
//
//        [Tue Aug 11 20:40:44 2026] You say, 'danger'
//        [Tue Aug 11 20:40:44 2026] Voidling says, 'Your hubris risks our very reality itself.'
//        [Tue Aug 11 20:40:44 2026] You have been assigned the task '... Lady Vox - Weekly'.
//
//    That produced a false 26-minute reset bracket from a granted task read as a
//    refusal. The fix was structural, not a patch: `applyLine` classifies
//    nothing. It records raw observations, and `classifyRequests` decides later
//    with the whole window visible. **Any future logic that asks "did A happen
//    before B" must instead ask "did A and B both happen within N seconds".**
//
// 4. STATE IS JSON, AND ONLY JSON.
//    No Map, Set, Date, function, undefined, Infinity or NaN ever enters state.
//    Those survive every unit test and silently empty or corrupt on the first
//    reload. State is plain objects, arrays, strings, numbers, booleans and null,
//    so `JSON.parse(JSON.stringify(state))` is exact. A test asserts the round
//    trip is deep-equal.
//
// 5. NO FILE IS OWNED, NO DEFAULT IS OWNED.
//    This module never reads or writes anything. It has no config file, no
//    persistence, and no opinion about where state lives. It hands back a plain
//    object; the host owns defaults, backfill and migration, because that
//    ownership living in one place is what lets a host change its schema without
//    a migration.
//
// 6. FEEDING THE SAME LINE TWICE IS SAFE. IT IS IDEMPOTENT.
//    Stated plainly because "undecided is what hurts": a tailer that re-reads a
//    tail, a backfill that overlaps the live stream, or the same file arriving
//    twice under different names all produce **no change in state**. Every
//    observation is keyed by (timestamp, kind, identity) and a repeat increments
//    `dropped.duplicate` instead of being recorded. A test feeds the fixture
//    twice and asserts the state is deep-equal to feeding it once.
//
//    Verified by diff, not by assertion: replaying the whole stream changes
//    exactly ONE key in the entire state object — `dropped.duplicate`, the
//    counter recording how many repeats were rejected. That counter is supposed
//    to move. Nothing else does.
//
//    Voidling replies are the one thing NOT stored as an event. They are a set
//    of SECONDS, because one NPC answers several players at once and prints two
//    lines per exchange, so a list would grow on replay. An earlier revision
//    exempted them from dedupe and called it a deliberate exception; the
//    CONTRACT 6 test proved that broke idempotence, and the exception is gone.
//    Presence is all they are for, and a set is idempotent by construction.
//
// 7. ONE STATE PER CHARACTER. THE CHARACTER IS AN INPUT.
//    `createState(character)` requires the name and refuses to be shared.
//
//    **The evidence, because this is a claim about the game and not about the
//    code:** two characters played simultaneously by one person, grouped, at the
//    same Voidling, each received their own separate grant of the same task
//    seconds apart —
//
//        [Mon Aug 10 17:14:49 2026]  (Avenrae)  You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
//        [Mon Aug 10 17:14:53 2026]  (Shara)    You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
//
//    — and their request histories classify to different totals over the same
//    period. Merged into one state, those two grants read as one task granted
//    twice four seconds apart, which this module would report as a four-second
//    reset bracket. That is not a hypothetical; it is what the first version did.
//
//    **The limit of that evidence, stated because it is real:** this shows the
//    two characters hold INDEPENDENT grant streams. It does not by itself
//    distinguish per-character from per-account, since both characters may be on
//    one account or on two and the logs do not say which. The safe claim, and
//    the one this module acts on, is the narrow one: **grants are tracked per
//    character, so state must be too.**
//
// ===========================================================================

// ---------------------------------------------------------------------------
// Difficulty grammar
// ---------------------------------------------------------------------------
//
// DERIVED, NOT TYPED. Every pair below was read out of the client's own
// instance-invite line across 27 distinct instance names in our corpus, with
// no exceptions and no conflicts:
//
//   Lumbarin has asked you to join the instance: Nagafen's Lair - Group 1 (Awakened).
//
// The regeneration command and its output are in analysis/derive.js; the
// counts are in analysis/findings.json. If the game adds a tier, that script
// reports the new pair and this table is updated from its output — it is not
// edited by hand.
const DIFFICULTY_LABELS = ['Normal', 'Awakened', 'Adaptive', 'Fused', 'Refined'];

// The three bosses observed carrying a weekly task in our corpus. This list is
// NOT used to gate parsing — `parseLine` accepts any boss name the game emits,
// because a list of bosses we happen to have killed is not a list of bosses
// that exist. It is exported only so a UI can show known-vs-new.
const OBSERVED_WEEKLY_BOSSES = ['Lord Nagafen', 'Lady Vox', 'Master Yael'];

const CAVEAT_DST =
  'Log stamps carry no timezone. An interval spanning a daylight-saving ' +
  'transition is wrong by the size of the shift. Treat as a bound, not a duration.';

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

// ---------------------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------------------

// `[Mon Aug 10 17:14:49 2026] rest of line`
// Day is zero-padded in every line measured in our corpus, but classic EQ
// space-pads single-digit days, so both are accepted. Costs nothing.
const TS_RE = /^\[([A-Za-z]{3}) ([A-Za-z]{3}) {1,2}(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})\] ?(.*)$/;

// Splits a raw log line into its civil timestamp and its message.
// Returns null when the line does not carry a stamp — which is a real case:
// a line can arrive mid-write, and multi-line lore text has no stamp.
function splitStamp(line) {
  if (typeof line !== 'string') return null;
  const m = TS_RE.exec(line);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  return {
    at: {
      weekday: m[1],          // as the client wrote it; never recomputed
      year: Number(m[7]),
      month,
      day: Number(m[3]),
      hour: Number(m[4]),
      minute: Number(m[5]),
      second: Number(m[6]),
    },
    message: m[8],
  };
}

// A monotone integer over civil time, for differencing ONLY.
// Date.UTC is a pure arithmetic function of its arguments — it reads no clock.
// The result is deliberately not an instant: see the header note on time.
function civilOf(at) {
  return Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute, at.second);
}

// 0 = Sunday, matching JS getUTCDay, computed from the civil date rather than
// trusted from the client's three-letter weekday. Both are reported; a
// mismatch is surfaced rather than silently resolved.
function civilWeekday(at) {
  return new Date(civilOf(at)).getUTCDay();
}

function formatCivil(at) {
  const p = (n, w) => String(n).padStart(w, '0');
  return `${at.year}-${p(at.month, 2)}-${p(at.day, 2)} ${p(at.hour, 2)}:${p(at.minute, 2)}:${p(at.second, 2)}`;
}

// ---------------------------------------------------------------------------
// Line shapes
// ---------------------------------------------------------------------------
//
// Every pattern below was read off a line in our own logs or off the client's
// own string table at
// `<install>/eqstr_us.txt`. None was invented, and none came from another
// project's source. Provenance per shape is in docs/EVIDENCE.md.

// You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
const TASK_ASSIGNED_RE = /^You have been assigned the task '(.+?)'\.$/;

// Your task 'Potential of the Void - Lord Nagafen - Weekly' has been updated.
const TASK_UPDATED_RE = /^Your task '(.+?)' has been updated\.$/;

// You have been given: Void-Touched Potential
const GIVEN_RE = /^You have been given: (.+)$/;

// Splits `Potential of the Void - Lord Nagafen - Weekly` into its parts.
// Anchored on the trailing cadence word so a boss name containing " - " cannot
// break it. The cadence is captured as written rather than matched against a
// list — if the game ships a "Daily", this still parses and the caller sees it.
const TASK_NAME_RE = /^(.+?) - (.+) - ([A-Za-z]+)$/;

// THE LOCKOUT SIGNAL.
//
// The weekly task is granted by a dialogue tree on an NPC named Voidling,
// standing in the static parent zone. Measured, verbatim, both outcomes:
//
//   GRANTED
//     [Mon Aug 10 17:14:47] You say, 'Hail, voidling'
//     [Mon Aug 10 17:14:48] Voidling says, 'Ah, another who thinks themselves a Legend. ... the [danger]...'
//     [Mon Aug 10 17:14:49] You say, 'danger'
//     [Mon Aug 10 17:14:49] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
//     [Mon Aug 10 17:14:49] Voidling says, 'Your hubris risks our very reality itself.'
//
//   REFUSED  (locked out)
//     [Mon Aug 10 18:05:16] You say, 'Hail, voidling'
//     [Mon Aug 10 18:05:16] Voidling says, 'Ah, another who thinks themselves a Legend. ... the [danger]...'
//     [Mon Aug 10 18:05:17] You say, 'danger'
//     [Mon Aug 10 18:05:18] Voidling says, 'Your hubris risks our very reality itself.'
//
// The two are identical but for the task line. When you are locked out the
// game says NOTHING — there is no refusal line, no timer line, no lockout line
// anywhere in 440 MB of log. Silence is the whole signal.
//
// WHY THAT IS SAFE HERE, when "silence" is normally this project's worst
// exposure: the Voidling's closing line fires in BOTH cases. It is a positive
// control built into the mechanic. An exchange with no Voidling line nearby is
// reported as UNKNOWN, never as a refusal, so a filtered channel cannot be
// mistaken for a lockout.
const SELF_DANGER_RE = /^You say, 'danger'$/;
const VOIDLING_RE = /^Voidling says, '/;
const VOIDLING_CLOSING_RE = /^Voidling says, 'Your hubris risks our very reality itself\.'$/;

// You have entered The Ruins of Old Paineel - Group 2 (Adaptive).
// You have entered The Plane of Sky 0 (Normal).
// You have entered Nektulos Forest.
const ENTERED_RE = /^You have entered (.+?)\.$/;

// Lumbarin has asked you to join the instance: Nagafen's Lair - Group 1 (Awakened).        Would you like to join? ...
// Client string 3527. The run of spaces is the client's, and is matched
// loosely so a change in its width cannot break the parse.
const INSTANCE_INVITE_RE = /^(.+?) has asked you to join the instance: (.+?)\.\s+Would you like to join\?/;

// Zone names come in FOUR shapes, all measured across the 68 distinct zone
// strings in our corpus. Getting this wrong collapses two populations into
// one bucket, which is the error this project has already made once:
//
//   The Plane of Sky                              open world      (37 of 68)
//   The Permafrost Caverns - Group                group instance, difficulty NOT STATED
//   The Ruins of Old Paineel - Group 2 (Adaptive) group instance at D2
//   The Plane of Fear 4 (Refined)                 raid  instance at D4
//
// The third shape is the trap. `- Group` with no index is still an INSTANCE
// and must not fall through to the open-world branch just because the client
// declined to name a difficulty. It reports `difficulty: null`, which the
// projection renders as "not recorded" — not as D0.
//
// `- Solo` does not occur. Clearance: `grep -F " - Solo"` over the 68 distinct
// zone strings extracted from all 8 files in state/logs returned 0. The shape
// is still parsed, because zero occurrences is not zero forever and the code
// costs one alternation.
const INSTANCE_FULL_RE = /^(.+?)(\s+-\s+(?:Group|Solo))?\s+(\d+)\s+\(([^)]+)\)$/;
const INSTANCE_BARE_RE = /^(.+?)\s+-\s+(Group|Solo)$/;

function parseInstanceName(name) {
  let m;

  if ((m = INSTANCE_FULL_RE.exec(name))) {
    const index = Number(m[3]);
    return {
      zone: m[1],
      instanced: true,
      group: /Group/.test(m[2] || ''),
      solo: /Solo/.test(m[2] || ''),
      difficulty: index,
      // The label the client wrote, kept verbatim. DIFFICULTY_LABELS is only
      // consulted to flag a disagreement — it never overrides the game.
      difficultyLabel: m[4],
      labelMatchesTable: DIFFICULTY_LABELS[index] === m[4],
    };
  }

  if ((m = INSTANCE_BARE_RE.exec(name))) {
    return {
      zone: m[1],
      instanced: true,
      group: m[2] === 'Group',
      solo: m[2] === 'Solo',
      difficulty: null,           // stated by the game as absent, not as zero
      difficultyLabel: null,
      labelMatchesTable: null,
    };
  }

  return { zone: name, instanced: false, group: false, solo: false, difficulty: null, difficultyLabel: null, labelMatchesTable: null };
}

// Parses one raw log line into an event, or null if it is not one we model.
// Pure: same input, same output, always.
function parseLine(line) {
  const split = splitStamp(line);
  if (!split) return null;
  const { at, message } = split;

  let m;

  if ((m = TASK_ASSIGNED_RE.exec(message))) {
    return { kind: 'task-assigned', at, ...describeTask(m[1]) };
  }
  if ((m = TASK_UPDATED_RE.exec(message))) {
    return { kind: 'task-updated', at, ...describeTask(m[1]) };
  }
  if ((m = GIVEN_RE.exec(message))) {
    return { kind: 'given', at, item: m[1] };
  }
  if ((m = ENTERED_RE.exec(message))) {
    return { kind: 'entered', at, ...parseInstanceName(m[1]) };
  }
  if ((m = INSTANCE_INVITE_RE.exec(message))) {
    return { kind: 'instance-invite', at, from: m[1], ...parseInstanceName(m[2]) };
  }
  if (SELF_DANGER_RE.test(message)) {
    return { kind: 'weekly-request', at };
  }
  if (VOIDLING_RE.test(message)) {
    return { kind: 'voidling-reply', at, closing: VOIDLING_CLOSING_RE.test(message) };
  }
  return null;
}

function describeTask(taskName) {
  const m = TASK_NAME_RE.exec(taskName);
  if (!m) return { task: taskName, series: null, boss: null, cadence: null };
  return { task: taskName, series: m[1], boss: m[2], cadence: m[3] };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const STATE_VERSION = 1;

// A log file belongs to ONE character (`eqlog_<Character>_<server>.txt`), and
// a task is granted to a character, not to an account. Two grouped characters
// each get their own grant, seconds apart — measured, in our own corpus:
//
//   [Mon Aug 10 17:14:49 2026] ... 'Potential of the Void - Lord Nagafen - Weekly'.   (Avenrae)
//   [Mon Aug 10 17:14:53 2026] ... 'Potential of the Void - Lord Nagafen - Weekly'.   (Shara)
//
// Merged into one state those read as a task assigned twice four seconds
// apart, which this module would then report as a four-second reset bracket.
// That is an instrument manufacturing a finding, and it is the failure mode
// this project has caught in its own tooling more than once.
//
// So state is PER CHARACTER, and the character is required at construction.
// A host that tails "whichever eqlog_*.txt changed last" — which follows the
// player across character switches — must keep one state per character and
// route by filename. `characterFromLogFilename` does that parse.
function createState(character) {
  if (typeof character !== 'string' || !character) {
    throw new TypeError(
      'createState(character): a character name is required. State cannot be ' +
      'shared across characters — two grouped characters each receive their ' +
      'own task grant, and merging them fabricates reset brackets.'
    );
  }
  return {
    version: STATE_VERSION,
    character,
    // One entry per task name, in first-seen order.
    tasks: {},
    // Every `You have been given:` line, so a caller can reconcile against the
    // 3-per-week cap in the 28 Jul 2026 patch note without re-parsing.
    grants: [],
    // Instances entered, deduped by name. Feeds the data-model question of
    // whether a lockout attaches to an instance; we do not yet claim it does.
    instances: {},
    // Every `You say, 'danger'` — a request for the weekly. Classified in the
    // projection, not here.
    requests: [],
    // Civil times of Voidling lines, the positive control for a refusal.
    voidlingReplies: [],
    // Ordered log of what was observed, for provenance. Bounded — see `applyLine`.
    events: [],
    firstSeen: null,
    lastSeen: null,
    dropped: { unstamped: 0, duplicate: 0 },
  };
}

const MAX_EVENTS = 5000;

// Applies one raw line. Mutates and returns `state` — cheap, and the caller
// owns the object. Returns the same state unchanged for lines we do not model.
//
// DUPLICATE SUPPRESSION IS LOAD-BEARING, NOT HOUSEKEEPING. Two characters in
// one group both log the same events, and a tailer that follows "whichever
// eqlog_*.txt was modified most recently" will hop between those files and
// replay the same moment twice. Counting one kill as two would corrupt every
// interval this module reports.
function applyLine(state, line) {
  const ev = parseLine(line);
  if (!ev) {
    if (typeof line === 'string' && line.length && !splitStamp(line)) state.dropped.unstamped++;
    return state;
  }

  const civil = civilOf(ev.at);
  // A Voidling reply is a PRESENCE CONTROL, not an event. It never enters
  // `events` and never emits a change, because several players share one NPC
  // and the count is meaningless. It is recorded below as a set of seconds.
  if (ev.kind === 'voidling-reply') {
    if (!state.voidlingReplies.includes(civil)) {
      state.voidlingReplies.push(civil);
      if (state.voidlingReplies.length > MAX_EVENTS) state.voidlingReplies.shift();
    }
    return state;
  }

  const key = dedupeKey(ev, civil);
  if (state.events.length && state.events.some((e) => e.key === key)) {
    state.dropped.duplicate++;
    return state;
  }

  if (state.firstSeen === null || civil < state.firstSeen) state.firstSeen = civil;
  if (state.lastSeen === null || civil > state.lastSeen) state.lastSeen = civil;

  state.events.push({ key, kind: ev.kind, civil, at: ev.at });
  if (state.events.length > MAX_EVENTS) state.events.shift();

  if (ev.kind === 'task-assigned' || ev.kind === 'task-updated') {
    const t = (state.tasks[ev.task] ||= {
      task: ev.task,
      series: ev.series,
      boss: ev.boss,
      cadence: ev.cadence,
      assignments: [],
      completions: [],
    });
    const bucket = ev.kind === 'task-assigned' ? t.assignments : t.completions;
    bucket.push({ civil, at: ev.at, weekday: civilWeekday(ev.at) });
    bucket.sort((a, b) => a.civil - b.civil);
  }

  if (ev.kind === 'given') {
    state.grants.push({ item: ev.item, civil, at: ev.at });
  }

  // Requests and Voidling replies are stored RAW and classified later, in the
  // projection. Classifying here would mean deciding "granted or refused" at
  // the moment the request arrives, before the answer has been read — and the
  // first version of the analysis script did exactly that and produced a false
  // measurement, because the Voidling's closing line can arrive BEFORE the task
  // line. A streaming classifier cannot see the whole window; a projection can.
  if (ev.kind === 'weekly-request') {
    state.requests.push({ civil, at: ev.at });
    if (state.requests.length > MAX_EVENTS) state.requests.shift();
  }

  if (ev.kind === 'entered' || ev.kind === 'instance-invite') {
    if (ev.instanced) {
      const k = `${ev.zone}|${ev.group ? 'group' : 'raid'}|${ev.difficulty}`;
      const rec = (state.instances[k] ||= {
        zone: ev.zone,
        group: ev.group,
        difficulty: ev.difficulty,
        difficultyLabel: ev.difficultyLabel,
        seen: 0,
      });
      rec.seen++;
    }
  }

  return state;
}

function dedupeKey(ev, civil) {
  switch (ev.kind) {
    case 'task-assigned':
    case 'task-updated':
      return `${civil}|${ev.kind}|${ev.task}`;
    case 'given':
      return `${civil}|given|${ev.item}`;
    case 'weekly-request':
      return `${civil}|request`;
    case 'voidling-reply':
      return `${civil}|voidling`;
    case 'entered':
      return `${civil}|entered|${ev.zone}|${ev.difficulty}`;
    case 'instance-invite':
      return `${civil}|invite|${ev.from}|${ev.zone}|${ev.difficulty}`;
    default:
      return `${civil}|${ev.kind}`;
  }
}

function applyLines(state, lines) {
  for (const line of lines) applyLine(state, line);
  return state;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------
//
// Every value that leaves this module carries `provenance`, one of:
//   'observed'     — read directly off a log line, with that line cited
//   'inferred'     — computed from observed lines, with the reasoning named
//   'not recorded' — we have not seen it. There is no default and no guess.

const NOT_RECORDED = Object.freeze({ provenance: 'not recorded', value: null });

// Reports the reset boundary as a bracket, never a point.
//
// A weekly task re-assigned after an earlier assignment implies the weekly
// period rolled over between them. That gives an open interval: after the last
// event of the old period, before the first assignment of the new one. Both
// ends are observations. The reset instant is somewhere inside and this
// function will not pretend to know where.
//
// Two independent brackets a week apart would let a caller intersect them and
// narrow the estimate sharply. We report every bracket found so that
// intersection is the caller's to make, and `widthHours` is emitted beside every
// one of them, because a bracket wider than a day cannot distinguish a
// Tuesday-morning reset from a Monday-evening one and must not be drawn as
// though it could.
//
// No width is quoted in this comment on purpose. An earlier revision said "a
// 27-hour bracket" here while the measured values were 26.098 and 26.056 — a
// number typed beside the data it claims to describe, in the one file whose
// whole doctrine forbids exactly that. The widths live in
// analysis/findings.json and are regenerated by analysis/derive.js.
function projectReset(state) {
  const brackets = [];

  for (const t of Object.values(state.tasks)) {
    // ONLY a task the game itself labels with a cadence may bracket a reset.
    //
    // This is not tidying. Our corpus holds ordinary tasks — 'Something is
    // Wrrrong', 'This Means Warrr' — assigned and completed nine times inside
    // two minutes on 13 Aug 2026. Those are freely repeatable and carry no
    // cadence word. Admitting them here produces "reset brackets" a few
    // seconds wide, which would then dominate `narrowest` and read as a
    // precise measurement of nothing.
    //
    // The entire claim rests on the game printing the word "Weekly" itself. A
    // task that does not carry a cadence says nothing about a period, and the
    // module says nothing about it in return.
    if (!t.cadence) continue;
    if (t.assignments.length < 2) continue;
    for (let i = 1; i < t.assignments.length; i++) {
      const prev = t.assignments[i - 1];
      const next = t.assignments[i];
      // The lower bound is the latest evidence of the OLD period still being
      // in force — the last completion at or after the previous assignment, if
      // there is one, otherwise the assignment itself.
      const lastOld = t.completions
        .filter((c) => c.civil >= prev.civil && c.civil < next.civil)
        .reduce((acc, c) => (acc === null || c.civil > acc.civil ? c : acc), null);
      // A REFUSED request is later evidence that the old period was still in
      // force than the completion is, so it can tighten the lower bound. But
      // only under a condition that is easy to miss and that cost a false
      // measurement here before it was added:
      //
      // A REFUSAL DOES NOT NAME A BOSS. The game prints nothing at all, so all
      // we know is that *some* Voidling declined. Once ANY task of the new
      // period has been granted, the new period is demonstrably running, and a
      // later refusal only means that particular boss was already taken again
      // — it says nothing about the old period. Admitting those produced a
      // nine-second "reset bracket" between a refusal at 21:44:10 and a grant
      // at 21:44:19, which was the same attempt pressed twice.
      //
      // So a refusal may tighten the lower bound only if it precedes the FIRST
      // grant of the new period, across every task.
      // "The new period has started" means some task has been granted a SECOND
      // time — a first-time grant of a different boss is still the old period,
      // and treating it as new made this rule refuse to tighten at all.
      // This is the weakest safe form: it assumes nothing about whether tasks
      // reset together, only that a re-grant is the earliest proof of a new
      // period we actually hold.
      const rows = classifyRequests(state);
      let firstNewGrant = null;
      for (const other of Object.values(state.tasks)) {
        if (!other.cadence) continue;
        for (let k = 1; k < other.assignments.length; k++) {
          const c = other.assignments[k].civil;
          if (c > prev.civil && (firstNewGrant === null || c < firstNewGrant)) firstNewGrant = c;
        }
      }
      const refusals = rows.filter(
        (r) =>
          r.result === 'refused' &&
          r.civil >= prev.civil &&
          r.civil < next.civil &&
          (firstNewGrant === null || r.civil < firstNewGrant)
      );
      const lastRefusal = refusals.length ? refusals[refusals.length - 1] : null;
      let after = lastOld || prev;
      if (lastRefusal && lastRefusal.civil > after.civil) {
        after = { civil: lastRefusal.civil, at: fromCivil(lastRefusal.civil), weekday: undefined, fromRefusal: true };
      }
      brackets.push({
        task: t.task,
        boss: t.boss,
        cadence: t.cadence,
        afterCivil: after.civil,
        after: formatCivil(after.at),
        afterWeekday: after.weekday !== undefined ? after.weekday : civilWeekday(after.at),
        // true when the lower bound came from a REFUSED request rather than a
        // completion — a stronger and later piece of evidence.
        fromRefusal: after.fromRefusal === true,
        beforeCivil: next.civil,
        before: formatCivil(next.at),
        beforeWeekday: next.weekday,
        widthHours: (next.civil - after.civil) / 3600000,
        crossesPossibleDstShift: null, // caller's zone is unknown to this module
      });
    }
  }

  if (!brackets.length) {
    return {
      ...NOT_RECORDED,
      reason:
        'No task has been observed assigned twice. A reset boundary is only ' +
        'measurable across a re-assignment; nothing in the lines seen so far ' +
        'brackets one.',
      brackets: [],
      caveats: [CAVEAT_DST],
    };
  }

  // The intersection of every bracket, if one exists. This is the whole value
  // of collecting more than one: two brackets a week apart, reduced modulo a
  // week, can be far narrower than either alone. We compute the plain
  // intersection only — the modular reduction needs a period we have not
  // measured, and assuming seven days here would be exactly the typed constant
  // this module refuses to ship.
  const lo = Math.max(...brackets.map((b) => b.afterCivil));
  const hi = Math.min(...brackets.map((b) => b.beforeCivil));

  return {
    provenance: 'inferred',
    value: null, // there is no single instant, and there will not be one
    brackets,
    narrowest: brackets.reduce((a, b) => (b.widthHours < a.widthHours ? b : a)),
    intersects: lo < hi,
    intersectionHours: lo < hi ? (hi - lo) / 3600000 : null,
    basis:
      'A task the game itself labels with a cadence was assigned, and then ' +
      'assigned again. The period between the last evidence of the old ' +
      'assignment and the first evidence of the new one contains the turnover.',
    caveats: [
      CAVEAT_DST,
      'A bracket bounds the turnover; it does not identify a weekday or an ' +
      'hour unless it is narrower than the ambiguity being resolved.',
    ],
  };
}


// ---------------------------------------------------------------------------
// Classifying a weekly request
// ---------------------------------------------------------------------------

// A grant lands in the same second or the next one; 3s is generous.
const GRANT_WINDOW_MS = 3000;
// The Voidling must be demonstrably present and talking for a silence to mean
// anything. Without that, the request is UNKNOWN, never REFUSED.
const CONTROL_BEFORE_MS = 20000;
const CONTROL_AFTER_MS = 5000;
// Repeated `danger` while spamming the NPC is one attempt, not several.
const COLLAPSE_MS = 6000;

// Returns one row per request: GRANTED (with the boss), REFUSED, or UNKNOWN.
//
// REFUSED is the lockout observation. It is only ever emitted when a Voidling
// line sits inside the control window, so a chat filter that hid system text
// yields UNKNOWN rather than a false lockout.
function classifyRequests(state) {
  const assignments = [];
  for (const t of Object.values(state.tasks)) {
    if (!t.cadence) continue;
    for (const a of t.assignments) assignments.push({ civil: a.civil, boss: t.boss, task: t.task });
  }
  assignments.sort((a, b) => a.civil - b.civil);

  const collapsed = [];
  for (const r of state.requests.slice().sort((a, b) => a.civil - b.civil)) {
    const last = collapsed[collapsed.length - 1];
    if (last && r.civil - last.civil <= COLLAPSE_MS) { collapsed[collapsed.length - 1] = r; continue; }
    collapsed.push(r);
  }

  return collapsed.map((r) => {
    const grant = assignments.find((a) => a.civil >= r.civil && a.civil - r.civil <= GRANT_WINDOW_MS);
    const control = state.voidlingReplies.some(
      (v) => v >= r.civil - CONTROL_BEFORE_MS && v <= r.civil + CONTROL_AFTER_MS
    );
    return {
      at: formatCivil(r.at),
      civil: r.civil,
      result: grant ? 'granted' : control ? 'refused' : 'unknown',
      boss: grant ? grant.boss : null,
      positiveControl: control,
    };
  });
}

// A lower bound on the period, measured.
//
// If a boss's weekly was granted at T and a request was REFUSED at T + d with
// no intervening grant, the period is at least d. This is the strongest thing
// the logs say about the length of the cycle, and unlike a weekday it is a
// real measurement rather than a guess.
function projectPeriod(state) {
  const rows = classifyRequests(state);
  const grants = rows.filter((r) => r.result === 'granted');
  if (!grants.length) {
    return { ...NOT_RECORDED, reason: 'No weekly has been observed granted.' };
  }
  const lastGrant = grants[grants.length - 1];
  const laterRefusals = rows.filter((r) => r.result === 'refused' && r.civil > lastGrant.civil);
  if (!laterRefusals.length) {
    return {
      ...NOT_RECORDED,
      reason: 'No refused request has been observed after the most recent grant, ' +
              'so nothing bounds the period from below.',
    };
  }
  const furthest = laterRefusals[laterRefusals.length - 1];
  const days = (furthest.civil - lastGrant.civil) / 86400000;
  return {
    provenance: 'inferred',
    atLeastDays: Number(days.toFixed(3)),
    lastGrantAt: lastGrant.at,
    stillRefusedAt: furthest.at,
    basis:
      'The weekly granted at lastGrantAt was still refused at stillRefusedAt, ' +
      'with a Voidling present as positive control and no grant in between. ' +
      'The period is therefore at least this long. It is a floor, not a value.',
    caveats: [
      CAVEAT_DST,
      'This bounds the period from below only. It says nothing about the upper ' +
      'bound, and nothing about which weekday or hour the turnover falls on.',
    ],
  };
}

// The per-boss view a UI would show. `now` is REQUIRED and must be a civil
// timestamp from the same clock that wrote the log — see `civilFromDate` in
// the adapter. Passing an epoch here is a bug and throws, because a silent
// timezone error is exactly the failure this module exists to avoid.
function project(state, now) {
  if (!now || typeof now !== 'object' || typeof now.year !== 'number') {
    throw new TypeError(
      'project(state, now): `now` must be a civil timestamp object ' +
      '{year, month, day, hour, minute, second} taken from the same clock that ' +
      'writes the log. It is not a Date and not an epoch — this module has no ' +
      'timezone and will not guess one.'
    );
  }
  const nowCivil = civilOf(now);

  const bosses = Object.values(state.tasks).map((t) => {
    const lastAssigned = t.assignments[t.assignments.length - 1] || null;
    const lastCompleted = t.completions[t.completions.length - 1] || null;
    return {
      boss: t.boss,
      task: t.task,
      cadence: t.cadence,
      timesAssigned: t.assignments.length,
      timesCompleted: t.completions.length,
      lastAssigned: lastAssigned
        ? { provenance: 'observed', value: formatCivil(lastAssigned.at), hoursAgo: (nowCivil - lastAssigned.civil) / 3600000 }
        : NOT_RECORDED,
      lastCompleted: lastCompleted
        ? { provenance: 'observed', value: formatCivil(lastCompleted.at), hoursAgo: (nowCivil - lastCompleted.civil) / 3600000 }
        : NOT_RECORDED,
      // Deliberately absent: `available`, `resetsAt`, `locked`. Answering any
      // of those needs the reset rule, and the reset rule is not known. A UI
      // showing "available in 3d 4h" would be inventing a number.
      available: NOT_RECORDED,
    };
  });

  return {
    version: STATE_VERSION,
    character: state.character,
    now: formatCivil(now),
    bosses,
    reset: projectReset(state),
    period: projectPeriod(state),
    requests: classifyRequests(state),
    grants: {
      provenance: state.grants.length ? 'observed' : 'not recorded',
      total: state.grants.length,
      items: state.grants.map((g) => ({ item: g.item, at: formatCivil(g.at) })),
    },
    instances: Object.values(state.instances),
    coverage: {
      provenance: state.firstSeen === null ? 'not recorded' : 'observed',
      from: state.firstSeen === null ? null : formatCivil(fromCivil(state.firstSeen)),
      to: state.lastSeen === null ? null : formatCivil(fromCivil(state.lastSeen)),
      // A tailer that starts at end-of-file has seen nothing before it started.
      // Saying so is the difference between "no lockout" and "not looked".
      note:
        'Covers only the lines fed to this module. A live tailer that begins ' +
        'at the end of the file has no history; backfill explicitly if history ' +
        'is wanted.',
    },
    dropped: state.dropped,
    caveats: [CAVEAT_DST],
  };
}

// `eqlog_Avenrae_rivervale.txt` -> `Avenrae`
// `eqlog_Shara_rivervale_2026-08-14b.txt` -> `Shara`
//
// The character is in the FILENAME, never in the line. A host that routes
// lines to the right per-character state needs this; a host that only ever
// watches one character does not. Pure string function, no filesystem.
function characterFromLogFilename(filename) {
  const m = /^eqlog_([^_]+)_/i.exec(String(filename).replace(/^.*[\\/]/, ''));
  return m ? m[1] : null;
}

function fromCivil(civil) {
  const d = new Date(civil);
  return {
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()],
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

module.exports = {
  // parsing
  parseLine,
  splitStamp,
  parseInstanceName,
  // state
  createState,
  applyLine,
  applyLines,
  // projection
  project,
  projectReset,
  projectPeriod,
  classifyRequests,
  // time helpers (pure)
  civilOf,
  civilWeekday,
  formatCivil,
  fromCivil,
  characterFromLogFilename,
  // tables
  DIFFICULTY_LABELS,
  OBSERVED_WEEKLY_BOSSES,
  STATE_VERSION,
  CAVEAT_DST,
};
