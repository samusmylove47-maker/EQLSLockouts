# EQLS Lockouts → EQLS Auras: the handover

**From Session D to Session C, 27 August 2026.** Target: Tuesday 1 September.

You build it in at Shara's direction. I supply what you need to build it without
misunderstanding it. I do not push to her repository and I do not contact her.

---

## Before anything else: one timestamp, and it is now on a deadline

**1 September is itself a reset day.** Anyone who raids that Tuesday will see
boundary-day cells — the tool will say "unsure" about the raids they just did,
because the reset **hour** has never been measured. That is honest, and on day
one it will read as vagueness.

**One measurement retires it permanently, for every user:**

> the wall-clock time an alt+Z screenshot was taken, plus the remaining time the
> window shows on any lock.

Those two numbers give the reset instant directly. Two readings that agree prove
both the instant *and* that the locks share one. It has been one sentence away
for nine days. If you can get it before Tuesday, every "unsure" cell in this
package becomes a "done" or an "open".

---

## The property that must survive integration, above everything else

**THE TOOL SAYS WHAT IT DOES NOT KNOW.**

That is the whole reason this is worth putting in front of players. Kill-inference
plus a typed-in constant already ships elsewhere; if this arrives in =Auras with
the uncertainty smoothed off, we have shipped a worse copy of something that
already exists — which is the one thing CLAUDE.md forbids outright.

Concretely, these are not stylistic preferences. Each is enforced by a test:

| what | why it exists |
|---|---|
| **Five cell states** — `completed`, `open`, `conditional`, `unknown`, `not_looked` | four of them are different kinds of *not done*, and collapsing them is what made an earlier build useless |
| **`not_looked` NEVER renders as `open`** | "I have not looked" and "you have not done it" are the same picture and different facts. A fresh install showing 25 open cells is a comfortable lie |
| **No countdown, anywhere** | we cannot honestly produce one — the reset hour is unmeasured. `open` is a state, never a time |
| **`LOCKOUT_MODEL.days` is labelled `conditional`** | six days is conditional on the replay period being one hour. See finding 3 |
| **Every figure carries a provenance label** | `observed` / `inferred` / `stated` / `conditional` / `not recorded` |
| **A reset constant may appear in exactly one attributed field** | a test fails if a weekday or hour leaks anywhere else in the output |

If a design decision in =Auras would blur one of these, that is worth a
conversation before it ships, not after.

---

## Four findings that inverted at least once while we built this

Each of these was believed backwards by someone competent — in three cases by
me. A careful reader reasoning from first principles will re-derive the wrong
answer, because the wrong answer is the reasonable one. **So this section ships
the evidence, not the conclusion.**

### 1. A bare `- Group` means tier 0

Two shapes of zone-in occur:

```
You have entered The Plane of Hate - Group 4 (Refined).
You have entered The Plane of Hate - Group.
```

The obvious reading of the second is "the game did not say". **It is the
opposite: the client omits the index exactly when the index is zero.**

This one has been inverted three separate times. My own canon asserted the wrong
version; Session A was ordered to follow the wrong version; and `raidstats.py`,
which had it *right*, was "corrected" to match the error.

**The evidence, over all 16 log files:**

| line shape | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| `has asked you to join the instance: …` | **12** | 16 | 13 | 19 | 18 |
| `You have entered <Zone> - Group N (L).` | **0** | 16 | 13 | 19 | 17 |
| `You have entered <Zone> - Group.` | **12** | – | – | – | – |

- Tiers 1–3 match invite-for-entry **exactly**.
- **No entry line anywhere states an index of 0.** That is the killer test; the
  day one appears, the rule is dead, and a test guards exactly that.
- Three pairs sit minutes apart in the same file, e.g. 26 Aug: invite at
  `17:52:12` naming `Group 0 (Normal)`, entry at `17:55:57` reading bare.
- An independent verifier matched every one of the **65** full `- Group N`
  entries to its nearest preceding same-zone invite: **65 of 65, same tier,
  perfect diagonal.** The method reconstructs the tier wherever it is
  independently visible, then says 0 for all 12 cases where it is not.

**THE LIMIT, and it matters as much as the rule.** This applies to `- Group`
only. There is a second entry family with no mode word —
`You have entered The Castle of Mistmoore 1 (Awakened).` — and at tier 0 that
family drops its **whole suffix**, collapsing onto the ordinary open-world
zone-in line (`You have entered The Feerrott.`, which occurs 40+ times). There
is nothing left to distinguish them. `- Group` is what marks a line as instanced
*independently of the index*, which is precisely why its missing index is
informative and the other family's is not.

**`- Solo` does NOT get the rule.** `grep -a -- " - Solo"` returns **0** on all
16 files — no entry line, no invite line, nothing. The owner's alt+Z window shows
a `Solo 3` lock, so the shape is real and our logs have simply never seen one.
Bare `- Solo` therefore keeps `difficulty: null`. That gap is open, not solved.

### 2. The lock is not stamped at the kill

The alt+Z window showed **14 locks. Every one showed the same remaining time.
Zero spread.** The kills those locks correspond to span **6,133 seconds** —
about 1h42m — of wall-clock time.

If a lock were stamped at its kill, 14 kills across 6,133 seconds would show
**14 distinct remaining times spanning 1h42m.** They did not. Per-kill stamping
is dead.

**THE CONSEQUENCE, and it is the one that cannot be caught later — this sentence
is also in `src/lockoutCore.js` beside the model, deliberately:**

> **If a future version infers lockout expiry from kill timestamps, no volume of
> kill data will ever reveal the error.**

Kill timestamps are real, plentiful, and precisely wrong for this. A test suite
built on them will pass. A month of user data will not contradict them. The only
thing that exposes the mistake is the alt+Z window, which is not in the log. So
`LOCKOUT_MODEL.anchorEvent` is `null` and must stay `null` until something
measures it.

### 3. `B − R = exactly 5d 23h` is the measurement. Six days is conditional.

What is **measured**, assumption-free, from the alt+Z window:

```
B − R = 514,800 s = exactly 5 d 23 h
```

where `B` is the lockout period and `R` the replay period. **The absolute period
is not determined.** One reading is two equations in three unknowns:

| if R is | then B is |
|---|---|
| 1 h | 6 d 0 h |
| 90 m | 6 d 0 h 30 m |
| 2 h | 6 d 1 h |
| 3 h | 6 d 2 h |

**My own retraction, shipped with it because it is the part that matters:** I
wrote that "no other pairing gives a whole number", and that was **false**. B is
determined by R, so *every* R yields some B; the whole-number test was not a test
at all. It was one free parameter fitted to itself. The Director published six
days as fact on the strength of it and had to withdraw it.

So `LOCKOUT_MODEL.days` is `6` with `daysProvenance: 'conditional'` and the
condition stated in the object. **Do not render it as a fact.** The floor that
*is* measured is `≥ 5.78 days` — a weekly still refused 5.78 d after a grant,
with the positive control present.

### 4. `/dzlisttimers` reports replay timers, not loot lockouts — closed

The full capture is committed at
`sources/raw/2026-08-26-dzlisttimers-capture.log`. The three lines that settle
it:

```
[Fri Aug 21 11:20:54 2026] Usage: /dzListTimers    - This command will list any
    outstanding replay timers you have for all expeditions.  This is the amount
    of time you must wait before being allowed to enter another instance of that zone.
[Wed Aug 26 23:30:17 2026] You have no outstanding timers.
[Wed Aug 26 23:30:24 2026] You say, 'timers check done'
```

The first is the **client's own documentation**. The second is the command's
output — so it *does* write to the log. The third is the **control line**, seven
seconds later.

**The control line is the technique, and it is what you should reuse.** A command
that prints nothing and a command whose output your capture is not listening to
look identical in a log file. `/say` goes to a channel we know is captured, so
the control line present + the command's output absent is a *real negative*
rather than a filtered channel. Any future "does X log?" question should be
captured this way.

Why the negative is decisive here: five hours earlier that same character killed
two Plane of Fear bosses, and the lockout period is at least 5.78 days, so both
locks were certainly still held. A command reporting loot lockouts could not have
reported none.

**Corollary, and it is the useful half:** the command *does* log. A host wanting
a replay-timer readout has a supported way to get one. It is just not the
lockout. And it is therefore **not** a source for a discoverable raid roster,
which is what we had hoped.

---

## The three objects, and the test that keeps them apart

These get conflated constantly, including by players. A guild member on 23 Aug:
*"its like the lockout timer, is different than the replay timer"* — they are
right, and they had to work it out live.

| object | what it governs | period | provenance |
|---|---|---|---|
| `RESET_RULE` | the **weekly task** and its token | Tuesday, hour **not recorded** | `stated` — owner, first-hand, 23 Aug. We did not measure it |
| `LOCKOUT_MODEL` | **instance loot** | rolling; `B − R = 5d23h` measured, `days: 6` conditional | `observed` for the difference, `conditional` for the absolute |
| `REPLAY_MODEL` | **re-entry to the same instance** | ~1 h, observed | explicitly `doesNotGovern: 'whether the loot in that instance is still available'` |

**You inherit the test, not just the values.** `test/grid.test.js` has
*"THREE OBJECTS: the weekly, the lockout and the replay timer stay separate"*.
If a refactor merges any two, it fails. Keep it.

The weekly is **first 3 raids per week, not per boss** (owner, 23 Aug). Measured:
Avenrae, week of 11 Aug — 18 roster kills, 3 grants, 3 tokens. **A refused hail
means "you have spent your three this week", NOT "this boss is locked."**

---

## The name mappings, and why an unmapped name is the defining failure

**An unmapped boss name renders as a MISSING lockout** — which is this tool's
defining failure arriving through a side door. The row looks empty, exactly as it
would if the raid were genuinely undone.

- `Innoruuk, the Prince of Hate` — **not** bare `Innoruuk`. A fixed-string search
  for `Innoruuk has been slain by` returns **73 hits, none of them the boss**.
  Near-misses total 156 against 11 real.
- `a dracoliche` and `the Hand of Veeshan` — **lower case, with the article.**
  They are real bosses whose names begin with an article; the "article means
  trash" heuristic is wrong.
- **The client capitalises the first character of a line.** `A dracoliche` (8
  kills) vs `a dracoliche` (3). The match folds case — which is safe *only*
  because it is exact equality, never substring.
- **The alt+Z window's names differ from the kill lines'.** The window writes
  `Dracoliche`; the game writes `a dracoliche`. The roster uses the **kill-line**
  spelling, and a test asserts every roster key matches a real kill in the corpus
  so a typo fails the build instead of showing an empty row forever.
- `You have slain <X>!` is a second kill shape. A `has been slain by` search
  alone misses 8 real boss kills.
- There is a **third** shape, `<Name> died.`, 47 lines — **deliberately not
  parsed**, because it also carries player and pet deaths (`Shara died.`,
  `Avenrae died.`). Reading it as a kill would score the owner's own death as a
  boss kill. It touches none of the ten roster bosses.

## The alt+Z truncation

Instance names in that window are cut at a fixed column width, so **`- Group`
rows lose their final characters while `- Solo` rows fit** — the mode word costs
enough width to push the tier off the end. It matters only if anyone ever parses
that surface, and it is exactly the kind of thing that looks like missing data
rather than a display limit. We do not parse it; if =Auras ever does, start here.

## The Voidling positive control

The design treats **silence as evidence** — a refused weekly is inferred from a
request with no grant. That is only legitimate because of one line:

> `Voidling says, 'Your hubris risks our very reality itself.'`

**The closing line fires on BOTH outcomes** — grant and refusal. So its presence
proves the exchange happened and was captured, which is what makes an absent
grant mean "refused" rather than "we missed it". Without that sentence in the
design, the module looks like it trusts an absence, and a reviewer would be right
to reject it.

Where the control is missing, the request degrades to `unknown`. It never
degrades to `refused`.

---

## Three false measurements I produced, kept as method

**A detector that has only been run on a fixture has not been run.** All three of
these passed their tests and were wrong against real data.

1. **Merged characters → a four-second reset bracket.** I pooled two characters'
   logs into one state. The resulting "measurement" was a fabrication with a
   plausible shape. Fix was structural: `createState(character)` now *requires*
   the name, and one log file belongs to one character.
2. **The closing line arriving BEFORE the task line.** I treated the Voidling's
   closing line as terminating the exchange, which produced a false 0.474 h
   bracket. Fix was structural again: `applyLine` classifies nothing;
   `classifyRequests` decides with the whole window visible.
3. **Over-tightening the fix.** Correcting (2), I required the refusal to name a
   boss. A refusal does not name a boss. That produced a 9-second bracket.

The pattern in all three: the bug produced a *number*, and a number looks like a
measurement. Replay against the real corpus before believing any of them.

## Three failures only a browser caught

Your integration target is an Electron renderer. **The Node suite does not lay
out a page**, and each of these shipped green:

1. **`String.replace` and `` $` ``.** The core contains a comment about a regex
   end anchor; a plain string replacement spliced the page into its own middle.
   Built cleanly at 99 KB, completely dead. Found by opening it.
2. **`createState` silently dropped two new fields.** The module held the
   measurement, the cell reported `[]`, the tooltip said nothing. 87 tests green.
3. **`shortDay()`'s temporal dead zone**, the freshest. A `const` + `function`
   pair declared halfway down `render()`, with a new call site above it:
   `Cannot access 'MON' before initialization`, **on every render**. The page
   loaded, the engine ran, the grid never appeared. Tests green.

---

## Integration facts

You have most of these already; they ship again with the code so they cannot
drift apart from it.

**The contract**

- **Raw line in, prefix and all.** Do not strip the `[Day Mon DD HH:MM:SS YYYY]`
  stamp — the module needs it.
- **Never reads the clock.** `Date.now()` is never called. `now` is passed in and
  is the only source of the present. (`Date.UTC` is used, being pure arithmetic.)
- **Civil time, not instants.** Log stamps carry no timezone. `civilOf()` returns
  a monotone integer for *differencing only*. Never treat it as an instant, and
  never construct a `Date` from a log stamp — that silently applies the reader's
  timezone.
- **One-second resolution, no sub-second ordering.** Two events in the same
  second have no defined order.
- **State is JSON-clonable.** No `Map`, no `Set`, no class instances. Clone it,
  persist it, post it across a worker boundary.
- **Plain config object; the module owns no file** and takes no options. The
  constants are published in `THRESHOLDS` so the numbers are not hidden.
- **Idempotent.** Feed the same lines twice and the state deep-equals. A test
  asserts it, and it caught a real bug when written.
- **Per character.** The character comes from the **filename**, not from any
  line. Merging two characters fabricates measurements — see false measurement 1.

**Performance and shape**

- **Stream it. Do not `readFileSync`.** One archive file is **112 MB**; on the
  main process that read blocks everything. Use `readline` with
  `crlfDelay: Infinity`.
- **Line endings are mixed.** 11 of 15 archives are CRLF, 4 are LF-only. The
  parser strips a trailing CR *conditionally*; do not "normalise" input.
- **Encoding is UTF-8.** 9 bytes ≥ 0x80 in 494,943,214 across 16 files, all
  `EF BF BD`, all in player chat, none in any rendered field.
- **`logSplitter.js` writes per-day files by design** — so **scan the folder**,
  not the newest file. The module has no single-file assumption; feed it 30 small
  files and the spans join up.
- **One engine per character.**
- **434 MB replays in ~7.0 s** on this machine.

**Clause 7, closed**

`voidlingReplies` is bounded at `THRESHOLDS.MAX_VOIDLING_REPLIES` (5,000),
published so a host can read its own ceiling. **Measured occupancy: 600 replies
across all 16 files; ~340 for the busiest single character over 434 MB and three
weeks** — roughly 15× headroom.

**What overflow costs**, because a bound is useless without it: the oldest
seconds drop first, so a refusal older than the surviving window loses its
positive control and reports `unknown` rather than `refused`. It can never
manufacture a false `refused`, because a refusal *requires* a reply in the set.

The classification path was `O(requests × replies)` — 25 M comparisons at the
bound. It now sorts once and binary-searches. At measured volumes it was never
close (~13,600 comparisons); the hazard was theoretical and is now absent rather
than merely unlikely.

---

## What is still open

| question | what would close it |
|---|---|
| **the reset HOUR** | the alt+Z screenshot time + its remaining time. **Blocks nothing, embarrasses everything on 1 Sep.** |
| the absolute lockout period | alt+Z within a minute of entering a fresh instance — fixes R, therefore B, with no assumption |
| do bosses in a raid share one lock? | a run clearing *some* of a zone's bosses, then evidence about the others. One cell per raid assumes they do; the assumption is stated in the module and in the tooltip |
| Group vs raid instance — one lock or two? | unmeasured. Cells carry `shapes` so the question stays answerable |
| Solo instances | never observed in 16 files; the window says they exist |
| `alsoDies` → completion keys | Nagafen's Lair and Permafrost each carry four bosses that die once per visit. They are **recorded and inert**: promoting them could only fail in the dangerous direction (kill Tranix, wipe on Nagafen, be told you are done) |
