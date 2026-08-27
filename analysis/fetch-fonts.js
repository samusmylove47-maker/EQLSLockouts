'use strict';

// Fetches the four site typefaces, subsets them, and writes assets/fonts/fonts.json
// for build-app.js to inline as data: URIs.
//
//   node analysis/fetch-fonts.js
//
// THIS RUNS AT BUILD TIME AND ONLY AT BUILD TIME. The shipped page makes zero
// network requests — test/build.test.js fails the build if the HTML so much as
// contains the string "fonts.googleapis.com". The reason is not fussiness:
// eqlsource.com itself loads these four faces from Google, and we have PUBLISHED
// criticism of another app for exactly that ("It fetches its typeface from
// Google each time it launches, which discloses your IP address to Google").
// Taking the shortcut we told its author not to take is not available to us.
//
// WHY TWO DIFFERENT SUBSETTING STRATEGIES, AND IT IS THE WHOLE DIFFICULTY.
//
//   Cinzel   sets ONE literal string — the masthead. Google's &text= parameter
//            returns a font containing only those glyphs, and it is tiny.
//
//   The other three render USER DATA: the character name parsed out of the
//            player's own log filename, plus boss and zone names. A player we
//            have never seen must not get a blank box, so a &text= subset built
//            from strings WE happen to know is exactly the wrong tool. They get
//            the full `latin` block, which carries ASCII, Latin-1 (accented
//            letters), General Punctuation and the typographic characters our
//            own sentences use.
//
// ONE CHARACTER FALLS OUTSIDE `latin` AND STILL REACHES THE SCREEN: U+2192 →,
// in RESET_RULE.measuredBracketPacific, which the provenance panel prints. It
// gets a supplementary one-glyph face at the same family and weight, scoped by
// unicode-range, so the browser reaches for it only for that codepoint. Missing
// it would fall back mid-sentence to a different typeface, which is the ugly
// bug this whole comment exists to prevent. (U+2500 ─ also occurs but only in
// JavaScript comments, which do not render — checked, not assumed.)

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, '..', 'assets', 'fonts');
// Chrome's UA, because Google serves TrueType to anything it does not recognise
// and woff2 is roughly half the bytes.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TITLE_TEXT = 'EQLS Lockouts';

// ── THE CSS FAMILY NAMES ARE NOT ALWAYS THE REAL ONES, AND THAT IS A LICENCE
//    REQUIREMENT RATHER THAN A PREFERENCE. ────────────────────────────────────
//
// All four faces are SIL OFL 1.1. Two of them declare a RESERVED FONT NAME, and
// that is verifiable in one line of each licence:
//
//   ibmplexmono     Copyright (c) 2017 IBM Corp. with Reserved Font Name "Plex"
//   sairacondensed  Copyright 2016 The Saira Project Authors ... with reserved
//                   font name "Saira".
//   cinzel          (no reserved name)
//   publicsans      (no reserved name)
//
// OFL 1.1 defines a Modified Version as "any derivative made by adding to,
// DELETING, or substituting -- in part or in whole -- any of the components of
// the Original Version". Subsetting deletes components, so a subset IS a
// Modified Version. Clause 3 then says no Modified Version may use the Reserved
// Font Name(s) without written permission.
//
// So the two RFN families are renamed at the point of use. Google serves
// subsets under the original names, but Google is not us and its arrangements
// are not ours. The rename is invisible to a reader and costs nothing.
//
// KNOWN AND STATED, NOT SMOOTHED OVER: this renames the family in CSS only. The
// woff2 files still carry "IBM Plex Mono" and "Saira Condensed" in their
// internal name tables, because fontTools is not installed here and hand-patching
// a name table without a validator is a worse risk than the one it fixes. A
// strict reading of clause 3 may want the internal name changed too. That gap is
// real and is recorded in assets/fonts/LICENSES.md rather than hidden.
const CSS_FAMILY = {
  'IBM Plex Mono': 'EQLS Mono',
  'Saira Condensed': 'EQLS Condensed',
  'Cinzel': 'Cinzel',
  'Public Sans': 'Public Sans',
};

// family, weight, and how to subset. `latin` means the whole latin block.
const WANTED = [
  { family: 'Cinzel',           weight: 600, mode: 'text', text: TITLE_TEXT, role: 'masthead only' },
  { family: 'Saira Condensed',  weight: 600, mode: 'latin', role: 'labels, eyebrows, column heads' },
  { family: 'IBM Plex Mono',    weight: 400, mode: 'latin', role: 'figures, dates, cells' },
  { family: 'IBM Plex Mono',    weight: 600, mode: 'latin', role: 'emphasised figures' },
  { family: 'IBM Plex Mono',    weight: 400, mode: 'text', text: '→', role: 'the arrow in the measured bracket', supplementary: 'U+2192' },
  { family: 'Public Sans',      weight: 400, mode: 'latin', role: 'prose' },
  { family: 'Public Sans',      weight: 600, mode: 'latin', role: 'prose emphasis' },
];

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location, binary));
      }
      if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} for ${url}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function cssUrl(spec) {
  const fam = spec.family.replace(/ /g, '+');
  let u = `https://fonts.googleapis.com/css2?family=${fam}:wght@${spec.weight}`;
  if (spec.mode === 'text') u += `&text=${encodeURIComponent(spec.text)}`;
  return u + '&display=swap';
}

// Pick the @font-face block we want out of Google's reply. For a &text= request
// there is exactly one. For the default reply there are several, one per script,
// and we want `latin` — identified by its range starting at U+0000-00FF rather
// than by its position, because position is not a guarantee.
function pickFace(css, mode) {
  const faces = css.split('@font-face').slice(1).map((b) => '@font-face' + b.slice(0, b.indexOf('}') + 1));
  if (mode === 'text') return faces[0];
  const latin = faces.find((f) => /unicode-range:\s*U\+0000-00FF/i.test(f));
  if (!latin) throw new Error('no latin block in the reply — Google changed its output');
  return latin;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const out = [];
  let total = 0;

  for (const spec of WANTED) {
    const css = await get(cssUrl(spec), false);
    const face = pickFace(css, spec.mode);
    const src = /src:\s*url\(([^)]+)\)/.exec(face);
    const range = /unicode-range:\s*([^;]+);/.exec(face);
    if (!src) throw new Error(`no src for ${spec.family} ${spec.weight}`);
    if (!/format\('woff2'\)/.test(face)) throw new Error(`not woff2 for ${spec.family} — check the User-Agent`);

    const buf = await get(src[1], true);
    // A woff2 file begins with the ASCII signature "wOF2". Anything else is an
    // error page, a redirect body, or a truncated read — all of which would
    // otherwise inline cleanly and render as a silent fallback.
    const sig = buf.subarray(0, 4).toString('ascii');
    if (sig !== 'wOF2') throw new Error(`${spec.family} ${spec.weight}: signature ${JSON.stringify(sig)}, not wOF2`);

    const slug = `${spec.family.replace(/ /g, '-').toLowerCase()}-${spec.weight}` +
                 (spec.supplementary ? '-arrow' : '');
    fs.writeFileSync(path.join(OUT, `${slug}.woff2`), buf);

    const base64 = buf.toString('base64');
    out.push({
      family: CSS_FAMILY[spec.family], originalFamily: spec.family,
      reservedFontName: spec.family === 'IBM Plex Mono' ? 'Plex'
                      : spec.family === 'Saira Condensed' ? 'Saira' : null,
      weight: spec.weight, style: 'normal', role: spec.role,
      subset: spec.mode === 'text' ? `text="${spec.text}"` : 'latin',
      unicodeRange: spec.supplementary || (range ? range[1].trim() : null),
      bytes: buf.length, base64Chars: base64.length, file: `${slug}.woff2`,
      sourceUrl: src[1], base64,
    });
    total += base64.length;
    console.log(
      `  ${(spec.family + ' ' + spec.weight).padEnd(24)} ${String(buf.length).padStart(7)} B  ` +
      `-> ${String(base64.length).padStart(7)} B base64   ${spec.subset || spec.mode}` +
      (spec.supplementary ? `  [${spec.supplementary} only]` : '')
    );
  }

  fs.writeFileSync(path.join(OUT, 'fonts.json'), JSON.stringify(out, null, 2));
  const rawTotal = out.reduce((n, f) => n + f.bytes, 0);
  console.log(`\n  ${out.length} faces`);
  console.log(`  raw woff2 total   ${rawTotal.toLocaleString()} B`);
  console.log(`  base64 total      ${total.toLocaleString()} B   (what the page actually carries)`);
  console.log(`  wrote ${path.join(OUT, 'fonts.json')}`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
