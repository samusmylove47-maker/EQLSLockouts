// RE-DERIVE THE TOKEN CAP FROM LOGS, so the constant in `TOKEN_CAP` is
// reproducible rather than inherited.
//
// WHY THIS EXISTS. `TOKEN_CAP.tokens = 3` is load-bearing: `actionability()`
// returns `no` on it, and that `no` is what stops the BIS ranker sending a
// player at content they cannot get a token for. It was carried in a source
// comment citing three character-weeks from a corpus that is not on this
// machine — so for a while the shipped constant could not be re-checked by the
// session that shipped it. That is the shape this project keeps finding.
//
// WHAT IT MEASURES, and the second half is the part that matters:
//
//   1. grants per weekly period  — an absence. Consistent with a cap of 3 and
//                                  with any higher cap never reached.
//   2. REFUSALS carrying a positive control, and where they fall relative to
//      the third grant — a DENIAL. A cap above three would have to produce a
//      fourth grant somewhere among them.
//
// A refusal with a positive control is the Voidling closing line: proof the
// hail was heard and answered, not merely unanswered. Without it an absent
// grant is indistinguishable from an unheard hail.
//
//   node analysis/token-cap-check.js [logDir] [characterPrefix]
//
// Prints counts and timestamps only. No log content, no player names beyond
// the character whose log is being read. Raw logs never commit.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const core = require('../src/lockoutCore.js');

const DIR = process.argv[2] || process.env.EQ_LOG_DIR || 'C:/Users/Lindsey/Desktop';
const WHO = process.argv[3] || '';

// The Tuesday on or before a civil instant. RESET_RULE.weekday is 2 = Tuesday,
// and the HOUR is unmeasured — so this is a day boundary, and a grant landing
// on a Tuesday is attributed to the period beginning that day. Stated because
// it is an assumption the caller can disagree with.
function periodOf(civil) {
  const dow = new Date(civil).getUTCDay();
  const back = (dow - core.RESET_RULE.weekday + 7) % 7;
  return new Date(civil - back * 86400000).toISOString().slice(0, 10);
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`No such directory: ${DIR}`);
    process.exit(2);
  }
  const re = new RegExp(`^eqlog_${WHO || '[^_]+'}_.*\\.txt$`, 'i');
  const files = fs.readdirSync(DIR).filter((f) => re.test(f));
  if (!files.length) {
    console.error(`No eqlog_${WHO || '*'}_*.txt in ${DIR}`);
    process.exit(2);
  }

  // One state per character — a task is granted to a character, not an account.
  const byChar = new Map();
  for (const f of files) {
    const who = core.characterFromLogFilename(f);
    if (!byChar.has(who)) byChar.set(who, core.createState(who));
    const st = byChar.get(who);
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(DIR, f), { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of rl) core.applyLine(st, line);
  }

  let verdictHolds = true;

  for (const [who, st] of byChar) {
    const rows = core.classifyRequests(st);
    const granted = rows.filter((r) => r.result === 'granted');
    const refused = rows.filter((r) => r.result === 'refused');
    const unknown = rows.filter((r) => r.result === 'unknown');

    console.log(`\n=== ${who} ===`);
    console.log(`  hails classified : ${rows.length}  ` +
                `(granted ${granted.length}, refused ${refused.length}, unknown ${unknown.length})`);

    const periods = new Map();
    for (const g of granted) {
      const p = periodOf(g.civil);
      if (!periods.has(p)) periods.set(p, []);
      periods.get(p).push(g);
    }

    if (!periods.size) {
      console.log('  no grants observed — this character says nothing about the cap.');
      continue;
    }

    for (const [p, list] of [...periods].sort()) {
      const over = list.length > core.TOKEN_CAP.tokens;
      if (over) verdictHolds = false;
      console.log(`  period beginning Tue ${p} : ${list.length} grant(s)` +
                  (over ? '   <-- EXCEEDS THE CAP' : ''));
      for (const g of list) console.log(`      ${g.at}  ${g.boss || ''}`);

      // The denial half: refusals in this period, and whether they follow the
      // last grant. A refusal BEFORE the cap was reached would be evidence the
      // ceiling is not the token count.
      const inP = refused.filter((r) => periodOf(r.civil) === p);
      const controlled = inP.filter((r) => r.positiveControl === true);
      const lastGrant = list[list.length - 1].civil;
      const before = controlled.filter((r) => r.civil < lastGrant);
      console.log(`      refusals with a positive control: ${controlled.length}` +
                  ` of ${inP.length}` +
                  (before.length
                    ? `   <-- ${before.length} BEFORE the last grant, which the cap model does not explain`
                    : ''));
      if (before.length) verdictHolds = false;
    }
  }

  console.log('\n=== VERDICT ===');
  console.log(`  TOKEN_CAP.tokens = ${core.TOKEN_CAP.tokens}`);
  console.log(verdictHolds
    ? '  CONSISTENT: no period exceeded the cap, and no controlled refusal\n' +
      '  preceded the last grant of its period.'
    : '  INCONSISTENT — see the marked lines above. The constant needs revisiting.');
  console.log('\n  WHAT THIS CANNOT SHOW: that the ceiling is a property of the');
  console.log('  token rather than of something correlated with it here. The');
  console.log('  surface is whatever logs were passed in — print it above and');
  console.log('  do not quote the verdict without it.');

  process.exitCode = verdictHolds ? 0 : 1;
}

main();
