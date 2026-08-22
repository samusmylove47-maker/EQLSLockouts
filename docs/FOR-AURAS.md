# Integration notes

**Nothing here is a request.** These are notes for whoever wires this module into
a host app, written after reading how Auras is already built. Take what is
useful, ignore the rest, and if the module does not suit, the measurements in
`docs/EVIDENCE.md` and `docs/CAPTURE-PROTOCOL.md` stand on their own and are
yours regardless.

---

## The one-time full-log scan

You said the parser is last-line-only and that a user-triggered full scan was a
planned addition. **That is exactly right, and this module is built for it** —
but three specifics are worth having before you write it, because two of them
would silently produce a wrong answer rather than a missing one.

### 1. Scan the FOLDER, not the newest file

**Measured, and this is the one that would quietly break it.** The two halves of
the only reset measurement we have live in **different files**:

| file | weekly grants |
|---|---|
| `eqlog_Avenrae_rivervale.txt` | 3 — all on Mon 10 Aug |
| `eqlog_Avenrae_rivervale_2026-08-15.txt` | 3 — all on Tue 11 Aug |

The reset boundary is bracketed by a task granted on the 10th and granted **again**
on the 11th. Scan only the current file and you find three grants of three
*different* tasks, no repeat, and the module correctly reports `not recorded` —
having been shown exactly half the evidence. A log that rolls over, or a
splitter writing per-day files, splits the signal by construction.

### 2. One engine per character

A task is granted per character. Your watcher deliberately follows whichever
`eqlog_*.txt` changed most recently, which is right for buffs and wrong here — a
folder scan will pick up every character on the machine.

When I first ran this over the corpus with one shared state, Avenrae's and
Shara's grants — four seconds apart, because they were grouped — read as *one
task granted twice*, and the module reported a **four-second reset bracket**.

`createState(character)` now requires the name and refuses to be shared;
`characterFromLogFilename('eqlog_Avenrae_rivervale.txt')` → `'Avenrae'` does the
routing parse. `restore()` rejects a snapshot whose character does not match.

### 3. It is fast, but stream it

Measured on this machine: **434 MB / 5,253,948 lines across 15 files in 7.0
seconds** — roughly 62 MB/s, 750k lines/s, including JSON output. A single
character's Logs folder is far smaller than that, so the button is a few seconds,
not a progress-bar-and-cancel affair.

Use a streamed read (`readline` over `createReadStream`) rather than
`readFileSync` — one of these files is 112 MB, and reading that synchronously in
the main process spikes memory and blocks. Streaming yields between chunks and
the renderer stays responsive.

Afterwards, `serialize()` gives you a JSON-clonable snapshot to persist. There is
no need to scan twice; the live tailer takes over from the end of the file.

---

## The six constraints — answered, and one of them found a bug

Session C read the app's live tree and listed six things a retrofit module has to
satisfy. They are now **THE CONTRACT** at the top of `src/lockoutCore.js`, with
one test per clause. Answering them here too, briefly:

1. **Raw line, prefix and all.** `handleLine(line)` takes exactly what the
   watcher emits, `[Wed Aug 19 19:17:52 2026] <text>`. Same signature as
   `BuffEngine.handleLine`. **Do not strip the timestamp first** — here it is the
   measurement, not noise.
2. **The clock is never read; `now` is the only time source.** Stronger than
   asked: `now` does not touch accumulated state at all. `applyLine` never sees
   it. So replaying 1.5M lines produces byte-identical state to receiving them
   live, and a test asserts it.
3. **One-second resolution, no ordering within a second.** Nothing depends on the
   order of two events sharing a stamp. `applyLine` classifies nothing; it
   records, and `classifyRequests` decides later with the whole window visible.
   A test shuffles all six orderings of a same-second exchange and requires the
   same answer. **This is the constraint that bit us both** — a mez break and its
   wear-off for you, the Voidling's closing line arriving before the task line
   for me.
4. **State is JSON and only JSON.** A structural walk in the test set fails on
   any Map, Set, Date, function, `undefined` or non-finite number reaching state.
5. **No file owned, no default owned.** The core references no `fs`, no
   `require`, no `process.env`. Defaults, backfill and migration stay yours.
6. **Feeding the same line twice is safe — yes, idempotent.**

**Constraint 6 caught a real bug, and it is worth knowing about because it was
aimed straight at your watcher.** Voidling replies were exempt from dedupe, and I
had documented that exemption as deliberate and harmless. It was not: replaying a
stream doubled the array. Against a watcher that can re-read a tail, and a
one-time backfill that will overlap the live stream, that would have drifted
silently. They are now a set of seconds — idempotent by construction, and
presence was all they were ever for.

Replaying the whole 434 MB corpus now changes exactly one key: `dropped.duplicate`,
the counter recording how many repeats were rejected.

## Two measurements that affect your tailer directly

**The logs are CRLF, not LF.** Every line of all 15 files ends `0D 0A`. An
earlier version of these notes said LF, and it was wrong — the hexdump that
"established" it was piped through `grep`, which strips the file's terminator and
appends its own. It measured the instrument, not the file.

Your `split(/
|
/)` already handles it correctly, so nothing on your side
changes. It matters for two other reasons: a host that splits on `'
'` alone
would hand this module lines with a trailing CR, which used to parse to **null
silently** (the timestamp matched, so the diagnostics stayed clean); and it means
every line boundary in the file is two bytes, which is worth knowing when reading
at byte offsets.

**And a precision on the positive control**, because the obvious reading is too
strong. The Voidling's closing line proves **the channel is showing NPC
dialogue** — it does not prove the Voidling answered *you*. It replies to every
player who hails it, zone-wide: 123 of 195 closing lines in our corpus have no
first-person `danger` in the preceding five seconds. That is still the control we
need, since the risk being guarded against is a chat filter hiding system text.
It is not evidence that a particular exchange completed.

## Shape

```js
const { LockoutEngine } = require('./lockoutCore/lockoutEngine');

const eng = new LockoutEngine('Avenrae');
eng.on('change', (view) => render(view));

eng.handleLines(historyLines);   // the one-time scan
eng.handleLine(line);            // from the tailer, raw, timestamp included
```

- `src/lockoutCore.js` is the deliverable and has **zero `require`s** — not even
  builtins. No Electron, no DOM, no filesystem, no timers, and `Date.now()` is
  never called inside.
- `src/lockoutEngine.js` is optional. It requires only `events` and the core, and
  exists solely so this drops into an app whose engines are EventEmitters with
  injected dependencies. Delete it and call the core directly if you prefer.
- `handleLine(line)` takes the **raw** line with its timestamp, matching
  `BuffEngine.handleLine` / `CustomTimerEngine.handleLine` — both of which call
  `stripTimestamp` internally. **Do not strip the timestamp before this module
  sees it:** the timestamp is the measurement.

---

## Two things it deliberately will not do

**It will not tell you when the lockout resets.** No reset day or hour is
hardcoded anywhere, and a test fails if one is ever added. What it reports is the
*bracket* the observations support — currently 26.06 hours wide — and
`not recorded` for anything narrower. Every other tool that ships this feature
types a constant; one of them marks its own constant `VERIFY IN GAME`.

For the same reason `boss.available` is permanently `{ provenance: 'not
recorded' }`. Answering "available in 3d 4h" needs the reset rule, and the reset
rule is not known yet. A capture protocol to measure it is in
`docs/CAPTURE-PROTOCOL.md`; it costs about ten minutes on a Tuesday.

**It will not accept a `Date` or an epoch as `now`.** It throws, with an
explanation. Log stamps carry no timezone — they are the client's local wall
clock — so the module works entirely in civil time and refuses to manufacture an
instant. `civilFromDate(new Date())` in the adapter is the only place a real
clock is read, and it reads local components deliberately, because those are the
same wall clock the game writes.

---

## One thing in your tailer, offered as a gift

`logWatcher._pollActiveFile` opens a fresh `createReadStream` at a byte offset
with `encoding: 'utf8'` every 200 ms. If a multi-byte character ever straddles a
poll boundary, it decodes to U+FFFD and that line is corrupted.

**It is not biting you today** — the corpus is effectively ASCII. But it already
contains **9 bytes of U+FFFD**, which is the residue of a decode that lost
something somewhere. Reading the tail as a `Buffer` and decoding after joining
with the held partial line closes it permanently.

Related, and it confirms your choice: **the logs are UTF-8, measured.** Exactly 9
bytes ≥ 0x80 in 434 MB, all of them `EF BF BD` (valid UTF-8); every cp1252
signature byte returns zero lines. `encoding: 'utf8'` is correct. We had a
standing internal ruling that these logs were Windows-1252 and that ruling was
wrong.
