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

// Does the BUILT page still SAY a thing? `built()` reports fonts and urls; a
// provenance row is a sentence, and a sentence needs its own reader.
function builtSays(re) {
  const b = built();
  if (b === 'BUILD-FAILED') return b;
  const name = fs.readFileSync(path.join(OUT, 'latest.txt'), 'utf8').trim();
  return re.test(fs.readFileSync(path.join(OUT, name), 'utf8'));
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
  // -- AIMED AT THE BOUNDARY-DAY HYPOTHESIS PAIR AND THE PER-BOSS VIEW ----
  //
  // On the reset day itself the period start is ambiguous, so projectGrid runs
  // TWO hypotheses and only agrees a cell when both do. That pair is the entire
  // machinery behind `conditional`, and `conditional` is the state that exists
  // to carry an unmeasured reset hour.

  { name: 'second-hypothesis-collapsed',
    claim: 'on the boundary day two hypotheses run, and disagreement is conditional',
    find: '      const h2 = (onBoundaryDay && !hourKnown) ? under(priorBoundaryStart, d) : h1;',
    repl: '      const h2 = h1;',
    // THE KILL MUST LAND WHERE THE HYPOTHESES DISAGREE. A kill on the boundary
    // day itself is `conditional` via the onDay branch whether or not h2 runs,
    // so the first version of this probe returned [1,0,24] both ways and was
    // INERT. A kill on day 17 is INSIDE the prior period (h2) and OUTSIDE the
    // new one (h1) — which is the only place the pair can be seen.
    probe: (c) => {
      const st = stateOf(c, [
        ...beat(11, 18),
        line(17, 20, 0, 'You have entered The Plane of Hate - Group 3 (Fused).'),
        line(17, 20, 10, 'Innoruuk, the Prince of Hate has been slain by X!'),
      ]);
      const g = c.projectGrid(st, { year: 2026, month: 8, day: 18, hour: 20, minute: 0, second: 0 });
      return [g.conditionalCount, g.completedCount, g.openCount, g.uncertainCount];
    } },

  { name: 'boundary-day-detection-disabled',
    claim: 'the module knows when NOW is the reset day itself',
    find: '  const onBoundaryDay = nowCivil >= boundaryDayStart && nowCivil < boundaryDayEnd;',
    repl: '  const onBoundaryDay = false;',
    probe: (c) => {
      const g = c.projectGrid(stateOf(c, beat(11, 18)), { year: 2026, month: 8, day: 18, hour: 20, minute: 0, second: 0 });
      return [g.period.nowIsOnBoundaryDay, g.conditionalCount];
    } },

  { name: 'last-completed-reads-assignments',
    claim: 'the per-boss view distinguishes when a task was GRANTED from when it was DONE',
    find: '    const lastCompleted = t.completions[t.completions.length - 1] || null;',
    repl: '    const lastCompleted = t.assignments[t.assignments.length - 1] || null;',
    // READ THE FIELD, DO NOT TRUNCATE TOWARD IT. The first version sliced the
    // serialised bosses array at 240 characters and stopped just before
    // `lastCompleted` — so the probe reported INERT on a live mutation.
    probe: (c) => {
      const st = stateOf(c, [...beat(15, 21), ...grantPair(19, 10, 'Lord Nagafen')]);
      const b = c.project(st, NOW).bosses[0];
      return b ? [b.timesCompleted, JSON.stringify(b.lastCompleted)] : 'no-boss';
    } },
  // -- AIMED AT INSTANCE ATTRIBUTION AND THE INVITE PATH ------------------
  //
  // `currentInstance` is how a kill gets its difficulty. Wrong, and a kill
  // lands in the wrong tier of the right raid — a cell completed that the
  // player has not done, which is the failure R160 names.

  { name: 'kill-attributed-with-no-instance',
    claim: 'a kill in the open world resolves NO cell — attribution is not optional',
    find: '        difficulty: inst ? inst.difficulty : null,',
    repl: '        difficulty: inst ? inst.difficulty : 0,',
    probe: (c) => {
      const st = stateOf(c, [line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!')]);
      return st.kills.length ? [st.kills[0].difficulty, st.kills[0].zone] : 'no-kill';
    } },

  { name: 'instance-not-cleared-on-open-world',
    claim: 'zoning into the open world clears the instance, so later kills are unattributed',
    find: '      state.currentInstance = ev.instanced',
    repl: '      if (ev.instanced) state.currentInstance = ev.instanced',
    probe: (c) => {
      const st = stateOf(c, [
        line(19, 11, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."),
        line(19, 12, 0, 'You have entered Nektulos Forest.'),
        line(19, 12, 30, 'Lord Nagafen has been slain by Avenrae!'),
      ]);
      return st.kills.length ? [st.kills[0].difficulty, st.kills[0].zone] : 'no-kill';
    } },

  { name: 'invite-parsed-as-a-zone-in',
    claim: 'an INVITE is not an entry — being asked to join is not being inside',
    find: "    return { kind: 'instance-invite', at, from: m[1], ...parseInstanceName(m[2]) };",
    repl: "    return { kind: 'entered', at, ...parseInstanceName(m[2]) };",
    probe: (c) => {
      const e = c.parseLine(line(19, 10, 0, "Someone has asked you to join the instance: Nagafen's Lair - Group 3 (Fused). Would you like to join?"));
      return e && e.kind;
    } },
  // -- AIMED AT REPLAY IDEMPOTENCE AND THE DEDUPE KEY --------------------
  //
  // The module's headline guarantee is that replaying a log does not
  // double-count. The dedupe key is what delivers it, and a key that drops a
  // component collides two distinct events into one — a SILENT LOST
  // COMPLETION, which for a tool whose job is "do not forget a raid" is the
  // wrong direction to fail in.

  { name: 'kill-key-drops-the-slain-name',
    claim: 'two different bosses dying in the same second are two events',
    find: "      return `${civil}|kill|${ev.slain}`;",
    repl: "      return `${civil}|kill`;",
    probe: (c) => stateOf(c, [
      line(19, 11, 0, "You have entered The Plane of Fear - Group 3 (Fused)."),
      line(19, 11, 30, 'Terror has been slain by Avenrae!'),
      line(19, 11, 30, 'Dread has been slain by Avenrae!'),
    ]).kills.length },

  { name: 'task-key-drops-the-task-name',
    claim: 'two different weeklies granted in the same second are two grants',
    find: "      return `${civil}|${ev.kind}|${ev.task}`;",
    repl: "      return `${civil}|${ev.kind}`;",
    probe: (c) => {
      const st = stateOf(c, [
        line(19, 10, 0, "You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'."),
        line(19, 10, 0, "You have been assigned the task 'Potential of the Void - Lady Vox - Weekly'."),
      ]);
      return Object.keys(st.tasks).length;
    } },

  { name: 'dedupe-index-never-consulted',
    claim: 'replaying a log is IDEMPOTENT — the headline guarantee',
    find: '  if (Object.prototype.hasOwnProperty.call(state.seen, key)) {',
    repl: '  if (false) {',
    probe: (c) => {
      const lines = [
        line(19, 11, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."),
        line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!'),
      ];
      const st = stateOf(c, [...lines, ...lines]);   // the same log, twice
      return [st.kills.length, st.dropped.duplicate];
    } },
  // -- R167: EVERY SIBLING OF THE dedupeKey SWITCH ------------------------
  //
  // The task-key gap was found because its sibling `kill` had twelve lines of
  // reasoning and a test while it had neither. R167 says a fix in a switch is
  // not complete until every sibling is named covered or excluded. dedupeKey
  // has eight. These mutate the three remaining ones that carry a
  // discriminator; the two that carry NONE are handled by the test below
  // rather than here, because for them collapsing is the intent.

  { name: 'given-key-drops-the-item',
    claim: 'two different items given in the same second are two grants',
    find: "      return `${civil}|given|${ev.item}`;",
    repl: "      return `${civil}|given`;",
    probe: (c) => stateOf(c, [
      line(19, 10, 0, 'You have been given: a Shiny Brass Idol.'),
      line(19, 10, 0, 'You have been given: a Rusty Dagger.'),
    ]).grants.length },

  { name: 'entered-key-drops-the-difficulty',
    claim: 'two zone-ins to the same zone at different tiers are two entries',
    find: "      return `${civil}|entered|${ev.zone}|${ev.difficulty}`;",
    repl: "      return `${civil}|entered|${ev.zone}`;",
    probe: (c) => {
      const st = stateOf(c, [
        line(19, 10, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."),
        line(19, 10, 0, "You have entered Nagafen's Lair - Group 4 (Refined)."),
      ]);
      return [Object.keys(st.instances).length, st.currentInstance && st.currentInstance.difficulty];
    } },

  { name: 'invite-key-drops-the-sender',
    claim: 'two invites in the same second from different players are two invites',
    find: "      return `${civil}|invite|${ev.from}|${ev.zone}|${ev.difficulty}`;",
    repl: "      return `${civil}|invite|${ev.zone}|${ev.difficulty}`;",
    probe: (c) => stateOf(c, [
      line(19, 10, 0, "Alpha has asked you to join the instance: Nagafen's Lair - Group 3 (Fused). Would you like to join?"),
      line(19, 10, 0, "Beta has asked you to join the instance: Nagafen's Lair - Group 3 (Fused). Would you like to join?"),
    ]).dropped.duplicate },
  // -- R167 APPLIED TO THE FIVE CELL STATES ------------------------------
  //
  // The second sibling family in this engine, and the one with the most
  // consumers: the cell-state vocabulary. B encodes it as data in a
  // disjointness test, C renders it, and a player reads it. Five production
  // sites, one mutation each, swapping the state for a plausible neighbour.
  //
  // R167's question, asked of a family that is not a switch: which of these
  // siblings has a guard, and which merely has a call site?

  { name: 'state-completed-becomes-open',
    claim: '`completed` is OBSERVED — a kill line at that tier in this period',
    find: "          s: 'completed',",
    repl: "          s: 'open',",
    probe: (c) => {
      const st = stateOf(c, [...beat(15, 21),
        line(19, 11, 0, "You have entered Nagafen's Lair - Group 3 (Fused)."),
        line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!')]);
      const g = c.projectGrid(st, NOW);
      return [g.completedCount, g.openCount];
    } },

  { name: 'state-open-becomes-unknown',
    claim: '`open` is INFERRED from the one-per-tier model plus spanning coverage',
    find: "      return { s: 'open', done, repeats: 0, why: 'no kill observed since the reset, and coverage spans the period' };",
    repl: "      return { s: 'unknown', done, repeats: 0, why: 'no kill observed since the reset, and coverage spans the period' };",
    probe: (c) => {
      const g = c.projectGrid(stateOf(c, beat(15, 21)), NOW);
      return [g.openCount, g.uncertainCount];
    } },

  { name: 'state-not-looked-becomes-open',
    claim: '`not_looked` must NEVER render as available — the whole product',
    find: "        cellState = 'not_looked';",
    repl: "        cellState = 'open';",
    probe: (c) => {
      const g = c.projectGrid(c.createState('Avenrae'), NOW);
      return [g.notLookedCount, g.openCount];
    } },

  { name: 'state-unknown-becomes-open',
    claim: 'a kill at a tier the game did not state makes the ROW unknown, not open',
    find: "        return { s: 'unknown', done, repeats: 0, why: `${unstated.length} kill(s) this period at a tier the game did not state — one of this raid's five tiers may be done` };",
    repl: "        return { s: 'open', done, repeats: 0, why: `${unstated.length} kill(s) this period at a tier the game did not state — one of this raid's five tiers may be done` };",
    probe: (c) => {
      const st = stateOf(c, [...beat(15, 21),
        line(19, 11, 0, 'You have entered The Plane of Fear - Solo.'),
        line(19, 11, 30, 'Cazic-Thule has been slain by Avenrae!')]);
      const g = c.projectGrid(st, NOW);
      return [g.uncertainCount, g.openCount];
    } },

  { name: 'hypothesis-disagreement-collapses-to-unknown',
    claim: 'disagreement emits `conditional` WITH both outcomes, never a bare shrug',
    find: "        cellState = 'conditional';",
    repl: "        cellState = 'unknown';",
    probe: (c) => {
      const st = stateOf(c, [...beat(11, 18),
        line(17, 20, 0, 'You have entered The Plane of Hate - Group 3 (Fused).'),
        line(17, 20, 10, 'Innoruuk, the Prince of Hate has been slain by X!')]);
      const g = c.projectGrid(st, { year: 2026, month: 8, day: 18, hour: 20, minute: 0, second: 0 });
      return [g.conditionalCount, g.uncertainCount];
    } },
  // -- R177: THE INVISIBLE MECHANISMS ------------------------------------
  //
  // Chosen by the heuristic rather than by guessing. Both are internal: their
  // correctness never appears in ordinary output, and both need a constructed
  // input to see fail — which is what R177 says predicts a missing guard.

  { name: 'prune-keeps-the-OLDEST-half',
    claim: 'pruning the dedupe index keeps the NEWEST half — the oldest is what may be dropped',
    find: '  const keep = entries.slice(Math.floor(entries.length / 2));',
    repl: '  const keep = entries.slice(0, Math.floor(entries.length / 2));',
    // PRUNING ONLY RUNS ABOVE MAX_SEEN. The first version of this probe put six
    // entries in the index and reported INERT, because `applyLine` calls
    // pruneSeen only when seenCount exceeds 200,000 — so the mutated line never
    // executed. Raising seenCount past the bound with a handful of real entries
    // reaches it without building 200k of them.
    probe: (c) => {
      const st = c.createState('Avenrae');
      for (let i = 0; i < 6; i++) st.seen[`k${i}`] = 1000 + i;
      st.seenCount = c.THRESHOLDS.MAX_EVENTS * 1e6;   // safely past MAX_SEEN
      c.applyLine(st, line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!'));
      const kept = Object.values(st.seen).filter((v) => v < 2000).sort((a, b) => a - b);
      return kept;                                     // WHICH half survived
    } },

  // MEASURED LIVE, NOT DEAD — AND MY REASONING SAID OTHERWISE.
  //
  // I argued from the code that this loop was unreachable: a point close enough
  // to bridge two spans would be caught by the early return above. Then I
  // instrumented a copy of the engine and ran the real corpus: 749,255 lines,
  // 8 spans pushed, **1 bridge merge**. The loop is live and fires about once
  // per three-quarters of a million lines.
  //
  // My fixture does not reproduce that shape, so this mutation reports INERT
  // and I cannot say whether the loop is guarded. That is the honest state:
  // an unmeasured guard, not a blind one.
  { name: 'span-bridge-merge-removed',
    claim: 'a new observation BRIDGING two spans merges them into one',
    find: '      spans[i - 1].to = Math.max(spans[i - 1].to, spans[i].to);',
    repl: '      spans[i - 1].to = spans[i - 1].to;',
    probe: (c) => {
      // Two blocks 50 minutes apart — beyond SPAN_GAP_MS, so two spans — then
      // an observation in the middle that bridges them.
      const st = stateOf(c, [
        line(19, 10, 0, 'You have entered Nektulos Forest.'),
        line(19, 10, 50, 'You have entered Nektulos Forest.'),
        line(19, 10, 25, 'You have entered Nektulos Forest.'),
      ]);
      return [st.spans.length, st.spans.map((x) => (x.to - x.from) / 60000)];
    } },

  { name: 'span-extends-only-forwards',
    claim: 'an observation BEFORE a span extends it backwards, not just forwards',
    find: '      if (civil < sp.from) sp.from = civil;',
    repl: '      if (false) sp.from = civil;',
    probe: (c) => {
      const st = stateOf(c, [
        line(19, 10, 30, 'You have entered Nektulos Forest.'),
        line(19, 10, 10, 'You have entered Nektulos Forest.'),
      ]);
      return st.spans.map((x) => [(x.to - x.from) / 60000]);
    } },
  // -- R177 PASS 2: THE REMAINING INVISIBLE MECHANISMS -------------------

  { name: 'beyond-horizon-counter-never-fires',
    claim: 'a line older than the whole index is COUNTED, not silently accepted',
    // ANCHOR REPAIRED 3 Sep: the 1 Sep horizon fix moved both operands out of
    // this line and the harness went NOANCHOR — correctly reporting itself stale
    // rather than reporting the guard as blind.
    find: '  if (horizonCount >= MAX_SEEN && civil < horizonOldest) {',
    repl: '  if (false) {',
    probe: (c) => {
      const st = c.createState('Avenrae');
      for (let i = 0; i < 4; i++) st.seen[`k${i}`] = 9e12 + i;   // all far in the future
      st.seenCount = 1e12;                                        // past MAX_SEEN
      c.applyLine(st, line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!'));
      return st.dropped.beyondDedupeHorizon;
    } },

  { name: 'oldest-seen-returns-zero-when-empty',
    claim: 'an EMPTY index has no oldest entry — Infinity, so nothing is beyond it',
    find: '  let min = Infinity;',
    repl: '  let min = 0;',
    probe: (c) => {
      const st = c.createState('Avenrae');
      st.seenCount = 1e12;                 // past MAX_SEEN with an EMPTY index
      c.applyLine(st, line(19, 11, 30, 'Lord Nagafen has been slain by Avenrae!'));
      return [st.dropped.beyondDedupeHorizon, st.kills.length];
    } },

  { name: 'hole-threshold-becomes-inclusive',
    claim: 'a gap EQUAL to the tolerance is tolerated, not a hole',
    find: '  const holes = allGaps.filter((g) => g.to - g.from > PERIOD_GAP_TOLERANCE_MS);',
    repl: '  const holes = allGaps.filter((g) => g.to - g.from >= PERIOD_GAP_TOLERANCE_MS);',
    probe: (c) => {
      // Two blocks exactly 24 h apart — the boundary case the comparison decides.
      const st = stateOf(c, [
        ...beat(15, 19),
        line(20, 12, 0, 'You have entered Nektulos Forest.'),
        line(21, 12, 0, 'You have entered Nektulos Forest.'),
      ]);
      const g = c.projectGrid(st, NOW);
      return [g.period.coverageHoles.length, g.period.coverageSpansPeriod];
    } },
  // -- R177 SWEEP, 3 Sep: SEVEN INVISIBLE MECHANISMS, NONE PREVIOUSLY TOUCHED
  //
  // Chosen by the heuristic, not by guessing: each one's correctness never
  // appears in ordinary output, and each needs a constructed input to see fail.

  { name: 'observed-fraction-double-counts-overlap',
    claim: 'overlapping spans are counted ONCE toward the observed fraction',
    find: '    if (b > a && b > cursorObs) observedMs += b - Math.max(a, cursorObs);',
    repl: '    if (b > a) observedMs += b - a;',
    probe: (c) => {
      const st = c.createState('Avenrae');
      // Two DELIBERATELY overlapping spans, which noteCoverage would merge but
      // a restored/persisted state can carry.
      st.spans = [{ from: Date.UTC(2026,7,18,0,0,0), to: Date.UTC(2026,7,20,0,0,0) },
                  { from: Date.UTC(2026,7,19,0,0,0), to: Date.UTC(2026,7,21,0,0,0) }];
      st.firstSeen = st.spans[0].from; st.lastSeen = st.spans[1].to;
      return c.projectGrid(st, NOW).period.coverageObservedFraction;
    } },

  { name: 'from-civil-weekday-off-by-one',
    claim: 'fromCivil is the exact inverse of civilOf, weekday included',
    find: "    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()],",
    repl: "    weekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.getUTCDay()],",
    probe: (c) => {
      const at = { weekday: 'Wed', year: 2026, month: 8, day: 19, hour: 10, minute: 0, second: 0 };
      return JSON.stringify(c.fromCivil(c.civilOf(at)));
    } },

  { name: 'character-from-filename-takes-the-server',
    claim: 'the CHARACTER is the first field of the log filename, not the server',
    find: "  const m = /^eqlog_([^_]+)_/i.exec(String(filename)",
    repl: "  const m = /^eqlog_[^_]+_([^_.]+)/i.exec(String(filename)",
    probe: (c) => [c.characterFromLogFilename('eqlog_Avenrae_rivervale.txt'),
                   c.characterFromLogFilename('C:/x/eqlog_Shara_rivervale_2026-08-19.txt')] },

  { name: 'bracket-width-measured-from-the-wrong-end',
    claim: 'a reset bracket is as wide as the interval it brackets',
    find: '        widthHours: (next.civil - after.civil) / 3600000,',
    repl: '        widthHours: 0,',
    probe: (c) => {
      const st = stateOf(c, [...beat(8, 21),
        ...grantPair(12, 10, 'Lord Nagafen'), ...grantPair(19, 10, 'Lord Nagafen')]);
      const r = c.projectReset(st);
      return r.brackets ? r.brackets.map((b) => b.widthHours) : String(r.provenance);
    } },

  { name: 'voidling-bound-drops-the-NEWEST',
    claim: 'the Voidling bound drops the OLDEST second — a refusal degrades to unknown, never to a false refused',
    find: '      if (state.voidlingReplies.length > MAX_VOIDLING_REPLIES) state.voidlingReplies.shift();',
    repl: '      if (state.voidlingReplies.length > MAX_VOIDLING_REPLIES) state.voidlingReplies.pop();',
    // THE BOUND ONLY RUNS ABOVE MAX_VOIDLING_REPLIES. Pre-fill to exactly the
    // cap with sentinel values, then add one real reply so the guard fires on
    // this call. A three-element fixture never reaches it and reports INERT.
    probe: (c) => {
      const st = c.createState('Avenrae');
      const CAP = c.THRESHOLDS.MAX_VOIDLING_REPLIES;
      st.voidlingReplies = Array.from({ length: CAP }, (_, i) => i + 1);
      c.applyLine(st, line(19, 10, 0, "Voidling says, 'Your hubris risks our very reality itself.'"));
      const v = st.voidlingReplies;
      return [v.length, v[0], v[v.length - 1]];
    } },

  { name: 'task-cadence-dropped',
    claim: 'a task name yields series, boss AND cadence — cadence is what makes it weekly',
    find: '  return { task: taskName, series: m[1], boss: m[2], cadence: m[3] };',
    repl: '  return { task: taskName, series: m[1], boss: m[2], cadence: null };',
    probe: (c) => {
      const e = c.parseLine(line(19, 10, 0, "You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'."));
      return e ? [e.series, e.boss, e.cadence] : null;
    } },

  { name: 'requests-bound-drops-the-NEWEST',
    claim: 'the request log drops the OLDEST when bounded',
    find: '    if (state.requests.length > MAX_EVENTS) state.requests.shift();',
    repl: '    if (state.requests.length > MAX_EVENTS) state.requests.pop();',
    // Same shape: pre-fill to the cap so the shift/pop actually runs.
    probe: (c) => {
      const st = c.createState('Avenrae');
      const CAP = c.THRESHOLDS.MAX_EVENTS;
      st.requests = Array.from({ length: CAP }, (_, i) => ({ civil: i + 1, at: null }));
      c.applyLine(st, line(19, 10, 0, "You say, 'danger'"));
      const r = st.requests;
      return [r.length, r[0].civil, r[r.length - 1].civil];
    } },

  // ── AIMED AT TODAY'S OWN ADDITIONS (3 Sep) ─────────────────────────────
  //
  // Everything below was written in the last few hours, fast, to satisfy the
  // Director's rulings, and none of it had ever been graded. Their stated
  // prediction: assertions written to DEMONSTRATE COMPLIANCE are the ones most
  // likely to be unfalsifiable. One had already proved it — the
  // instance-created branch was nested where it could never run, and the
  // "changes no cell" assertion passed, because a dead branch also changes no
  // cell. These are aimed at the rest of that day's work.


  // ── THE REST OF THE BOUND FAMILY. The Director named three; there are FIVE.
  // `events` and `kills` had never been mutated at all — not blind, UNMEASURED,
  // which my report did not say. `kills` is the one that matters: dropping the
  // NEWEST kill loses a completion, which is the single failure this tool
  // exists to prevent.
  { name: 'events-bound-drops-the-NEWEST',
    claim: 'the event log drops the OLDEST when bounded',
    find: '  if (state.events.length > MAX_EVENTS) state.events.shift();',
    repl: '  if (state.events.length > MAX_EVENTS) state.events.pop();',
    probe: (c) => {
      const st = c.createState('Avenrae');
      const CAP = c.THRESHOLDS.MAX_EVENTS;
      st.events = Array.from({ length: CAP }, (_, i) => ({ key: 'k' + i, kind: 'x', civil: i + 1, at: null }));
      c.applyLine(st, line(19, 10, 0, 'You have entered Nektulos Forest.'));
      const e = st.events;
      return [e.length, e[0].civil, e[e.length - 1].kind];
    } },

  { name: 'kills-bound-drops-the-NEWEST',
    claim: 'the kill log drops the OLDEST when bounded — a dropped NEWEST kill is a lost completion',
    find: '      if (state.kills.length > MAX_EVENTS) state.kills.shift();',
    repl: '      if (state.kills.length > MAX_EVENTS) state.kills.pop();',
    probe: (c) => {
      const st = c.createState('Avenrae');
      const CAP = c.THRESHOLDS.MAX_EVENTS;
      st.kills = Array.from({ length: CAP }, (_, i) => ({ civil: i + 1, boss: 'filler' + i, raid: 'x' }));
      c.applyLines(st, [
        line(19, 10, 0, 'You have entered The Plane of Hate - Group 4 (Refined).'),
        line(19, 10, 30, 'Maestro of Rancor has been slain by Chrysaetos!'),
      ]);
      const k = st.kills;
      return [k.length, k[0].boss, k[k.length - 1].boss];
    } },

  { name: 'creating-instance-regex-broken',
    claim: 'the only line that identifies an instance is parsed at all',
    find: 'const CREATING_RE = /^Player (.+?) creating instance (.+?) (\\d+)\\.$/;',
    repl: 'const CREATING_RE = /^Player (.+?) creating expedition (.+?) (\\d+)\\.$/;',
    probe: (c) => {
      const e = c.parseLine(line(19, 10, 0, 'Player Avenrae creating instance The Plane of Hate 3846.'));
      return e ? [e.kind, e.instanceId, e.zone] : null;
    } },

  { name: 'instance-created-branch-renested',
    claim: 'the creation branch sits where it can actually run',
    // THE EXACT BUG I SHIPPED AND CAUGHT. Nesting it under the entered/invite
    // guard leaves it unreachable. A guard asserting only that cells do not
    // move is satisfied by a branch that never executes, so this mutation is
    // what says whether the POSITIVE half of that test exists.
    find: "  if (ev.kind === 'instance-created') {",
    repl: "  if (ev.kind === 'instance-created' && ev.kind === 'entered') {",
    probe: (c) => stateOf(c, [line(19, 10, 0, 'Player Avenrae creating instance The Plane of Hate 3846.')]).instanceCreations.length },

  { name: 'instance-creations-bound-drops-the-NEWEST',
    claim: 'the creation log drops the OLDEST when bounded',
    find: '    if (state.instanceCreations.length > MAX_INSTANCE_CREATIONS) state.instanceCreations.shift();',
    repl: '    if (state.instanceCreations.length > MAX_INSTANCE_CREATIONS) state.instanceCreations.pop();',
    probe: (c) => {
      const st = c.createState('Avenrae');
      for (let i = 0; i < 2005; i++) {
        const mm = i % 1440, d = 1 + Math.floor(i / 1440);
        c.applyLine(st, line(d, Math.floor(mm / 60), mm % 60,
          'Player Avenrae creating instance The Plane of Hate ' + (1000 + i) + '.'));
      }
      const a = st.instanceCreations;
      return [a.length, a[0] && a[0].instanceId, a[a.length - 1] && a[a.length - 1].instanceId];
    } },

  { name: 'instanced-entries-never-counted',
    claim: 'the denominator beside the creation count is real',
    find: '      if (ev.instanced) state.instancedEntries++;',
    repl: '      if (false) state.instancedEntries++;',
    probe: (c) => {
      const st = stateOf(c, [
        line(19, 10, 0, 'You have entered The Plane of Hate - Group 4 (Refined).'),
        line(19, 10, 5, 'Player Avenrae creating instance The Plane of Hate 3846.'),
      ]);
      const g = c.projectGrid(st, NOW);
      return [g.instanceCreations.instancedEntries, g.instanceCreations.coveragePct];
    } },

  { name: 'coverage-pct-zero-instead-of-null',
    claim: 'no denominator yields NO PERCENTAGE, never 0%',
    // 0% asserts a measured absence where there is nothing to measure against.
    // The Director called this field the unifying law reduced to one line,
    // which makes it exactly the kind written to please rather than to catch.
    // Either a test fails here or the law is decoration.
    find: '        : null,',
    repl: '        : 0,',
    probe: (c) => c.projectGrid(c.createState('Avenrae'), NOW).instanceCreations.coveragePct },

  { name: 'shape-note-never-reaches-the-cell',
    claim: 'the Hate cells say which instance shape they describe',
    find: '        shapeNote: entry.shapeNote || null,',
    repl: '        shapeNote: null,',
    probe: (c) => {
      const g = c.projectGrid(stateOf(c, beat(19, 20)), NOW);
      return g.cells.filter((x) => x.label === 'Plane of Hate').map((x) => x.shapeNote && x.shapeNote.slice(0, 30));
    } },

  { name: 'shape-note-leaks-to-every-row',
    claim: 'only the row with a shape question carries the caveat',
    // A caveat on every row is as wrong as a caveat on none: it would tell a
    // reader that Nagafen's Lair has a raid-shape ambiguity nobody measured.
    find: '        shapeNote: entry.shapeNote || null,',
    repl: "        shapeNote: entry.shapeNote || 'this cell is the GROUP instance (stated)',",
    probe: (c) => {
      const g = c.projectGrid(stateOf(c, beat(19, 20)), NOW);
      return g.cells.filter((x) => x.label !== 'Plane of Hate' && x.shapeNote !== null).length;
    } },

  { name: 'shape-note-claims-it-was-measured',
    claim: 'a stated fact never dresses itself as an observation',
    // The owner told us; we did not measure it and could not have. The
    // assertion guarding this was written today — in a first version that
    // could not tell the claim "measured by us" from its own denial "not
    // measured by us".
    // ANCHOR WRITTEN AGAINST A DEAD DRAFT. My first version quoted the note's
    // ORIGINAL wording, from before the owner answered and the note stopped
    // hedging. The harness reported NOANCHOR — stale instrument, not a finding.
    find: "               'tracked here — owner, stated, not measured by us',",
    repl: "               'tracked here — owner, observed and measured by us',",
    probe: (c) => {
      const g = c.projectGrid(stateOf(c, beat(19, 20)), NOW);
      const h = g.cells.find((x) => x.label === 'Plane of Hate');
      return h && h.shapeNote;
    } },

  { name: 'the-witness-leaks-into-a-cell',
    claim: 'a creation line moves NO cell — the witness never becomes a model',
    // The deepEqual guard exists to stop the instance id being used to decide
    // something once that looks convenient. If nothing fails here, the guard is
    // decoration and the id is one edit from driving state unnoticed.
    find: '        singleBoss: entry.singleBoss === true,',
    repl: '        singleBoss: state.instanceCreations.length ? false : entry.singleBoss === true,',
    probe: (c) => {
      const st = stateOf(c, [
        ...beat(19, 20),
        line(20, 21, 0, 'Player Avenrae creating instance The Plane of Hate 3846.'),
      ]);
      return c.projectGrid(st, NOW).cells.map((x) => x.singleBoss).join(',');
    } },

  { name: 'regime-provenance-row-removed',
    file: FILE_TEMPLATE,
    claim: 'the page states that its rules span a weekly-reset change',
    find: '    ["regime", "the rules here come from a corpus spanning a weekly-reset " +',
    repl: '    ["regime", "not stated"], ["regime-dead", "" +',
    // THE REGEX MUST NOT SPAN A CONCATENATION. The page embeds the template's
    // JS as source, so `"...a weekly-reset " + "change announced 18 Aug..."`
    // appears with the `" +` break intact. My first probe matched across it,
    // found nothing on CLEAN code, and reported INERT — correctly, and about my
    // instrument rather than the page.
    // AND IT MUST TARGET THE LINE THE MUTATION ACTUALLY REPLACES. Aimed at the
    // SECOND literal, the probe read `true` either way — the mutation removes
    // the row's first line and leaves the rest as dead source, which the page
    // still embeds. INERT again, and again about my instrument.
    probe: () => builtSays(/the rules here come from a corpus spanning a weekly-reset/) },

  { name: 'instance-shape-provenance-row-removed',
    file: FILE_TEMPLATE,
    claim: 'the page states that every cell is a group instance',
    find: '    ["instance shape", "every cell here is a GROUP instance — the completion " +',
    repl: '    ["instance shape", "not stated"], ["shape-dead", "" +',
    probe: () => builtSays(/every cell here is a GROUP instance/) },
];


// Tests that fail on ANY edit to a built source file, behavioural or not.
// They are legitimate tests and useless as mutation catchers: see the note at
// the verdict. Matched by substring against the test name.
const UNIVERSAL_CATCHERS = [
  'the COMMITTED latest.txt names what the CURRENT SOURCE produces',
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

    // The universal catcher fires on ANY edit, so counting it here would
    // inflate SURFACE by one test that no mutation actually exercises.
    for (const n of res.names) {
      if (UNIVERSAL_CATCHERS.some((u) => n.includes(u))) continue;
      everFired.add(n);
    }

    // ── A UNIVERSAL CATCHER IS NOT A CATCHER. ────────────────────────────
    //
    // `BUILD: the COMMITTED latest.txt names what the CURRENT SOURCE produces`
    // compares the committed artifact pointer against a fresh build, so ANY
    // edit to a built source file fails it — including one that changes no
    // behaviour at all. PROVEN, not assumed: appending a lone comment line to
    // src/lockoutCore.js fails that test and nothing else.
    //
    // It is a good test. It is not a behavioural guard, and counting it as one
    // made this harness report CAUGHT for every mutation that touched the
    // engine. **79 of 79 listed it. Six were caught by NOTHING ELSE**, and I
    // had reported those to the Director as guarded.
    //
    // The verdict now ignores it. A mutation whose only catcher was the pointer
    // is BLIND, which is what it always was.
    const universal = [...res.names].filter((n) => UNIVERSAL_CATCHERS.some((u) => n.includes(u)));
    const real = [...res.names].filter((n) => !UNIVERSAL_CATCHERS.some((u) => n.includes(u)));

    if (!live) {
      rows.push({ mut, outcome: 'INERT', detail: `probe unchanged (${before})` });
    } else if (real.length === 0 && universal.length > 0) {
      rows.push({
        mut,
        outcome: 'BLIND',
        detail: `probe ${before} -> ${after}; only the universal catcher fired ` +
                `(${universal.join(', ')}) — no test asserts this behaviour`,
      });
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
        catchers: real,
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

  // ── UNMEASURED IS A VERDICT, NOT AN ABSENCE OF ONE. ──────────────────
  //
  // `BLIND` means mutated and survived. A site with NO mutation produced no row
  // at all, and my report rendered the two identically — so `state.events` and
  // `state.kills` sat outside a bound sweep I had told the Director was
  // complete. Same defect as counting the universal catcher, in the opposite
  // direction: one inflated CAUGHT, this one silently shrank the denominator.
  //
  // A family is only checkable this way if it can be ENUMERATED FROM SOURCE.
  // That is the constraint, not a limitation: a hand-written list of sites
  // would reproduce exactly the gap it is meant to detect.
  const FAMILIES = [
    {
      label: 'bounded arrays — every `.shift()` bound must have a mutation',
      sites: (src) => [...src.matchAll(/state\.(\w+)\.length > MAX_\w+\) state\.\1\.shift\(\)/g)]
        .map((m) => m[1]),
      covered: (site) => MUTATIONS.some((m) => (m.find || '').includes(`state.${site}.length >`)),
    },
  ];

  const engineSrc = fs.readFileSync(REL(FILE_ENGINE), 'utf8');
  const unmeasured = [];
  console.log('\n=== FAMILY COVERAGE (UNMEASURED, not BLIND) ===');
  for (const fam of FAMILIES) {
    const sites = fam.sites(engineSrc);
    const missing = sites.filter((s) => !fam.covered(s));
    console.log(`  ${fam.label}`);
    console.log(`    ${sites.length} site(s) in source, ${sites.length - missing.length} with a mutation`);
    for (const s of missing) { unmeasured.push(s); console.log(`    UNMEASURED: state.${s} — bounded, never mutated`); }
    if (!missing.length) console.log('    none unmeasured');
  }

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
