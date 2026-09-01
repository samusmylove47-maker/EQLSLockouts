// WHICH OF MY TESTS COULD ONLY EVER HAVE AGREED WITH ME?
//
// A test that certifies a belief rather than testing it passes even when the
// code it covers is broken. That is mechanically decidable: break the source on
// purpose, one targeted change at a time, and see which tests notice.
//
// ── EVERY MUTATION CARRIES A PROBE, AND THAT IS THE POINT (R84) ────────────
//
// The first version of this harness reported a mutation as NOT CAUGHT when the
// mutation was INERT — it assigned `answer` on an `else if` line and the branch
// body overwrote it immediately. I was one step from reporting a real test as
// vacuous. **An inert mutation and an undetected one are indistinguishable in
// the output and point in opposite directions.**
//
// So each mutation now carries a `probe`: a small function run against the
// ORIGINAL and the MUTANT. If its output is identical, the mutation changed
// nothing and its catch verdict is meaningless — reported as INERT, never as a
// finding. **A mutation harness needs its own matched pair.**
//
// ── OUTCOMES NEVER SHARE A COLUMN (failure shape 5) ───────────────────────
//
//   CAUGHT   probe changed, >=1 test failed         the guard is a gate
//   BLIND    probe changed, NO test failed          *** the only real finding
//   INERT    probe unchanged                        verdict meaningless
//   NOANCHOR text not found; the source moved       the harness is stale
//
// SKIPPED-for-a-missing-anchor once rendered in the same column as a finding.
// It fires correctly and destroys its own message. They are separated here.
//
//   node analysis/mutation-check.js
//
// SAFETY: restores the mutated file from git between every run, refuses to
// start on a dirty tree, and verifies clean at the end.
//
// ── EVERY CHILD PROCESS MUST BE SYNCHRONOUS. THIS IS A REQUIREMENT, NOT A
//    STYLE CHOICE (R145). ────────────────────────────────────────────────
//
// The Director backgrounded a check with an ampersand; the child outlived the
// shell and wrote to the tree AFTER a checkout had reported it clean. **"The
// tree is clean" and "the tree is clean for now" rendered identically at the
// moment it was read.**
//
// This harness holds a MUTANT on disk between writing and restoring. A child
// that outlives the shell can therefore observe, or write against, a
// deliberately broken source — and report on it as if it were the real one.
//
// `execFileSync` throughout is what prevents that, and until R145 it was an
// accident of the API I reached for rather than a decision. **Do not replace
// any call here with `spawn`, `exec`, or a backgrounded shell.** If a step ever
// needs to be asynchronous, restore the tree BEFORE it starts.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'lockoutCore.js');
const TESTS = ['build', 'grid', 'lockout', 'actionability']
  .map((t) => path.join(ROOT, 'test', `${t}.test.js`));

// EVERY MUTATION NAMES THE FILE IT EDITS, and the default is the engine.
//
// The first 22 mutations all edited `src/lockoutCore.js`, and `build.test.js`
// survived every one of them with a perfect record. **That is exactly the state
// that cannot be read from outside**: a file that never fails is either testing
// something no mutation reached, or testing nothing, and only a mutation aimed
// AT it separates the two. `build.test.js` asserts on the PACKAGING — fonts,
// hosts, hashing, the absence of a clock — which no edit to the engine can
// disturb, so the harness could never have reached it.
const REL = (f) => path.join(ROOT, f);
const FILE_ENGINE = 'src/lockoutCore.js';
const FILE_TEMPLATE = 'src/app.template.html';
const FILE_BUILD = 'build-app.js';

// `git checkout` restores CRLF under core.autocrlf while the working copy may
// be LF. That silently broke every multi-line anchor once.
const lf = (s) => s.replace(/\r\n/g, '\n');

// ---------------------------------------------------------------------------
// Probe helpers — small, deterministic, and they must touch the mutated region.
// ---------------------------------------------------------------------------
const NOW = { year: 2026, month: 8, day: 21, hour: 18, minute: 0, second: 0 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
const line = (d, h, m, text, s = 0) => {
  const x = new Date(Date.UTC(2026, 7, d, h, m, s));
  return `[${DAYS[x.getUTCDay()]} ${MON[7]} ${p2(d)} ${p2(h)}:${p2(m)}:${p2(s)} 2026] ${text}`;
};
const beat = (from, to, everyMin = 20) => {
  const out = [];
  for (let d = from; d <= to; d++) {
    for (let m = 0; m < 1440; m += everyMin) out.push(line(d, Math.floor(m / 60), m % 60, 'You have entered Nektulos Forest.'));
  }
  return out;
};
const grantPair = (d, h, boss) => [
  line(d, h, 0, "You say, 'danger'"),
  line(d, h, 0, `You have been assigned the task 'Potential of the Void - ${boss} - Weekly'.`, 2),
];
const refusalPair = (d, h) => [
  line(d, h, 0, "You say, 'danger'"),
  line(d, h, 0, "Voidling says, 'Your hubris risks our very reality itself.'", 3),
];
const stateOf = (core, lines) => core.applyLines(core.createState('Avenrae'), lines);

// SPARSE COVERAGE: one 20-minute block per day. Gaps are ~23.7 h, under the
// 24 h hole tolerance, so `holes` stays empty and the OBSERVED-FRACTION floor
// is the only thing deciding the cells. Built to make two gates visible that a
// fully-covered fixture hides from every probe.
const sparse = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d++) {
    for (let m = 0; m <= 20; m += 10) out.push(line(d, 12, m, 'You have entered Nektulos Forest.'));
  }
  return out;
};


// BUILD PROBE. `build.test.js` asserts on the GENERATED PAGE, so a probe for it
// must build. Returns cheap facts about the artifact rather than the whole
// 290 KB string.
const OUT = path.join(ROOT, 'public', 'app');
function built() {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build-app.js')],
      { cwd: ROOT, stdio: 'ignore' });
  } catch (e) { return 'BUILD-FAILED'; }
  const name = fs.readFileSync(path.join(OUT, 'latest.txt'), 'utf8').trim();
  const html = fs.readFileSync(path.join(OUT, name), 'utf8');
  return {
    googleFontHosts: /fonts\.(googleapis|gstatic)\.com/.test(html),
    dataFontFaces: (html.match(/url\(data:font\/woff2;base64,/g) || []).length,
    httpsUrls: (html.match(/https?:\/\/[^"'\s)]+/g) || []).length,
    scriptSrc: /<script[^>]+src=/i.test(html),
  };
}

// ---------------------------------------------------------------------------
// The mutations. Each names the CLAIM it tests.
// ---------------------------------------------------------------------------
const MUTATIONS = [
  { name: 'dedupe-early-return-removed',
    claim: 'damage rows must not reach the dedupe index',
    find: "if (ev.kind === 'damage' || ev.kind === 'self-damage' || ev.kind === 'song-pulse') {\n    return state;\n  }",
    repl: 'if (false) {\n    return state;\n  }',
    probe: (c) => stateOf(c, [line(19, 10, 0, 'You hit a giant rat for 50 points of damage.')]).seenCount },

  { name: 'observed-fraction-floor-to-zero',
    claim: 'a barely-observed period reads not_looked, not open',
    find: 'const MIN_OBSERVED_FRACTION = 0.05;',
    repl: 'const MIN_OBSERVED_FRACTION = 0;',
    probe: (c) => { const g = c.projectGrid(stateOf(c, sparse(15, 21)), NOW); return [g.period.coverageSpansPeriod, g.notLookedCount, g.openCount]; } },

  { name: 'cr-strip-removed',
    claim: 'a trailing CR must not silently blank the projection',
    find: 'if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);',
    repl: 'if (false) line = line.slice(0, -1);',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You have entered Nektulos Forest.') + '\r'); return e && e.kind; } },

  { name: 'span-gap-to-zero',
    claim: 'coverage spans merge within 30 minutes',
    find: 'const SPAN_GAP_MS = 30 * 60 * 1000;',
    repl: 'const SPAN_GAP_MS = 0;',
    probe: (c) => stateOf(c, beat(19, 19)).spans.length },

  { name: 'self-damage-branch-disabled',
    claim: 'a self-hit is never counted as outgoing output',
    find: '  if ((m = DAMAGE_SELF_RE.exec(message))) {',
    repl: '  if (false && (m = DAMAGE_SELF_RE.exec(message))) {',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You hit yourself for 50 points of magic damage by Lifetap Strike.')); return e ? [e.kind, e.outgoing] : null; } },

  { name: 'hour-known-forced-true',
    claim: 'the reset hour is unmeasured and conditional cells carry that',
    find: "const hourKnown = typeof resetHour === 'number' && resetHour >= 0 && resetHour < 24;",
    repl: 'const hourKnown = true;',
    probe: (c) => c.projectGrid(stateOf(c, beat(15, 21)), NOW).period.hourKnown },

  { name: 'token-cap-raised-to-99',
    claim: 'three tokens per period is what makes `no` reachable',
    find: '  tokens: 3,',
    repl: '  tokens: 99,',
    probe: (c) => c.actionability(stateOf(c, [...beat(15, 21), ...grantPair(19, 10, 'Lord Nagafen'), ...grantPair(19, 12, 'Lady Vox'), ...grantPair(20, 10, 'Master Yael')]), NOW, { raid: "Nagafen's Lair", difficulty: 3 }).answer },

  { name: 'grant-window-to-zero',
    claim: 'a grant is paired to a hail within 3 seconds',
    find: 'const GRANT_WINDOW_MS = 3000;',
    repl: 'const GRANT_WINDOW_MS = 0;',
    probe: (c) => c.classifyRequests(stateOf(c, grantPair(19, 10, 'Lord Nagafen')))[0].result },

  { name: 'false-no-reintroduced',
    claim: 'a controlled refusal must NOT answer `no` (the 31 Aug defect)',
    find: "    answer = 'unknown';\n    unknownKind = 'refusal-not-cap';",
    repl: "    answer = 'no';\n    unknownKind = 'refusal-not-cap';",
    probe: (c) => c.actionability(stateOf(c, [...beat(15, 21), ...refusalPair(20, 14)]), NOW, { raid: "Nagafen's Lair", difficulty: 3 }).answer },

  { name: 'completed-made-unactionable',
    claim: 'a completed cell is still actionable — repeats pay a drop',
    find: "cells.some((c) => c.state === 'open' || c.state === 'completed')",
    repl: "cells.some((c) => c.state === 'open')",
    probe: (c) => c.actionability(stateOf(c, [...beat(15, 21), ...grantPair(19, 10, 'Lord Nagafen'), line(19, 11, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."), line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!')]), NOW, { raid: "Nagafen's Lair", difficulty: 3 }).answer },

  { name: 'max-seen-to-one',
    claim: 'the dedupe index is large enough that the horizon never fires',
    find: 'const MAX_SEEN = 200000;',
    repl: 'const MAX_SEEN = 1;',
    probe: (c) => c.THRESHOLDS.MAX_EVENTS && stateOf(c, [...beat(19, 20), line(19, 11, 0, 'Lord Nagafen has been slain by Avenrae!')]).seenCount },

  { name: 'horizon-sample-floor-removed',
    claim: 'a rate is refused below a two-day sample',
    find: 'const MIN_HORIZON_SAMPLE_DAYS = 2;',
    repl: 'const MIN_HORIZON_SAMPLE_DAYS = 0;',
    probe: (c) => c.horizon(stateOf(c, beat(20, 20))).provenance },

  { name: 'weekday-trusted-from-client',
    claim: 'the weekday is derived from the date, never trusted from the line',
    find: 'return new Date(civilOf(at)).getUTCDay();',
    repl: "return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(at.weekday);",
    probe: (c) => c.civilWeekday({ weekday: 'Fri', year: 2026, month: 8, day: 10, hour: 0, minute: 0, second: 0 }) },

  // ── ADDED 31 Aug to reach some of the 87 tests no mutation touched ───────

  { name: 'bare-group-difficulty-dropped',
    claim: 'a bare `- Group` is difficulty 0, carried as difficultyFromOmission',
    find: '      difficultyFromOmission: isGroup,',
    repl: '      difficultyFromOmission: false,',
    probe: (c) => JSON.stringify(c.parseInstanceName('The Plane of Fear - Group')) },

  { name: 'boss-name-normaliser-identity',
    claim: 'boss names are normalised before the roster join',
    find: 'function normaliseBossName(name) {',
    repl: 'function normaliseBossName(name) { return String(name);',
    probe: (c) => [c.normaliseBossName('LORD NAGAFEN'), !!c.RAID_OF_BOSS[c.normaliseBossName('Lord Nagafen')]] },

  { name: 'not-a-zone-set-emptied',
    claim: 'a non-zone notice must not be reported as a zone-in',
    find: 'if (NOT_A_ZONE.has(name)) return { kind: \'not-a-zone\', at, text: name };',
    repl: 'if (false) return { kind: \'not-a-zone\', at, text: name };',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You have entered an area where levitation effects do not function.')); return e && [e.kind, e.unrecognised === true]; } },

  { name: 'voidling-closing-matches-anything',
    claim: 'the positive control keys on the CLOSING line, not any Voidling line',
    find: 'closing: VOIDLING_CLOSING_RE.test(message)',
    repl: 'closing: true',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, "Voidling says, 'Some other sentence entirely.'")); return e && e.closing; } },

  { name: 'collapse-window-to-zero',
    claim: 'repeated hails inside 6 s collapse to one request',
    find: 'const COLLAPSE_MS = 6000;',
    repl: 'const COLLAPSE_MS = 0;',
    probe: (c) => c.classifyRequests(stateOf(c, [line(19, 10, 0, "You say, 'danger'"), line(19, 10, 0, "You say, 'danger'", 2)])).length },

  { name: 'voidling-bound-to-one',
    claim: 'the Voidling reply set is bounded, and overflow degrades safely',
    find: 'const MAX_VOIDLING_REPLIES = 5000;',
    repl: 'const MAX_VOIDLING_REPLIES = 1;',
    // MUST USE CLOSING LINES. After the 31 Aug fix only the closing line enters
    // the set, so a probe built from chatter exercises nothing and reports INERT
    // — which is the harness correctly refusing to rule, not a finding.
    probe: (c) => stateOf(c, [
      line(19, 10, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
      line(19, 10, 30, "Voidling says, 'Your hubris risks our very reality itself.'"),
      line(19, 11, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
    ]).voidlingReplies.length },

  { name: 'window-name-mapping-emptied',
    claim: 'alt+Z names map to kill-line names or a lockout reads as missing',
    find: "  'Innoruuk': 'Innoruuk, the Prince of Hate',",
    repl: '',
    probe: (c) => JSON.stringify(c.WINDOW_TO_KILL_NAME) },

  { name: 'reset-rule-provenance-upgraded',
    claim: 'the reset weekday is STATED by the owner, never measured by us',
    find: "  provenance: 'stated',          // NOT 'measured'. We did not observe this.",
    repl: "  provenance: 'observed',",
    probe: (c) => c.RESET_RULE.provenance },

  { name: 'period-gap-tolerance-to-zero',
    claim: 'gaps under 24 h are tolerated rather than blanking the period',
    find: 'const PERIOD_GAP_TOLERANCE_MS = 24 * 60 * 60 * 1000;',
    repl: 'const PERIOD_GAP_TOLERANCE_MS = 0;',
    probe: (c) => { const g = c.projectGrid(stateOf(c, sparse(15, 21)), NOW); return [g.period.coverageSpansPeriod, g.period.coverageHoles.length]; } },
  // ── AIMED AT build.test.js (R90) ────────────────────────────────────────
  //
  // Twenty-two engine mutations left this file with a perfect record. These
  // five decide whether that is coverage it cannot reach or coverage it does
  // not have.

  { name: 'google-fonts-link-injected',
    file: FILE_TEMPLATE,
    claim: 'the page never references fonts.googleapis.com or fonts.gstatic.com',
    find: '<meta name="viewport" content="width=device-width,initial-scale=1">',
    repl: '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel">',
    probe: () => built() },

  { name: 'font-inlining-replaced-by-url',
    file: FILE_BUILD,
    claim: 'every font ships as a data: URI, never as a fetch',
    // THE `\\n` IS A LITERAL BACKSLASH-N IN build-app.js, inside a template
    // literal. Written `\n` here it becomes a real newline and matches nothing —
    // which the harness correctly reported as NOANCHOR rather than as a finding.
    find: "`    src: url(data:font/woff2;base64,${f.base64}) format('woff2');${range}\\n` +",
    repl: "`    src: url(https://fonts.gstatic.com/s/${f.family}.woff2) format('woff2');${range}\\n` +",
    probe: () => built() },

  { name: 'external-script-injected',
    file: FILE_TEMPLATE,
    claim: 'the page carries exactly one script block and fetches nothing',
    find: '<title>EQLS Lockouts</title>',
    repl: '<title>EQLS Lockouts</title>' +
          '\n<script src="https://cdn.example.com/x.js"></script>',
    probe: () => built() },

  { name: 'content-hash-frozen',
    file: FILE_BUILD,
    claim: 'the filename is content-hashed, so a changed page changes its name',
    find: "const hash = crypto.createHash('sha256').update(html).digest('hex').slice(0, 8);",
    repl: "const hash = 'deadbeef';",
    probe: () => { const b = built(); const n = fs.readFileSync(path.join(OUT, 'latest.txt'), 'utf8').trim(); return [b, n]; } },
  // ── AIMED AT grid.test.js roster + instance-name parsing (R92) ──────────
  //
  // Two consumers each: the roster is what told C its threat-meter trigger was
  // not mine, and instance-name parsing is where B's case/article collision
  // work meets this repo from the other side. A survivor here has two victims.

  { name: 'alsoDies-promoted-to-completion-keys',
    claim: 'alsoDies is INERT — the Director ruled it must not complete a cell',
    find: "    bosses: Object.freeze(['Lord Nagafen']),",
    repl: "    bosses: Object.freeze(['Lord Nagafen', 'King Tranix', 'Magus Rokyl', 'Warlord Skarlon']),",
    probe: (c) => c.RAIDS.find((r) => r.key === "Nagafen's Lair").bosses.length },

  { name: 'single-boss-forced-true',
    claim: 'singleBoss is MEASURED, not derived from the length of bosses',
    find: '    singleBoss: false,                // the window lists four; measured 14/15, 14/15, 12/15',
    repl: '    singleBoss: true,',
    probe: (c) => c.RAIDS.find((r) => r.key === "Nagafen's Lair").singleBoss },

  { name: 'difficulty-labels-reordered',
    claim: 'the label table flags a disagreement with the client, never overrides it',
    find: "const DIFFICULTY_LABELS = ['Normal', 'Awakened', 'Adaptive', 'Fused', 'Refined'];",
    repl: "const DIFFICULTY_LABELS = ['Refined', 'Fused', 'Adaptive', 'Awakened', 'Normal'];",
    probe: (c) => JSON.stringify(c.parseInstanceName("Nagafen's Lair 3 (Fused)")) },

  { name: 'sentence-backstop-disabled',
    claim: 'a lower-case string is a sentence, not a place',
    find: 'const LOOKS_LIKE_A_SENTENCE = /^[a-z]/;',
    repl: 'const LOOKS_LIKE_A_SENTENCE = /(?!)/;',
    probe: (c) => { const e = c.parseLine(line(19, 10, 0, 'You have entered a string no patch has written yet.')); return e && [e.kind, e.unrecognised === true]; } },

  { name: 'solo-flag-dropped',
    claim: 'a Solo instance is recognised as solo, even though none is modelled',
    find: "      solo: /Solo/.test(m[2] || ''),",
    repl: '      solo: false,',
    probe: (c) => JSON.stringify(c.parseInstanceName("Nagafen's Lair - Solo 3 (Fused)")) },
  // -- AIMED AT PROVENANCE AND THE `why` STRINGS (R95) --------------------
  //
  // THREE CONSUMERS: B, E and C all read provenance, and the `why` strings are
  // what a player eventually reads. Provenance is the whole mechanism that
  // stops a modelled number being taken for a measured one, so a mutation that
  // survives here is a licence to quote a guess as a fact.

  { name: 'lockout-days-relabelled-observed',
    claim: 'the 6-day lockout is CONDITIONAL on the replay period being 1h, never measured',
    find: "  daysProvenance: 'conditional',",
    repl: "  daysProvenance: 'observed',",
    probe: (c) => c.LOCKOUT_MODEL.daysProvenance },

  { name: 'inferred-relabelled-observed',
    claim: 'a reset bracket is INFERRED from two observations, not itself observed',
    // No newline in the anchor. Written `\n` inside a double-quoted JS string
    // it becomes a real newline and matches nothing — the same escaping trap
    // that has produced a NOANCHOR twice already tonight. `String.replace`
    // takes the first occurrence, which is deterministic and enough.
    find: "    provenance: 'inferred',",
    repl: "    provenance: 'observed',",
    // NEEDS A RE-ASSIGNMENT. A bracket is only measurable across the SAME task
    // being granted twice, so a single grant leaves projectReset at
    // `not recorded` and the `inferred` branch is never reached. The first
    // version of this probe did exactly that and reported INERT.
    probe: (c) => JSON.stringify(c.projectReset(stateOf(c, [
      ...beat(8, 21),
      ...grantPair(12, 10, 'Lord Nagafen'),
      ...grantPair(19, 10, 'Lord Nagafen'),
    ]))).slice(0, 220) },

  { name: 'not-recorded-becomes-a-value',
    claim: 'an unmeasured field is `not recorded`, never a default',
    find: "const NOT_RECORDED = Object.freeze({ provenance: 'not recorded', value: null });",
    repl: "const NOT_RECORDED = Object.freeze({ provenance: 'observed', value: 0 });",
    probe: (c) => JSON.stringify(c.projectPeriod(c.createState('x'))) },

  { name: 'coverage-provenance-forced-observed',
    claim: 'coverage with no lines seen is `not recorded`, not observed-empty',
    find: "      provenance: state.firstSeen === null ? 'not recorded' : 'observed',",
    repl: "      provenance: 'observed',",
    probe: (c) => JSON.stringify(c.project(c.createState('x'), NOW).coverage).slice(0, 160) },

  { name: 'cell-why-emptied',
    claim: 'every cell says WHY it reads as it does — a state without a reason is a verdict',
    find: "      return { s: 'open', done, repeats: 0, why: 'no kill observed since the reset, and coverage spans the period' };",
    repl: "      return { s: 'open', done, repeats: 0, why: '' };",
    probe: (c) => { const g = c.projectGrid(stateOf(c, beat(15, 21)), NOW); const cell = g.cells.find((x) => x.state === 'open'); return cell ? String(cell.because).length > 0 : 'no-open-cell'; } },
  // -- AIMED AT REQUEST CLASSIFICATION AND THE CONTROL WINDOW -------------
  //
  // classifyRequests is what turns a hail into evidence, and the control window
  // is what makes a refusal corroborated rather than merely unanswered. Both
  // feed actionability(), which E reads.

  { name: 'control-window-before-widened',
    claim: 'a Voidling line 6 hours earlier is NOT a control for this hail',
    find: 'const CONTROL_BEFORE_MS = 20000;',
    repl: 'const CONTROL_BEFORE_MS = 6 * 60 * 60 * 1000;',
    probe: (c) => c.classifyRequests(stateOf(c, [
      line(19, 4, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
      line(19, 10, 0, "You say, 'danger'"),
    ]))[0].result },

  { name: 'control-window-after-widened',
    claim: 'the control window after a hail is seconds, not hours',
    find: 'const CONTROL_AFTER_MS = 5000;',
    repl: 'const CONTROL_AFTER_MS = 6 * 60 * 60 * 1000;',
    probe: (c) => c.classifyRequests(stateOf(c, [
      line(19, 10, 0, "You say, 'danger'"),
      line(19, 16, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
    ]))[0].result },

  { name: 'grant-matched-backwards-in-time',
    claim: 'a grant must come AFTER its hail, never before',
    find: 'const grant = assignments.find((a) => a.civil >= r.civil && a.civil - r.civil <= GRANT_WINDOW_MS);',
    repl: 'const grant = assignments.find((a) => Math.abs(a.civil - r.civil) <= GRANT_WINDOW_MS);',
    probe: (c) => c.classifyRequests(stateOf(c, [
      line(19, 10, 0, "You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'."),
      line(19, 10, 0, "You say, 'danger'", 2),
    ]))[0].result },

  { name: 'reply-binary-search-always-true',
    claim: 'the control search actually looks in the window',
    find: '    return a < sortedReplies.length && sortedReplies[a] <= hi;',
    repl: '    return sortedReplies.length > 0;',
    probe: (c) => c.classifyRequests(stateOf(c, [
      line(15, 4, 0, "Voidling says, 'Your hubris risks our very reality itself.'"),
      line(19, 10, 0, "You say, 'danger'"),
    ]))[0].positiveControl },
  // R143 PROBE FOR ONE OF MY OWN TESTS.
  //
  // I wrote TWO tests for the Voidling blind spot: one at the parse layer
  // (closing is computed correctly) and one at the projection layer (a
  // non-closing reply does not corroborate a refusal). Both catch
  // `voidling-closing-matches-anything`, so neither is a sole catcher and the
  // second one's unique value is a CLAIM.
  //
  // This mutation separates them: it leaves parseLine alone and removes the
  // applyLine filter, which is a different code path. If only the projection
  // test fires, the second test earns its place. If neither fires, I wrote two
  // tests for one layer and left the other unguarded.
  { name: 'closing-filter-removed-from-applyLine',
    claim: 'the CONTROL SET itself excludes non-closing replies, not just the parse',
    find: '    if (!ev.closing) return state;',
    repl: '    if (false) return state;',
    probe: (c) => stateOf(c, [
      line(19, 10, 0, "Voidling says, 'Some other sentence entirely.'"),
    ]).voidlingReplies.length },
];

const MUTABLE = [FILE_ENGINE, FILE_TEMPLATE, FILE_BUILD];

function restore() {
  execFileSync('git', ['checkout', '--', ...MUTABLE], { cwd: ROOT });
}

function probeOf(mut) {
  delete require.cache[require.resolve(SRC)];
  let core;
  try { core = require(SRC); } catch (e) { return 'LOAD-THREW: ' + e.message; }
  try { return JSON.stringify(mut.probe(core)); } catch (e) { return 'THREW: ' + e.message; }
}

function runTests() {
  const failedFiles = [];
  const names = new Set();
  let failCount = 0;
  for (const t of TESTS) {
    let out;
    try {
      out = execFileSync(process.execPath, [t], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      out = (e.stdout || '') + (e.stderr || '');
      if (!/^ℹ fail \d+$/m.test(out)) { failedFiles.push(path.basename(t)); failCount += 1; continue; }
    }
    const m = /^ℹ fail (\d+)$/m.exec(out);
    if (m && Number(m[1]) > 0) { failedFiles.push(path.basename(t)); failCount += Number(m[1]); }
    for (const n of out.matchAll(/^✖ (.+?) \(/gm)) names.add(n[1]);
  }
  return { failedFiles, failCount, names };
}

function main() {
  const dirty = execFileSync('git', ['status', '--porcelain', ...MUTABLE],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty) {
    console.error('A mutable file is dirty. Commit or stash first — this ' +
                  'harness restores from git and would discard your changes.');
    console.error(dirty);
    process.exit(2);
  }

  // One original per mutable file.
  const originals = new Map();
  for (const f of MUTABLE) originals.set(f, lf(fs.readFileSync(REL(f), 'utf8')));

  console.log('=== BASELINE ===');
  const base = runTests();
  if (base.failCount !== 0) {
    console.error(`  baseline is not green (${base.failCount} failures). Fix first.`);
    process.exit(2);
  }
  console.log('  green');

  // Baseline probe values, from the UNMUTATED module.
  const baseProbe = new Map();
  for (const mut of MUTATIONS) baseProbe.set(mut.name, probeOf(mut));

  const rows = [];
  const everFired = new Set();

  console.log('\n=== MUTATIONS ===');
  for (const mut of MUTATIONS) {
    const file = mut.file || FILE_ENGINE;
    const original = originals.get(file);
    if (!original.includes(lf(mut.find))) {
      rows.push({ mut, outcome: 'NOANCHOR', detail: `anchor not in ${file}` });
      continue;
    }
    fs.writeFileSync(REL(file), original.replace(lf(mut.find), lf(mut.repl)), 'utf8');

    // THE MATCHED PAIR: did this mutation change behaviour at all?
    const after = probeOf(mut);
    const before = baseProbe.get(mut.name);
    const live = after !== before;

    let res = { failCount: 0, failedFiles: [], names: new Set() };
    if (live) {
      try { res = runTests(); } finally { /* restored below */ }
    }
    restore();
    delete require.cache[require.resolve(SRC)];

    for (const n of res.names) everFired.add(n);

    if (!live) {
      rows.push({ mut, outcome: 'INERT', detail: `probe unchanged (${before})` });
    } else if (res.failCount > 0) {
      // NAME THE TESTS, NOT JUST THE FILES — R143.
      //
      // B kept a guard while recording that its unique value was UNDEMONSTRATED:
      // three mutations failed to show it caught anything the old suite missed.
      // The same question applies to every test I have added from a blind spot.
      // **A mutation caught by exactly ONE test is that test earning its place;
      // caught by several, the newest may be redundant.** Printing the names is
      // what makes that checkable instead of assumed.
      rows.push({
        mut,
        outcome: 'CAUGHT',
        detail: `${res.failCount} assertion(s) in ${res.failedFiles.join(', ')}`,
        catchers: [...res.names],
      });
    } else {
      rows.push({ mut, outcome: 'BLIND', detail: `probe ${before} -> ${after}, no test failed` });
    }
  }

  restore();
  const after = execFileSync('git', ['status', '--porcelain', ...MUTABLE],
    { cwd: ROOT, encoding: 'utf8' }).trim();

  // Outcomes never share a column.
  const group = (o) => rows.filter((r) => r.outcome === o);
  for (const o of ['CAUGHT', 'BLIND', 'INERT', 'NOANCHOR']) {
    const g = group(o);
    if (!g.length) continue;
    console.log(`\n  ${o}  (${g.length})`);
    for (const r of g) {
      console.log(`    ${r.mut.name.padEnd(34)} ${r.detail}`);
      // A SOLE CATCHER is a test earning its place; several means the newest
      // guard may be redundant and its unique value is a claim, not a fact.
      if (r.catchers && r.catchers.length === 1) {
        console.log(`        SOLE CATCHER: ${r.catchers[0]}`);
      }
    }
  }

  const totalTests = TESTS.reduce((acc, t) =>
    acc + (fs.readFileSync(t, 'utf8').match(/^test\(/gm) || []).length, 0);

  console.log('\n=== SURFACE ===');
  console.log(`  tests in the suite                   : ${totalTests}`);
  console.log(`  tests that failed under >=1 mutation : ${everFired.size}`);
  console.log(`  never exercised by THIS mutation set : ${totalTests - everFired.size}`);
  console.log('  The last number is a fact about these mutations, NOT proof the');
  console.log('  remaining tests are vacuous. Add mutations to shrink it.');

  console.log('\n=== RESULT ===');
  const blind = group('BLIND');
  const inert = group('INERT');
  const noanchor = group('NOANCHOR');
  console.log(`  ${group('CAUGHT').length} caught · ${blind.length} BLIND · ` +
              `${inert.length} inert · ${noanchor.length} no-anchor`);
  for (const r of blind) console.log(`    BLIND: ${r.mut.name} — ${r.mut.claim}`);
  for (const r of inert) console.log(`    INERT (verdict meaningless, fix the mutation): ${r.mut.name}`);
  for (const r of noanchor) console.log(`    NO ANCHOR (harness is stale): ${r.mut.name}`);
  console.log(`\n  tree after restore: ${after ? 'DIRTY — ' + after : 'clean'}`);

  if (after) process.exit(2);
  process.exitCode = (blind.length || inert.length || noanchor.length) ? 1 : 0;
}

main();
