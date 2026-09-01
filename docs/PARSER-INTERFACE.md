# The parser interface

**For Session E.** The standing ruling is that E does not build a second
ingestion layer. This is the only one, and this document is what E builds
against.

`src/lockoutCore.js`, 2528 lines, **zero `require()` calls**. No `fs`, no
`Buffer`, no `process` — the single `process.` in the file is inside a comment
at line 1790. It does no IO of any kind. **Every line below is derived from the
source and cited; nothing here is written from memory.**

---

## 1. What `lines` E receives: RAW

`parseLine(line)` takes **one raw log line as a string**. Nothing is normalised
before it, because there is nothing between the file and this function — the
module cannot read a file.

The host splits the file into lines. That is the entire contract.

What `splitStamp` (line 217) does to each string, in order:

| step | line | behaviour |
|---|---|---|
| type guard | 218 | non-string → `null` |
| cheap discriminator | 226 | `line.charCodeAt(0) !== 91` (`[`) → `null`. Doubles as the empty-line guard: `charCodeAt` on `""` is `NaN`, which fails the comparison |
| trailing CR strip | 239 | if last char code is 13, strip **one** CR |
| timestamp | 240 | `TS_RE`; no match → `null`; unknown month → `null` |

**The CR strip is defensive and I want E to know why it exists rather than
trust it.** The logs are CRLF — measured, every line of all 15 files. A host
that splits on `\n` alone hands us lines ending in CR. Without the strip the
failure is *silent and total*: `TS_RE` still matches because `.` matches CR, the
CR rides along inside `message`, and every anchored shape regex fails on its
`$`. The line is dropped, `dropped.unstamped` is **not** incremented (the stamp
parsed fine), and the module reports "no lockouts, ever" with a clean
diagnostic.

It has never bitten us only because `readline({crlfDelay: Infinity})` and
`split(/\r\n|\n/)` both strip CR first. **That is luck, not design.** If E
splits lines any other way, the strip is what saves you, and it strips exactly
one CR.

### The timestamp

`splitStamp` returns `{ at, message }` where `at` is a plain civil-time record:

```
{ weekday, year, month, day, hour, minute, second }
```

`at.weekday` is **the client's three-letter string, exactly as written, never
recomputed**. `civilWeekday(at)` (line 268) computes the weekday from the date
instead. Both are available; a mismatch is surfaced, never silently resolved.

`civilOf(at)` (line 261) returns `Date.UTC(...)` — **a monotone integer over
civil time, for differencing ONLY. It is deliberately not an instant.** The log
carries no zone and this module will not invent one.

### On the clock, precisely, because E will grep for this

`Date.now()` and bare `new Date()` are **never called**. They appear at lines 6
and 67 only, both inside comments asserting this.

`new Date(x)` *is* called three times — lines 269, 1908, 2463 — and every one
takes an already-computed civil integer. `Date.UTC` is a pure function of its
arguments and reads no clock. **Grepping `new Date` returns four hits; three are
arithmetic and one is a comment. None reads the system clock.**

---

## 2. What is already filtered on the way in

### `parseLine` filters nothing by roster

Comment at line 1116: *parseLine stays OPEN TO ANY NAME. Whether a slain thing
is a raid boss is a roster question, decided later; nothing here filters by
roster.*

If E wants every slain entity in the log, `parseLine` gives it to you. The
lockout tracker's roster is applied downstream and is not E's problem.

### `applyLine` drops three kinds before anything else

Lines 1348–1350:

```js
if (ev.kind === 'damage' || ev.kind === 'self-damage' || ev.kind === 'song-pulse') {
  return state;
}
```

**This is a drop from the lockout state, not from `parseLine`.** `parseLine`
still returns those rows in full. The split is the whole design: `parseLine`
returns the row for E, `applyLine` does not want it, and that is why adding
damage rows cost the lockout tracker nothing.

### The three drop counters, and they are the complete set

`dropped.unstamped` · `dropped.duplicate` · `dropped.beyondDedupeHorizon`

---

## 3. KILLING BLOWS — the Director's question, answered from the code

**Nothing in this parser excludes killing blows, and nothing in it can.**

The comment above the damage regexes states the reason, and it predates the
question:

> **ON `on_kill`, WHICH E ASKED FOR AS A FIELD: IT CANNOT BE DECIDED HERE.**
> Whether a hit was the killing blow depends on a line that has not arrived
> yet. `applyLine` classifies nothing, and a windowed pass decides with the
> whole picture visible. Deciding it per-line is how I produced a false 0.474 h
> bracket in August.

So the two things are **separate log lines and separate events**:

| log line | regex | event |
|---|---|---|
| `Foo hits Bar for 812 points of damage.` | `DAMAGE_MELEE_RE` (578) | `kind: 'damage'` |
| `Bar has been slain by Foo!` | `SLAIN_BY_RE` (582) | `kind: 'kill'` |

The damage line that dealt the killing blow **is still emitted as an ordinary
damage row.** It is not marked, not suppressed, not deduplicated against the
kill line.

### What this means for E's 194

E is excluding 194 killing blows itself. **That is not duplicated work.** I
exclude none, so there is nothing to duplicate. The row carries the timestamp
and the target precisely so the caller can join against the kill lines at the
same stamp — the join E and I already agreed on after E refuted the modal-value
shortcut.

**Whether it is a disagreement is E's call and I am not going to pre-empt it.**
I am stating what my parser does; E can compare it against what E's exclusion
assumes. If E's 194 came from a per-line judgement rather than a windowed join,
that is worth knowing, and it is the failure I made in August. If it came from
the join, we agree and neither of us needs to change anything.

---

## 4. Order of matching is load-bearing

`DAMAGE_SELF_RE` is tested **before** `DAMAGE_MELEE_RE` (lines 1127, 1131).
`You hit yourself for N points of damage by X.` also matches the melee shape.
E measured that counting it inflated apparent output by **3.7%**, worst on
exactly the support builds a damage tool gets pointed at.

**The exclusion keys on the SHAPE, never on a spell allowlist.** E named
Cannibalize; in our corpus the same shape carries `Lifetap Strike` (9) and
`Lifebite` (2), and Cannibalize does not appear at all. An allowlist would have
missed both of ours.

---

## 5. Why the early return sits ABOVE the dedupe index

Not a memory decision. **A silent correctness failure wearing a memory
decision's clothes.**

The live log holds **375,896 damage lines** and **16,788 song pulses**.
`state.seen` is the dedupe index, bounded at `MAX_SEEN = 200000` (line 1265).
Let damage through and one character's combat evicts the entire lockout dedupe
set — after which **replaying a log double-counts real kills**, because the keys
that would have suppressed them have been pushed out by damage nobody models.

The tell would be `dropped.beyondDedupeHorizon` firing on ordinary input, which
this module treats as its worst possible state: **silent double-counting with a
clean report.**

Caught the moment the rows were added, by an adapter test noticing a change
event per damage line — not by anyone reasoning about it.

**If E ever moves, deletes, or "optimises" this guard, the failure is silent.**

---

## 6. Published bounds

| constant | value | line | what overflowing costs |
|---|---|---|---|
| `MAX_EVENTS` | 5000 | 1255 | dedupe horizon in observations |
| `MAX_VOIDLING_REPLIES` | 5000 | 1261 | oldest seconds dropped first; a refusal older than the surviving window degrades to `unknown`, **never to a false `refused`** |
| `MAX_SEEN` | 200000 | 1265 | beyond it, `dropped.beyondDedupeHorizon` fires |

`MAX_EVENTS` and `MAX_VOIDLING_REPLIES` are exported in `THRESHOLDS` so a host
can read its own ceiling rather than take it on trust.

---

## 7. THE ENCODING PATH — this contradicts the order, and mine is the measurement

The order says *"the encoding path, strict UTF-8 with the windows-1252
fallback."*

**There is no windows-1252 fallback. There is no fallback of any kind, and
there is no encoding path in this module at all.**

Measured across the whole repository: no occurrence of `1252`, `latin1`,
`iso-8859`, or `TextDecoder` in any `.js` file. The only `latin` hits are
font-subsetting ranges in `analysis/fetch-fonts.js`, which is unrelated.

`lockoutCore.js` **takes strings and does no IO**, so it never sees bytes and
cannot decode anything. Every reader in `analysis/` opens with
`{ encoding: 'utf8' }` and nothing catches a decode failure:

```
analysis/derive.js:63 · grid-replay.js:44 · group-entries.js:71
hails.js:95 · make-fixture.js:92 · roster-evidence.js:48
```

**What this means for E:** the decode is E's host's responsibility and it is
currently unguarded everywhere. **Measured, not assumed** — feeding Node the
cp1252 bytes `0x93 0x94` inside a stamped line:

```
Buffer.from([0x5b,0x54,0x75,0x65,0x20,0x93,0x94,0x5d]).toString('utf8')
  threw:  null
  result: "[Tue ��]"
```

It does not throw. It substitutes U+FFFD, one per bad byte. A windows-1252 byte
in a player name therefore becomes a replacement character *inside a name we key
on*, silently, with no counter firing — and because the line still starts with
`[` and the stamp still parses, `dropped.unstamped` stays at zero. **It is the
CR failure mode again: a corrupted key with a clean diagnostic.**

I have not measured whether our logs contain any such byte, so I am not claiming
this is a live defect. **I am saying the fallback the order describes does not
exist, and the failure mode if it is ever needed is silent.** Per the Director's
standing instruction that a measurement wins over a ruling, this is recorded
here and in the commit message rather than quietly implemented to match.

---

## 8. Minimal use

```js
const { parseLine, createState, applyLine, applyLines, project, THRESHOLDS }
  = require('./src/lockoutCore.js');

// E's path — rows out, no state:
for (const line of lines) {
  const ev = parseLine(line);
  if (ev && (ev.kind === 'damage' || ev.kind === 'self-damage')) accumulate(ev);
}

// The lockout path — state in, state out, idempotent under replay:
const state = applyLines(createState('CharacterName'), lines);
```

`applyLines` (1588) is a plain loop over `applyLine`. There is no batching, no
streaming interface, and no async anywhere in the module.

---

## 9. The full event catalogue from `parseLine`

Every `kind` the parser can return, with the field set. `parseLine` returns
`null` for anything unmatched — an unstamped line, a stamped line whose shape is
not modelled, or a non-string.

| `kind` | fields beyond `at` | line |
|---|---|---|
| `task-assigned` | `task`, `series`, `boss`, `cadence` | 1092 |
| `task-updated` | same | 1095 |
| `given` | `item` | 1098 |
| `entered` | instance fields from `parseInstanceName` | 1105 |
| `not-a-zone` | `text`, sometimes `unrecognised` | 1103–1104 |
| `instance-invite` | `from`, plus instance fields | 1108 |
| `weekly-request` | — | 1111 |
| `voidling-reply` | `closing` | 1114 |
| `self-damage` | `actor`, `target`, `amount`, `damageType`, `spell`, `outgoing:false` | 1127 |
| `damage` (melee) | `actor`, `target`, `amount`, `damageType`, `spell:null`, `byYou`, `outgoing:true`, `form:'melee'` | 1130 |
| `damage` (spell) | `actor`, `target`, `amount`, `damageType:'spell'`, `spell`, `byYou`, `outgoing:true`, `form:'spell'` | 1136 |
| `song-pulse` | `song`, `source` | 1145 |
| `kill` | `slain`, `killer`, `byYou:false` | 1148 |
| `kill` (yours) | `slain`, `killer:null`, `byYou:true` | 1151 |

Note the two `kill` shapes differ only in `byYou` and whether `killer` is
populated. `You have slain X!` names no killer, so `killer` is `null` rather
than `"You"` — the field says what the log said, not what we inferred.
