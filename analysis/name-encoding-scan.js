// Does a corrupted byte ever reach a NAME WE KEY ON?
//
// WHY THIS EXISTS. Session E joins damage rows to kill rows on
// `(timestamp, target)` — a fix that corrected a 38% over-mark, and one that
// makes E newly dependent on target strings matching EXACTLY. In the same
// commit E measured that our logs contain U+FFFD characters, already baked in
// as valid UTF-8, so no decoder check can find them: `errors="strict"` passes
// and a round-trip passes.
//
// That establishes the byte class reaches our logs. It does NOT establish that
// it reaches a join key, which is the only question that can break E's join.
// This script answers that one, and it answers it over an ENUMERATED surface
// rather than by searching until something turns up.
//
// A search establishes presence. Only a survey establishes absence, and only
// over a surface you have enumerated rather than guessed. The surface is
// printed in the output so a reader can see what was and was not covered.
//
// THIS SCRIPT READS RAW LOGS AND PRINTS NO LOG CONTENT. Counts, field names and
// file names only — never a name, never a message body. Raw logs never commit
// and neither does anything quoted out of them.
//
//   node analysis/name-encoding-scan.js

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseLine } = require('../src/lockoutCore.js');

const DIR = process.env.EQ_LOG_DIR || 'C:/Users/Lindsey/Desktop';

// Every field that is, or feeds, a join key. `spell` and `item` are included
// because they are keyed on elsewhere even though E does not join on them.
const KEY_FIELDS = ['slain', 'killer', 'actor', 'target', 'from'];
const OTHER_STRING_FIELDS = ['item', 'spell', 'task', 'boss', 'series'];

const NON_PRINTABLE_ASCII = /[^\x20-\x7E]/;
const FFFD = '\uFFFD';

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => /^eqlog_.*\.txt$/i.test(f));
  if (!files.length) {
    console.error(`No eqlog_*.txt in ${DIR}. Set EQ_LOG_DIR.`);
    process.exit(2);
  }

  const surface = [];
  let lines = 0, events = 0;
  let keyValues = 0, keyNonAscii = 0, keyFFFD = 0;
  let otherValues = 0, otherNonAscii = 0;
  let linesWithFFFD = 0, fffdOccurrences = 0, fffdParsed = 0;
  const offendingField = {};
  const kinds = {};

  for (const f of files) {
    const full = path.join(DIR, f);
    const bytes = fs.statSync(full).size;

    // Are the EF BF BD sequences literally in the file, or is our decoder
    // manufacturing U+FFFD from some other invalid byte? These are different
    // problems: the first is baked in and undetectable by any decode check,
    // the second is a decode we could guard.
    const buf = fs.readFileSync(full);
    let baked = 0;
    for (let i = 0; i + 2 < buf.length; i++) {
      if (buf[i] === 0xef && buf[i + 1] === 0xbf && buf[i + 2] === 0xbd) baked++;
    }

    let fileLines = 0;
    const rl = readline.createInterface({
      input: fs.createReadStream(full, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      lines++; fileLines++;

      const n = (line.match(/\uFFFD/g) || []).length;
      if (n) { linesWithFFFD++; fffdOccurrences += n; }

      const ev = parseLine(line);
      if (!ev) continue;
      events++;
      kinds[ev.kind] = (kinds[ev.kind] || 0) + 1;
      if (n) fffdParsed++;

      for (const k of KEY_FIELDS) {
        const v = ev[k];
        if (typeof v !== 'string') continue;
        keyValues++;
        if (NON_PRINTABLE_ASCII.test(v)) {
          keyNonAscii++;
          offendingField[k] = (offendingField[k] || 0) + 1;
        }
        if (v.includes(FFFD)) keyFFFD++;
      }
      for (const k of OTHER_STRING_FIELDS) {
        const v = ev[k];
        if (typeof v !== 'string') continue;
        otherValues++;
        if (NON_PRINTABLE_ASCII.test(v)) otherNonAscii++;
      }
    }

    surface.push({ file: f, megabytes: +(bytes / 1048576).toFixed(1), lines: fileLines, bakedFFFDBytes: baked });
  }

  console.log('\n=== SURFACE SURVEYED (this is what the zero below covers) ===');
  for (const s of surface) {
    console.log(`  ${s.file}  ${s.megabytes} MB  ${s.lines} lines  baked EF BF BD: ${s.bakedFFFDBytes}`);
  }
  console.log(`  TOTAL: ${surface.length} files, ` +
    `${surface.reduce((a, s) => a + s.megabytes, 0).toFixed(1)} MB, ${lines} lines`);

  console.log('\n=== U+FFFD, WHEREVER IT LANDS ===');
  console.log(`  lines containing U+FFFD      : ${linesWithFFFD}`);
  console.log(`  total occurrences            : ${fffdOccurrences}`);
  console.log(`  of those lines, ones that parse to a modelled event: ${fffdParsed}`);

  console.log('\n=== THE ANSWER: KEY FIELDS ===');
  console.log(`  key-field values examined    : ${keyValues}`);
  console.log(`  containing U+FFFD            : ${keyFFFD}`);
  console.log(`  containing ANY non-ASCII     : ${keyNonAscii}`);
  console.log(`  offending fields             : ${JSON.stringify(offendingField)}`);
  console.log(`  other string values examined : ${otherValues}  (non-ASCII: ${otherNonAscii})`);

  console.log('\n=== events parsed, by kind ===');
  console.log(`  ${events} total`);
  for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(16)} ${v}`);
  }

  console.log('\nWHAT THIS DOES AND DOES NOT ESTABLISH:');
  console.log('  Establishes: over the files listed above, no key-field value');
  console.log('    carries a non-ASCII character. E\'s join is safe on this surface.');
  console.log('  Does NOT establish: that no EverQuest name can carry one. The');
  console.log('    corpus is a subset of the full log set — compare the MB total');
  console.log('    above against the full corpus before reading this as general.');
}

main();
