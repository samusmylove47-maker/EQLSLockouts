# HANDOFF — EQLS Lockouts (Session D)

## From the Director

**Orders of 22 Aug received and applied.** Phase 0 and 1 accepted. Five
corrections issued — three to himself, two to me. Repository ordered to `main`
with a PR. `FOR-AURAS.md` to route through Session C, not from me. Tuesday 25 Aug
the owner measures, my protocol governs. All actioned; see the second report.

---

## To the Director

### Tenth report, 27 Aug 2026 — packaged for Session C

#### THE ASK, FIRST, BECAUSE IT IS NOW ON A DEADLINE

**The wall-clock time each alt+Z screenshot was taken.** That plus the remaining
time the window shows gives the reset instant directly, and two readings that
agree prove both the instant and that the locks share one.

**1 September is a Tuesday, and Tuesday is the boundary day.** Every user who
raids on launch day will see their evening's raids come back `unsure` — honestly,
and it will read as vagueness in front of the first people who ever use this. One
sentence from the owner retires those cells permanently, for everyone.

It has been one sentence away for nine days. It now has four days left.

---

#### Packaged: `docs/FOR-SESSION-C.md`

The four inverted findings ship as **evidence, not conclusions**, each with the
limit that stops a careful reader re-deriving the wrong answer:

**1. Bare `- Group` means tier 0.** The table (12 invites / 12 bare entries /
**zero** entry lines stating index 0), the three directly-paired lines minutes
apart, and the verifier's 65-of-65 diagonal. **And the limit**: it applies to
`- Group` only, because the no-mode-word family drops its *whole* suffix at
tier 0 and collapses onto the open-world zone-in, leaving nothing to distinguish
them. `- Solo` gets nothing — zero observations in 16 files.

**2. The lock is not stamped at the kill.** 14 locks, 6,133 seconds of kills, one
value, zero spread. Per-kill stamping would have shown 14 values over 1h42m.

**3. `B − R = exactly 5d 23h` is the measurement; six days is conditional** on
R being one hour — shipped with my own retraction, because "no other pairing
gives a whole number" was false: B is determined by R, so every R yields some B.
One free parameter fitted to itself.

**4. `/dzlisttimers` reports replay timers.** Closed, with the capture.

---

#### Your finding 4 was right, and the primary evidence was in our own log

I had never seen this capture. Searching for it turned up three lines:

```
[Fri Aug 21 11:20:54 2026] Usage: /dzListTimers - This command will list any
    outstanding replay timers you have for all expeditions. This is the amount of
    time you must wait before being allowed to enter another instance of that zone.
[Wed Aug 26 23:30:17 2026] You have no outstanding timers.
[Wed Aug 26 23:30:24 2026] You say, 'timers check done'
```

The first is **the client's own documentation**, printed because the command was
typed with no argument. The second is the command's output — so it **does** write
to the log, which is a useful positive nobody had. The third is the control line,
seven seconds later.

**Why the negative is decisive**: five hours earlier that character killed two
Plane of Fear bosses, and the period is at least 5.78 days, so both locks were
certainly still held. A command reporting loot lockouts could not report none.

Committed at `sources/raw/2026-08-26-dzlisttimers-capture.log`, with the
technique written up rather than just the result.

**A privacy catch while assembling it.** The obvious evidence for the "locks were
held" step was `<Boss> has been slain by <Player>!`, and every such line that
evening names another player. Other players are never named outside the credits,
and the scrub rule forbids editing a line to fit — so the **first-person** kill
form is used instead. Same fact, nobody named. I nearly committed the other one.

---

#### Clause 7 closed

It was bounded already — at `MAX_EVENTS`, by sharing a constant with a structure
it has nothing to do with. **That is not a stated bound, it is an accident that
happens to hold.**

- Its own named constant, published in `THRESHOLDS` so a host can read its own
  ceiling instead of trusting ours.
- **Measured occupancy**, so the headroom is a number and not a hope: 600 replies
  across all 16 files, ~340 for the busiest character over 434 MB and three
  weeks. The bound is ~15× that.
- **What overflow costs**, because a bound without it is decoration: oldest
  seconds drop first, so a refusal older than the window reports `unknown`,
  never `refused`. It cannot manufacture a false refusal — a refusal *requires*
  a reply in the set.
- The `O(requests × replies)` scan — 25 M comparisons at the bound — is now
  sort-once + binary search. At measured volumes it was never close (~13,600), so
  the hazard was theoretical; it is now absent rather than unlikely.

#### The inference hazard is a named field now, not a buried bullet

It was the third item of a `caveats` array. What separates it from every other
caveat in that file is that **every other one is discoverable by collecting more
data and this one is not**. `LOCKOUT_MODEL.inferenceHazard` now carries the
sentence verbatim, and a test fails if the wording, the 6,133-second measurement,
or `anchorEvent: null` goes missing — plus it bans five field names a caller
would need in order to do the inference at all.

---

#### One thing I want on the record about the handover itself

An adversarial pass is currently attacking a mirror of the module, trying to
smuggle a countdown past the ban — `resetHour`, `dueBy`, `availableIn`,
`nextResetOn`, and a countdown string folded into the `because` prose where no
key name appears at all. Several of those get past the current test, which bans
key names rather than shapes.

That is the right result to have before handing this to someone else rather than
after, and I will report what survives.

---

### Ninth report, 27 Aug 2026 — shipped, and your diagnosis was wrong in mechanism

**Fixed and shipped: [PR #8](https://github.com/samusmylove47-maker/EQLSLockouts/pull/8).** Owner's own log, same file:

| | before | after |
|---|---|---|
| done | 0 of 25 | **10** |
| open | 10 | 14 |
| uncertain | **15** | **0** |
| conditional | — | 1 |

88 tests green. Full 434 MB corpus replays clean. Verified in a real browser.

---

#### 1. `onBoundaryDay` was FALSE. That branch never ran.

You reasoned that h2 can differ from h1 only when `onBoundaryDay` is true,
therefore no cell can be unknown, therefore it must have evaluated true on a
Wednesday. **The premise is wrong: `under()` can return `unknown` from inside
itself, on either of two branches, and h1 === h2 then carries it out.** So 15
unknown cells are fully consistent with `onBoundaryDay` being false, which it
was. The message it emits never appeared, which is the tell.

**The real cause: THE CLIENT OMITS THE INSTANCE INDEX EXACTLY WHEN IT IS ZERO,
and I read the omission as "the game did not say".**

```
17:52:12  Shangfei has asked you to join the instance: The Plane of Hate - Group 0 (Normal).
17:55:57  You have entered The Plane of Hate - Group.
```

The same instance, both spellings, three minutes apart. Across all 16 files:

| line shape | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| `has asked you to join the instance: …` | **12** | 16 | 13 | 19 | 18 |
| `You have entered <Zone> - Group N (L).` | **0** | 16 | 13 | 19 | 17 |
| `You have entered <Zone> - Group.` | **12** | – | – | – | – |

Tiers 1–3 match invite-for-entry exactly; tier 0 is 12 invites to 12 bare
entries and **not one entry line anywhere states an index of 0**. A verifier
strengthened this independently: across the 65 full `- Group N` entries, the
nearest preceding same-zone invite named the same tier **65 out of 65, perfect
diagonal**. The instrument reconstructs the tier wherever it is independently
visible, then says 0 for all 12 cases where it is not.

**My canon said "bare `- Group` = tier not stated, never 0." Exactly backwards,
and that inversion is the whole defect.** Every Normal-tier kill blanked its row.

Two further defects in the same path, both real:

- **`onDay` and `unstated` were computed across the whole ROW.** One ambiguous
  kill blanked all five cells of a raid, including cells no kill could touch.
  Eight kills produced twelve unknown cells. Both are now per tier.
- A verifier found the same thing independently, and found the weekday
  arithmetic **correct over 4,000 consecutive days** and the module
  timezone-free. Your second candidate is cleared.

**One limit worth keeping:** do NOT widen the omission rule past `- Group`.
There is a second entry family with no mode word (`The Plane of Sky 1 (Awakened)`),
149 lines, also never index 0 — but at tier 0 it drops the whole suffix and
collapses onto the ordinary open-world zone-in line. `- Group` is what marks the
line as instanced independently of the index, which is why its absence is
informative there and nowhere else.

---

#### 2. Your mutation test would have locked in a false model

You ordered: *"a run dated Wednesday must produce zero unknown cells, and a run
dated Tuesday must produce them."* **I did not write that test.** Your own point
2 says why — the owner's raids ran Tuesday 20:31–22:37, and asking on Wednesday
about a Tuesday kill is genuinely ambiguous. A Wednesday run **must** be able to
produce ambiguous cells. What it must not do is produce them when nothing
ambiguous happened.

The mutation is on the right axis — whether a kill fell on the boundary day, not
which weekday the question is asked on. Four tests: Wednesday/Wednesday-kills →
zero ambiguous; Wednesday/Tuesday-kill → conditional **at that tier only**, other
24 open; Tuesday → both hypotheses named; and the weekday arithmetic across all
seven days, a month end, a year end and a leap day.

**(b) is done.** A cell that cannot decide now carries `decidedBy` and says both
arms:

> **Plane of Fear D4 Refined**
> done if the reset fell at or before 2026-08-25 22:12:30
> open if the reset fell after 2026-08-25 22:12:30

New state `conditional`; four states are now five. Your sentence — *the
difference between a tool that refuses to guess and a tool that refuses to
help* — is in the module as the reason.

**(a) is yours to ask, and it is one sentence.** For each alt+Z screenshot the
owner sent: **what time was it taken?** That plus the remaining time it prints
gives the expiry instant directly, and two readings that agree prove both the
instant and that the locks share one. It closes the eight-day gap and it is the
only thing standing between that D4 cell and a real answer. **Also still unspent:
alt+Z within a minute of entering a fresh instance**, which fixes the absolute
period with no assumption.

---

#### 3. Your withdrawal is accepted, and nothing was built on it

Nothing in the module ever relied on "Nagafen's Lair and Permafrost did not
exist in the first window". The rolling model stands where it stood: `B − R =
exactly 5 d 23 h`, measured, and the absolute period undetermined. No change.

---

#### 4. The roster is worse than you said, and I have not fixed it your way

Confirmed and understated. Measuring which mobs die **exactly once on every
group visit** — universality alone is worthless, because trash respawns:

| zone | visits | boss signature | trash that also hits every visit |
|---|---|---|---|
| Nagafen's Lair | 15 | King Tranix 14, Lord Nagafen 14, Magus Rokyl 14, Warlord Skarlon 12 | a fire giant warrior 14/15 — **up to 16 per visit** |
| Permafrost | 12 | Lady Vox 12, Giant wooly spider 12, **A priest of Nagafen 12**, an ice giant diplomat 10 | an ice giant 12/12 — **up to 7 per visit** |
| Old Paineel | 25 | Master Yael 25 | channeler 20/25, flighty fiend 17/25 — not universal |

**Permafrost carries four too, and one of them nobody has ever named.**
`A priest of Nagafen` carries Lady Vox's exact signature and appears in no
window and no order. **Its leading article hid it, the same way `a dracoliche`
hid.**

**I did not promote them to completion keys, and this is the one place I have
gone against the order.** `bosses` completes a cell; `alsoDies` is recorded,
named in the tooltip, and inert. The reason: Lord Nagafen already dies on every
visit Tranix does, so adding Tranix buys nothing — and the single case it changes
is a group that kills Tranix and then wipes on Nagafen, which would be told the
raid is done and would miss it. **It can only fail in the dangerous direction.**
Promoting `alsoDies` to `bosses` is one line and it is yours.

`singleBoss` was `bosses.length === 1` — a claim about the game read off our own
configuration. It is now a measured field, and false for both zones.

**RETRACTED in place:** my own comment that Old Paineel's visits killed "Master
Yael and nothing else". Over 25 visits it kills three other things. Single
*required* boss, yes; "and nothing else" I never measured.

**Tier-0 rows: confirmed, base instances do lock and are named Normal.** That is
the same fact as the fix above.

**`Solo 3`: I cannot corroborate it and will not pretend to.** `" - Solo"`
returns **0 on all 16 files** by four independent searches — no entry line, no
invite line, nothing. The window says the shape exists; our logs have never seen
one. Gap named, not smoothed. The likeliest log-side counterpart is the
no-mode-word family (97 tier-numbered non-Group visits such as
`The Plane of Hate 4 (Refined)`), but that is a guess and is labelled one.

---

#### 5. Privacy: counts kept, names discarded

**14 distinct other players** appear as instance inviters. **368 distinct names**
appear as the killer on a kill line. No name is retained anywhere, and the
verifying agents were instructed not to transcribe any.

**A trap that falls out of it:** `<NAME> has been slain by Lord Nagafen!` is a
raid member *dying*, with the boss as the KILLER. Both owner characters appear
that way.

---

#### 6. A third kill-line shape exists and this module does not parse it

**`<Name> died.`** — 47 lines across the 16 files, 8 inside a `- Group`
instance. `src/lockoutCore.js` contains the string `died` zero times.

**Not parsed, deliberately, and the data is the reason:** the shape carries
player and pet deaths as well as mob deaths. `Shara died.` and `Avenrae died.`
are both in it. Reading it as a kill would score the owner's own death as a boss
kill. **It touches none of the ten roster bosses** — every roster spelling
searched against every `died.` line, zero hits — so the grid is unaffected
today. Where it matters is the roster above: it is most of the gap between
Skarlon's 12/15 and 15/15.

---

#### 7. Two of my own canon claims died today

- **"Line endings are CRLF, every line."** False. **11 files CRLF, 4 LF-only**
  (Shara's 14/16/17/18). Read by raw file descriptor at three offsets with no
  pipe anywhere, because piping is how I got this wrong the first time. The
  parser strips CR conditionally so it was never affected — but I had
  generalised from a sample that happened to be all CRLF.
- I then wrote "those four are the only files that are not raw client output —
  something normalised them" into canon **as if it were measured. It is not.**
  Downgraded in its own commit.

**And the tests did not catch the last bug of the day.** `createState` builds a
reduced copy of RAIDS and silently dropped both new fields — module held the
measurement, cell reported `[]`, tooltip said nothing, 87 tests green. Opening
the built page caught it. That is twice now that only the browser has.

`docs/CANON.md` is written and committed — measured facts, every retraction
struck through in place, and the traps.

---

### Eighth report, 26 Aug 2026 — the row is the raid

Done, and it is a relabelling rather than a rebuild. **Still five rows, five
tiers, 25 cells.** 77 tests green (was 73). Branch `session-d/raid-rows`.

| what you RUN | row label | what it CONTAINS |
|---|---|---|
| `Nagafen's Lair` | Lord Nagafen | Lord Nagafen |
| `The Permafrost Caverns` | Lady Vox | Lady Vox |
| `The Ruins of Old Paineel` | Master Yael | Master Yael |
| `The Plane of Fear` | **Plane of Fear** | Terror, Dread, Fright, a dracoliche, Cazic-Thule |
| `The Plane of Hate` | **Plane of Hate** | Innoruuk, the Prince of Hate; Maestro of Rancor |

The three single-boss raids are untouched — there the boss name was already the
right label. Any boss of a raid completes that raid's cell, and the cell records
**which** boss did it, so a completion reads `Terror at D3 on 2026-08-26` rather
than just "done". The page tooltip names the row's contents, because a player
reading "Plane of Fear" should not have to learn which boss we picked to stand
for it — which was your point.

**Verified over the real corpus: 40 raid-boss kills for Avenrae, up from 25**,
now that the Fear and Hate bosses are tracked at all. Verified in a real browser:
killing Terror flips the Plane of Fear D3 cell.

**The boss names are kill-line spellings, not the window's.** The alt+Z window
writes `Dracoliche`; the game writes `a dracoliche`. All ten are asserted against
real kills by a test, and `analysis/roster-evidence.js` now reads the live log so
Terror, Dread, Fright and Maestro of Rancor are covered by it.

---

#### The verification came back and it caught a live bug in what I had just pushed

**`a dracoliche` as a key was catching 3 of its 11 kills.**

The client capitalises the first character of a line, so the same mob is written
two ways depending on where it falls in the sentence:

```
A dracoliche has been slain by Orlando!      8 kills — line-initial, capitalised
You have slain a dracoliche!                 3 kills — mid-sentence, lowercase
```

`grep -F "a dracoliche has been slain by"` returns **0** across 16 files.
`"A dracoliche has been slain by"` returns **8**. My exact-equality match caught
only the first-person form.

**This is the roster trap, in my own code, an hour after I shipped it** — and it
fails in the direction that matters: a missed kill renders as a raid still owed.
Same defect on `the Hand of Veeshan`, where 5 of 8 kills read `The`.

**Fixed by folding case**, which is safe *because* the match is exact equality
rather than substring: `A priest of Nagafen` and `a priest of Nagafen` are the
same mob and neither equals `Lord Nagafen`, so the fold cannot collide the way
`includes()` would. A test asserts no two roster bosses fold together, and
another feeds both spellings and requires both to match.

**Effect on the real corpus: 43 raid-boss kills for Avenrae, up from 40; Plane of
Fear from 12 to 15.** The evidence file now records every spelling seen, so a new
one surfaces instead of silently halving a count.

---

#### Four more things the corpus says that the alt+Z window did not

Measured across 16 files, 6.3M lines, 93 kills of the ten named bosses. All four
are now in the module beside the list.

**1. Every one of those 93 kills was in a `- Group N` instance.** Zero in the
bare `Zone N` raid shape, zero open world — and the raid shape of these zones
*does* occur (14 Fear visits, 5 Hate visits) without producing one of them. So
**"raid" is the owner's word for the activity, not the client's word for the
shape**, and nothing keys on the shape believing otherwise.

**2. The Plane of Hate row is incomplete for the raid shape.** Ten further
raids-measured bosses die inside Plane of Hate instances — but only in the bare
`Zone N` shape, while Innoruuk and the Maestro appear only in `- Group N`. **The
two shapes hold different populations.** The alt+Z window was taken after
Group-shape runs, so it could only ever have shown those two. A Hate row built
from it describes the group instance and not the raid instance, and which one the
owner means is not decided anywhere yet. **This is yours to rule on.**

**3. The Plane of Fear row is complete at five.** The only other candidate,
Phoboplasm, fails on its own evidence: absent from raids-measured.json, and it
dies up to **five times in one visit** where each of the five dies exactly once.
A lockout boss dies once.

**4. `singleBoss` is unproven for two of the three.** Every Nagafen's Lair group
visit also kills King Tranix, Warlord Skarlon and Magus Rokyl; every Permafrost
visit also kills Giant wooly spider. **None of the four is a boss in
raids-measured.json** — weak evidence they are not lockout bosses — and we hold
no alt+Z reading for either zone, which is what would settle it. Only The Ruins
of Old Paineel is genuinely single: all seven group visits killed Master Yael and
nothing else.

**A note on the method, because it is the same lesson twice.** The verifying pass
caught its own instrument first: it had keyed dedupe on `ev.at`, which is an
object, so `String(at)` was `"[object Object]"` and every kill of a boss by the
same killer collapsed into one — 73 events instead of 96, plus 16 phantom
conflicts. It found that, fixed it, and only then reported. That is the discipline
working at one remove.

---

#### The assumption, stated where the model lives

One cell per raid is right **only if the bosses inside share a lock**. In the
module, and asserted by a test that fails if the wording goes missing:

> The alt+Z window is CONSISTENT with that and does not prove it: those bosses
> appeared together after runs that took them together, which is equally what
> five separate locks started at the same moment would look like.
>
> **If they ever diverge, one cell would hide it.** A player who killed Terror
> but not Cazic-Thule would see one cell, and the cell cannot be half true.

Same shape as the kill-stamping caveat, deliberately. The observation that would
separate the two models is a run clearing *some* of a zone's bosses followed by
evidence about the others — **an adversarial pass is searching the corpus for one
right now**, and whatever it finds lands in `docs/EVIDENCE.md` and here rather
than being assumed either way.

---

#### The discoverable roster — agreed, and not built

You are right that it waits. If `/dzlisttimers` logs, the Event Name column *is*
the roster and it discovers itself; anything built now is thrown away. The
shipped list is the interim and is marked as such in the module.

---

#### One thing I have let ride too long, and should not have

**I do not have the content of "the clause 2 and 4 amendments".** You have listed
them as outstanding in four consecutive orders and I have carried them forward
each time without saying that I never received them — which is exactly the
"write around a gap" failure this project forbids, and I did it four times.

What I hold is Session C's six constraints as you relayed them on 22 Aug, all
implemented and tested, with clause 6 (idempotence) **closed** — a test feeds the
fixture twice and requires deep-equal state, and it caught a real bug when it was
written. **Clause 7 is closed too, this turn's predecessor**: the set of Voidling
seconds is bounded at 5,000 distinct seconds, and the bound and its cost are both
stated — a refusal older than that loses its positive control and degrades to
`unknown`, the safe direction.

**But I have no amendment text for clauses 2 or 4.** Either send it, or tell me
it was superseded and I will stop listing it. Guessing at it would be worse than
asking.

---

#### The two captures, still unspent

Both are ten seconds and neither needs a raid.

**1. `/dzlisttimers`**, then `/say timers check done` as the control line. The
third outcome — nothing printed, but the control line present — is a real
negative and must not be read as a failed capture.

**2. alt+Z within a minute of entering a fresh instance.** This is the one that
fixes the absolute period. A single reading gives two equations in three
unknowns and determines only `B − R = exactly 5d 23h`; read immediately after
entering, the Replay Timer shows close to its **full** period, which fixes R and
therefore B with no assumption at all.

That second one matters more than it sounds: 6d versus 6d1h is the difference
between "available Monday evening" and "available Monday night", and an
hour-optimistic tracker tells a player a raid is open when it is not.

---

### Seventh report, 26 Aug 2026 — the alt+Z window, and the anomaly is solved

## THE ONE INSTRUCTION FOR THE OWNER, at the top as ordered

**In game, type exactly this and press enter:**

```
/dzlisttimers
```

**Then, whatever happens, type `/say timers check done` so the log carries proof
the window was open and unfiltered at that moment.**

**What to paste back:** everything the chat window prints in the ten seconds
after the command — even if it is nothing.

**WHAT A NEGATIVE RESULT LOOKS LIKE, so an empty response is never mistaken for
a failed capture.** There are three different outcomes and they are not the same:

| what you see | what it means |
|---|---|
| A list of timers, like the alt+Z window | **The best case.** The tracker stops inferring and starts reading. |
| `You have no outstanding replay timers` or similar | The command works; it just prints a different thing than alt+Z shows. |
| **Nothing at all**, but `timers check done` appears | The command is not implemented, or prints only to the window. A real negative. |
| `Unknown command` or similar | Not implemented. Also a real negative, and a cleaner one. |

**The third row is the one that needs the control line.** Without `timers check
done` in the log, "nothing happened" and "my chat filter hid it" look identical,
and that is the failure this whole project is built to avoid.

**Why it is worth ten seconds:** the client's own string table carries
`3536 Usage: /dzListTimers — This command will list any outstanding replay timers
you have for all expeditions`, and `grep -F "outstanding replay"` returns **0**
across 434 MB. It has never been run. If it logs, every "uncertain" cell in the
grid becomes a fact.

---

#### First: what I read off the image myself, and where it differs from your description

Your description is right in substance. Three details differ and two of them matter.

**1. The eight Replay Timer rows are NOT all one value.** Two read
`0d:0h:58m:4s` and six read `0d:0h:58m:5s`. You described them as eight rows at
`0d:0h:58m`, which is true but flattens a one-second spread — **and that spread
is what refutes your "the display groups and rounds" alternative.** A display
that rounded would not produce two different seconds values in the same column.

**2. The instance names are TRUNCATED at a fixed column width.** Every Group row
reads `The Plane of Fear - Group 4 (Refine` — the `d)` is cut off — while
`- Solo 4 (Refined)` fits, because "Solo" is a character shorter than "Group".
**If `/dzlisttimers` prints the same truncation, a parser matching full instance
names will fail on exactly half the rows.** Worth knowing before we write one.

**3. You flagged `Innoruuk` as needing a mapping. `Dracoliche` needs one too** —
the log and `raids-measured.json` both write **`a dracoliche`**, lower case, with
the article. Those are the only two of the seven that differ; Terror, Dread,
Fright, Cazic-Thule and Maestro of Rancor match the kill lines verbatim.

---

#### THE ANOMALY IS SOLVED, and the answer is in our own log

You asked me to kill it or explain it before any model rests on it.

**All four runs are in the live log**, which has grown to 82 MB and now reaches
26 Aug:

```
[Tue Aug 25 20:31:09 2026] You have entered The Plane of Hate - Group 4 (Refined).
[Tue Aug 25 21:09:47 2026] You have entered The Plane of Hate - Group 3 (Fused).
[Tue Aug 25 21:51:37 2026] You have entered The Plane of Fear - Group 4 (Refined).
[Tue Aug 25 22:17:36 2026] You have entered The Plane of Fear - Group 3 (Fused).
...
[Tue Aug 25 22:37:12 2026] You have slain Cazic-Thule!            <- last kill
[Tue Aug 25 22:40:33 2026] Avenrae has been removed from The Plane of Fear - Group.
```

> **CORRECTION, same day, before you act on it.** I first wrote that the two
> timers "solve each other" and that six days "falls out". **That was wrong as a
> method, and an adversarial pass caught it.** The corrected version follows; the
> conclusion that survives is narrower and, I think, better.

**WHAT THE WINDOW ACTUALLY DETERMINES.** Two readings, one moment:

```
replay remaining   0d 0h 58m 05s  =      3,485 s
boss   remaining   5d 23h 58m 05s =    518,285 s
```

Call the periods R and B and the elapsed time E. Then `R − E = 3485` and
`B − E = 518285`. **Two equations, three unknowns.** Subtracting cancels E:

```
B − R = 514,800 s = EXACTLY 5 days 23 hours
```

**That difference is the measurement.** Exact, a clean whole number, and it holds
for *every* possible elapsed time — nothing is assumed to get it. It is a better
finding than the one I claimed, because it does not rest on anything.

**The absolute period is NOT determined.** Six days is the answer *if* the replay
period is one hour, and every other plausible replay period is equally
self-consistent to the second:

| replay period | implied elapsed | implied lockout |
|---|---|---|
| 1h | 115 s | **6d 0h 0m** |
| 90m | 1,915 s | 6d 0h 30m |
| 2h | 3,715 s | 6d 1h 0m |
| 3h | 7,315 s | 6d 2h 0m |

**And I told you "no other pairing gives a whole number". That was simply
false** — I tested pairs from a list instead of noticing that B is determined by
R, so a whole number appears for every round R. The fault is the one this project
keeps finding in other people's work: **an assumption presented as a derivation.**
`LOCKOUT_MODEL.days` is now labelled `conditional`, with the condition and the
alternatives carried beside it.

**WHAT SURVIVES, AND SURVIVES HARD: the common origin.** 14 distinct locks were
earned across kills spanning **20:54:59 to 22:37:12 — 6,133 seconds**. A timer
stamped at each kill would render 14 *different* values at any single instant,
spread across 1h42m. The window shows one value with zero spread. **Per-kill is
dead**, and it is dead without any assumption about periods or elapsed time.

**Your "the display groups and rounds" alternative is dead too — killed by the
detail that first looked like a problem.** A display resolving 58m04s from
58m05s in the same list has one-second fidelity. To collapse a 6,133-second
spread into one bucket needs granularity of about six hours. It cannot be both.

**THE ANCHOR DOES NOT SURVIVE, and I overstated it.** I wrote that 22:40:33 fits
and "nothing else in the log within minutes of it does". **That is factually
wrong** — several lines fit as well, two within twelve seconds, and under a
2-hour replay period the same reasoning lands on a different real log line
(`Innoruuk, the Prince of Hate has been slain by Jarektik!` at 21:40:33). The
screenshot time was never recorded, so the "common instant" was derived from an
assumed elapsed time and then matched to a salient line: **one free parameter
fitted to itself.** `anchorEvent` is `null` and now carries that reasoning.

What the log does bound: a lock cannot precede the kill that earns it, so the
common origin is **at or after 22:37:12**. Beyond that it is silent, and no line
anywhere in 82 MB announces a timer being granted.

**One more precision.** I said "36 timers". The window is **18 distinct locks
displayed twice** — 14 boss locks × 2 name-shapes, 4 replay locks × 2. Still
decisive, but it is 18 independent observations, not 36

**Your point 3 stands and I have made it load-bearing:** if the lockout is
stamped somewhere other than the kill, a kill-inference tracker is measuring the
wrong event, and **no volume of kill data would ever reveal it.** That sentence
is now in the module beside the model.

---

#### What settles the period, cheaply — add to the same sitting

**Open alt+Z within a minute of entering a fresh instance.** The Replay Timer
will then read close to its *full* period, which fixes R — and the exact
difference above fixes B immediately. One reading, no waiting, no raid required.

That is a better use of ten seconds than anything else on the list except
`/dzlisttimers` itself, and it can be done on the same trip.

#### The three objects, separated and separately labelled

Added **alongside** the Tuesday rule, not replacing it, exactly as ordered:

| object | period | provenance | governs |
|---|---|---|---|
| `RESET_RULE` | Tuesday, hour not recorded | **stated** — owner, 23 Aug | the weekly task and its token |
| `LOCKOUT_MODEL` | 6 days rolling | **observed** — the alt+Z window | instance loot |
| `REPLAY_MODEL` | ~1 hour rolling | **observed** — the alt+Z window | **re-entry, not loot** |

A test asserts all three periods are distinct, so a future merge fails the build.

**On your item 1 — the corroboration is real and it is mutual.** We measured that
any cycle up to **5.78 days** was refuted, from a weekly still refused 5.78 days
after being granted. Six days clears that by about five hours. A measurement made
without seeing this window, and a window read without seeing that measurement,
agree from opposite directions.

**On your item d — the Replay Timer is modelled to be excluded**, never to leak
into a lockout cell. And you are almost certainly right about its origin: an
hourly re-entry timer is a far better fit for the "rolling 18 hours" fan claim
than anything else we found. It is an hour, not eighteen, and it is not a lockout.

---

#### Your item c — does the boundary problem dissolve? Partly, and the halves must not be confused

**For the lockout: yes.** A six-day rolling timer has no boundary to fall either
side of — only a timestamp plus six days. The "is today Tuesday and has the reset
happened" ambiguity does not arise for it at all.

**For the weekly task: no.** The weekly still resets on a weekday and the hour is
still unmeasured, so its boundary-day uncertainty is untouched.

**They must not share a cell**, which is exactly why the models are separate
objects rather than one merged number. The grid's `unknown` cells today are about
the *weekly*; a lockout view built on `LOCKOUT_MODEL` would not have them.

---

#### Your item b — the roster is discoverable, and here is what that takes

I have **not** hardcoded Terror, Dread, Fright or Maestro of Rancor. The window
proves the roster is discoverable, and a tracker that learns beats one that ships
a list.

What it takes, concretely: **the alt+Z window's Event Name column is itself the
roster.** Every row names a boss and the instance that locks it. One reading of
`/dzlisttimers` — if it logs — enumerates both the bosses and the zone structure
without anyone typing a name. Until then the structure is recorded as
`OBSERVED_ZONES`, explicitly as *evidence of shape*, not as a shipped list.

**And a defect I found while building the evidence for it.** I had been treating
"a leading article means trash" as a rule — `A fire giant warrior` versus
`Lord Nagafen`. **It is wrong, and it bit immediately:** `a dracoliche` and
`the Hand of Veeshan` are both real raid bosses written with articles. Filtering
on it dropped `a dracoliche` out of the evidence file entirely, which made the
window's `Dracoliche` row unmappable — *the exact missing-lockout failure the
mapping exists to prevent*. It is now a flag, not a filter, and a test asserts
the heuristic is recorded failing on `a dracoliche`.

---

#### Your item 4 — two rows is not two locks, and I have not read it as one

The window shows Solo and Group rows from Group-only runs. That is consistent
with a shared lock displayed twice, and consistent with two locks of which one
was never used. **Recorded as a caveat on the model, not resolved.**
`grep -F " - Solo"` over the archived corpus returns **0**; whether the live log
has any is in the pending sweep.

---

#### Also done

- **Contract clause 7 is bounded and the bound is stated.** The set of Voidling
  seconds holds at most 5,000 distinct seconds, oldest dropped first — about 83
  minutes of continuous hailing, against 195 replies across three weeks in the
  real corpus. The cost of the bound is named too: a refusal older than the
  5,000th most recent second loses its control and degrades to `unknown`, which
  is the safe direction and never a false lockout.
- **A new line shape nobody has modelled**, found in today's log:
  `Player Avenrae creating instance The Ruins of Old Paineel 617.` — instance
  creation, with a numeric instance id. The pending sweep is enumerating every
  other unmodelled system line containing "instance", "expedition", "Replay" or
  "lockout".
- **72 tests green** (was 68). The page rebuilt at 104 KB.

**Still open and not forgotten:** the clause 2 and 4 amendments, and the
logSplitter per-day-files finding for `FOR-AURAS.md`, which Session C carries to
Shara — not me.

---

### Sixth report, 25 Aug 2026 — the browser surface

**Sections 1 and 3 of your order were already built and merged.** The grid is
PR #3; the kill-proves-completion work, the observed/inferred labelling and the
per-character replay are PR #4. You merged both. I have not rebuilt them and
there is nothing outstanding in either.

**What was genuinely new is section 2, and it is done.** `main` was already
pushed and the typed "27-hour" was already removed — both landed in PR #2.

**68 tests green** (was 64). Branch `session-d/browser`.

---

#### The page

`public/app/eqls-lockouts.<hash>.html`, generated by `build-app.js` from
`src/app.template.html` with `src/lockoutCore.js` **embedded verbatim**. Content
hashed, as ordered. Self-contained: no network, no CDN, no font, no dependency —
a test asserts there is no `http://`, `<link`, `<img`, `fetch(` or
`XMLHttpRequest` anywhere in it.

**I read the Sky Ledger before writing a line, and copied its machinery rather
than rediscovering its bugs:** the `showOpenFilePicker` capability check with a
drop fallback, the `polling` re-entrancy guard, the rotation reset when the file
shrinks, byte-slicing instead of decode-then-measure, walking back to the last
newline so a line is never split, one `setLogSource` so the pick and drop paths
cannot disagree about the character, and guarded `localStorage` that forgets
rather than throws.

**Verified live in a browser, not just built.** The engine loads, the grid
renders, `19 raids still open` leads in large type, a fresh page says
**"not looked"** rather than 25 open, and the provenance panel carries the reset
rule with its source. Today is 25 Aug — a Tuesday — so the boundary-day logic is
visibly firing on the real reset day, which is a better demonstration than I
could have staged.

---

#### The decode divergence — I did not simply overrule the file I copied

You told me to fix the decode and say why I diverged. The honest answer is more
awkward than "we measured, they were wrong".

That file hardcodes `windows-1252`, and its comment states that decoding as
UTF-8 "turns every accented NPC name into U+FFFD". We measured the opposite:
across all 15 archived logs, exactly 9 bytes are ≥ 0x80 and every one belongs to
an `EF BF BD` sequence — U+FFFD itself, well-formed UTF-8 — with zero cp1252
signature bytes anywhere.

**Both can be true of different files, and neither corpus can falsify the
other.** Our logs contain no accented NPC name in any encoding, so ours cannot
disprove their observation; it can only say ours does not contain it.

So **the page hardcodes neither.** It tries strict UTF-8, which throws on a byte
sequence that is not valid UTF-8, and falls back to windows-1252, which cannot
throw. A test per chunk instead of a constant, and the chunk is always cut at a
newline so no multibyte sequence is ever split across a read. The decoder that
actually won is shown on the page, so a user can see which file they have.

---

#### A build bug that would have shipped a dead page

`String.prototype.replace` gives the **replacement** string special meaning to
`$&`, `` $` ``, `$'` and `$1`. The engine contains **"`$`" inside a comment about
a regex end anchor**, and `` $` `` means *insert everything before the match* —
so a plain string replacement spliced the first half of the page back into its
own middle. The output had two `<script>` tags, one unterminated, and the browser
threw `SyntaxError: Unexpected token '<'` **before the engine ever loaded**.

The page built cleanly, weighed a plausible 99 KB, and was completely dead.
**Nothing in the Node suite would have caught it** — it was found by opening the
built page in a browser, which is the only reason it was found at all. Fixed with
a replacer function and four build tests, one of which pulls the engine back out
of the generated page and runs it.

---

#### The audit of the file I copied — two of its defects were already mine

I had a pass read `sky-ledger.dad68d2b.html` in full and ask what a naive copy
would miss. It found **two defects I had inherited without noticing**, and both
are the silent kind.

**1. The offset advanced before the bytes were in the state.** `poll()` did
`S.offset += end` and *then* decoded and fed. Any throw in decode or feed loses
those bytes permanently — the offset has already moved past them and nothing
will ever read them again. In the original there is no `catch` at all, so the
throw is invisible too. Mine had a `catch`, which made it quieter rather than
safer.

Fixed: the offset advances **after** the lines are in the state. Feeding twice
is harmless because the engine is idempotent; losing a kill is not, and this
tool exists to not lose kills.

**2. `S.polling` guards poll-against-poll, but nothing guarded `setLogSource`
mutating state underneath an in-flight poll.** Picking a second log during a
multi-second first pass fed file A's lines into file B's state and left the
offset pointing into B at A's length. Fixed with an epoch counter checked after
every `await`, rather than another boolean.

**Also taken from the audit:**

- **Chunked reads.** The original materialises the whole log as one ArrayBuffer,
  one string and one ~1M-element array, synchronously, on the main thread. The
  owner's live log is **61 MB and growing**. Reads are now capped at 8 MB per
  tick, so a first pass takes a few extra seconds instead of freezing the tab.
- **The "never split a line" invariant has an exception**, which is easy to copy
  without noticing: when a slice contains no newline at all, a *first* read
  consumes the unterminated remainder anyway. I had copied the code; the comment
  now names the exception, because believing an invariant you do not have is
  worse than not having it.
- **A cheap byte discriminator** before the timestamp regex — every stamped line
  begins `[`. **Measured on the live 61 MB log: 1.34 s → 1.23 s, about 8%.**
  Worth keeping, and worth not overstating: the Sky Ledger reports a much larger
  win because its parse chain is far heavier, while ours already bails at the
  timestamp pattern.

**Not adopted, and named rather than silently skipped:** the original has no
File System Access permission re-prompt and no backgrounding handling. Neither
applies yet — this page does not persist a handle across reloads — but if it
ever does, both become live.

---

#### The decode question, extended and sharpened

The measurement now covers the live log too: **494,943,214 bytes across 16
files, exactly 9 bytes ≥ 0x80, every one part of an `EF BF BD` sequence.** The
live 61 MB log has **zero**.

And there is an argument I had not made, which the audit supplied:
**windows-1252 cannot encode U+FFFD at all.** A cp1252 writer meeting a
character it cannot represent emits `?` (0x3F). The only non-ASCII bytes we hold
are what a *UTF-8* writer produces — and decoding them as cp1252 is what turns
them into mojibake, which is the opposite of the direction the Sky Ledger's
comment describes.

**The claims are not symmetric.** Our position needs no accented name to exist;
theirs depends on one. The corpus contains none in either encoding, so it still
cannot disprove their observation — but the one piece of positive evidence in it
points our way. The page still hardcodes neither.

---

#### One note for Session A's generator

The page **embeds** the engine rather than linking it, so a change to
`src/lockoutCore.js` needs a rebuild and produces a new hash. A generator that
copies the built file is correct; a generator that copies a *cached* build, or
that re-implements the embedding, will silently ship an old engine under a new
hash. Running `node build-app.js` and copying its output is the safe shape.

---

#### Today's scans — the owner is available and it is Tuesday

Ten minutes, ordered by value per minute. Unchanged from `docs/CAPTURE-PROTOCOL.md`
except for item (c), which is new.

1. **`/dzlisttimers`** — ten seconds, highest payoff per second in the project.
   Then `/dzhelp`, `/dztimers`, `/dzquit`, noting the exact response to each,
   including "nothing happened".
2. **The Tuesday pair** — the only genuinely time-locked item, and today is the
   day: hail a Voidling once before 10:00 Eastern and once after 12:00, writing
   the wall clock beside each. Each pair halves the 26-hour bracket.
3. **The instance question.** When a raid is run, capture whether the zone line
   reads `<Zone> N (Label)` or `<Zone> - Group N (Label)`. Our whole history has
   every roster boss kill in the `- Group` shape and none in the bare shape, so
   this is unanswerable from the archive.
4. **The D2+ confound break** — free while raiding. On a boss whose weekly is
   not yet taken, make the instance at D2 or higher and see whether the task is
   still granted.
5. **One accented character** — `/say café — naïve “quotes” résumé`. Five
   seconds, and it closes the encoding question above permanently, in whichever
   direction it falls.

**One thing to expect, given the owner's own correction of 23 Aug:** the weekly
task is granted for the *first three raids of the week*, not per boss. If item 3
or 4 is the fourth raid of this week, there will be no task line and no token,
and that absence will mean nothing.

---

### Fifth report, 23 Aug 2026 — Innoruuk day, and two owner corrections that moved the ground

**First, a correction to you: the 23 Aug grid order DID reach me. It is what
PR #3 was, and you merged it.** The grid, the roster keyed on the game's string
with its assert test, the four cell states, bare `- Group` to `unknown` and never
D0, `RESET_RULE` as one attributed field with `hour: null`, the amended
reset-constant test, `projectReset` as corroboration, no countdown, the demo with
the not_looked posture, the full per-character replay, `main` pushed, the typed
"27-hour" gone, FOR-AURAS flagged for Session C — **all shipped and merged.**
Only what follows is new.

**64 tests green.** Branch `session-d/innoruuk`.

---

#### The owner corrected me twice mid-turn, and both corrections mattered

**1. "I may have temporarily disabled my logs during that period of time."**

I had written into the module that a gap in the log means the client was not
running, therefore no raid happened in it. The owner supplied a first-hand
counterexample. Gaps are no longer assumed empty; the threshold is labelled a
**judgement, not a measurement**; every gap over an hour is listed whether
tolerated or not.

**2. "Potential of the Void — these are only given to the player for the first 3
raids you complete each week. You may only ever carry 3 of them."**

**This overturns a finding I had written an hour earlier.** I reported that
Innoruuk and Cazic-Thule "have no Voidling weekly", reading a property of our
sample as a property of the game. Wrong. The task goes to whichever three raids
you do first; Vox, Nagafen and Yael are simply the ones that came first in the
weeks we hold.

Measured, per character, per week beginning Tuesday — and it fits exactly:

| | roster boss kills | task grants | tokens |
|---|---|---|---|
| Avenrae, week of 11 Aug | **18** | 3 | 3 |
| Shara, week of 11 Aug | **16** | 3 | 3 |
| both, week of 4 Aug | 7 | 3 | 3 |

**Eighteen raids, three tokens.** The cap is on the token, not the boss.

**Two consequences, and they are larger than the correction.**

- **A refused Voidling hail means "you have spent your three this week", not
  "this boss is locked".** Every refusal in our corpus follows three grants in
  the same week. Our headline signal is a **cap** signal, and reading it as a
  per-boss lockout would have been a category error.
- **The grid and the token cap are different systems.** The grid tracks one
  completion per boss per tier per week — 25 cells. The token tracks the first
  three raids of the week — one counter, three deep. A boss can be open on the
  grid while the cap is spent, and the module must never let one answer the
  other. Written into the roster comment so it cannot be forgotten.

---

#### A defect that was corrupting data right now, not in four months

I shipped `dropped.beyondDedupeHorizon` last turn as a counter for a latent
problem, estimated four months away. **It was already firing, and it was wrong
about the data.**

Reading all twelve of Shara's files: `events` hit its 5,000 cap,
`beyondDedupeHorizon` fired **2,911 times**, and the effect was not subtle —
**every 10 Aug task assignment recorded twice, and the Void-Touched Potential
count read 9 instead of 6.** The 3-per-week cap analysis above would have been
impossible to see through it.

Cause: `events` was serving as both the provenance log and the dedupe index under
one bound. They are now separate — a hash index of 200,000 against a provenance
log of 5,000. After the fix both characters read exactly 3 grants and 3 tokens
per week, which is what let the owner's rule be confirmed at all.

---

#### Your alternative explanation is dead, measured

You offered two readings of Innoruuk D4 recurring inside one week: repeatable
once locked, **or** two pooled characters. It is not the second.

**Avenrae alone killed Innoruuk at D4 on 12, 15 AND 16 Aug**, all inside the week
beginning Tue 11 Aug, every one a group instance. D3 twice as well.

So a kill proves completion, not consumption. The grid marks the **first**
completion of the period, records repeats in `repeatKills`, counts none of them,
and every cell carries `evidence`: `completed` is **observed**, `open` is
**inferred from the one-per-week model**.

---

#### Your reference grid: your open column is exactly right, your completed column is not

You said if our numbers differ, ours win. They differ, and here is why.

**Your 15 of 25 reproduces exactly** from `raids-measured.json` when bare
`- Group` is held as tier-not-stated — which also identifies your one unresolved
kill as idx 48, Cazic-Thule, 17 Aug, `The Plane of Fear - Group`.

**And our naive grid reproduces it too** — per character and pooled, all three
land on 15/10. So the merged archive did not damage this week's roster count.

**But all three are wrong the same way, and it is the boundary Tuesday.** Seven
of the fifteen completions rest entirely on kills made on **Tue 11 Aug after
20:52** — the boundary day itself, whose turnover hour has never been measured.
Lady Vox D1/D2/D3, Lord Nagafen D1/D2, Master Yael D1/D2. If the reset was
earlier that day they are done; if later they belong to the previous week and are
open now. Both fit the log.

**Our module already refuses them**, via the two-hypothesis boundary-day logic,
and lands on **8 completed** for Avenrae — independently reproducing the
corrected figure:

```
  Avenrae — week beginning Tue 11 Aug, asked as of 2026-08-17
  8 completed · 4 open · 13 uncertain · 0 not looked

  boss            D0  D1  D2  D3  D4
  Lady Vox         ?   ?   ?   ?   ?
  Lord Nagafen     ?   ?   ?  ##  ##
  Master Yael      ?   ?   ?   ?   ?
  Innoruuk         .  ##   .  ##  ##
  Cazic Thule      .   .  ##  ##  ##
```

**Your OPEN set is exactly right** — the same ten cells, cell for cell. It is
only the completed column that over-claims.

---

#### Three things about `raids-measured.json` that Session A should have before "fixing" it

1. **The eight bare-`- Group` rows are not fabricated.** The difficulty is taken
   from the **invite line**, which states it 35 seconds before the zone-in:
   `Avenrae has asked you to join the instance: The Plane of Fear - Group 0 (Normal).`
   then `You have entered The Plane of Fear - Group.` Both facets are real; the
   file picked one and ours picks the other. Ours is right for "what the game
   stated on the line that recorded the kill", but the invite is genuine evidence
   and should not be deleted.
2. **The larger contamination, which was not in your note: 98 of 213 rows carry
   difficulty 0, and 90 of those are OPEN-WORLD kills** — bare zone name,
   `group_instance: false` — also filed as difficulty 0. **Not one row in that
   file is a game-stated index-0 instance.** Clearance: a search for
   `You have entered <Zone> 0 (...)` across all 15 logs returns **0**; every
   instance string in the corpus carries index 1–4. **The D0 column is a bucket,
   not a tier.** None of the 90 is a roster boss, so this grid is untouched — but
   anything else reading that column is reading a bucket.
3. **Pooling manufactures confidence rather than wrong kills.** Separated, Shara
   reads 25 not_looked for that week on a genuine 24.51-hour blind spot
   (14 Aug 23:59 → 16 Aug 00:30). Pooled, she borrows Avenrae's coverage and
   those cells become "open". Wrong kills would be easier to spot than this.

**And you have data we cannot see**: three roster rows dated 18–19 Aug for
Avenrae have no counterpart in any log we hold. Clearance: a roster-boss slain
line stamped Tue 18 or Wed 19 Aug returns 0 across all 15 files.

---

#### I had been reading stale logs

The archives under `state/logs/` end **17 Aug**. The live file is at
`<install>\Logs\eqlog_Avenrae_rivervale.txt`, 36 MB, covering **19–22 Aug**.
`capture.js` reads the live file plus the archives; every earlier analysis of
mine used the archives alone and was blind to the last five days.

---

#### The before-capture is taken, and it is honest rather than pretty

`captures/before.txt`, committed. **Avenrae reads 25 not_looked** on one hole:

```
  period       : since Tuesday 2026-08-18  (reset hour NOT RECORDED)
  coverage     : 2026-08-09 15:11:05 .. 2026-08-22 23:07:43
  spans period : false
     HOLE      : 2026-08-18 00:00:00 .. 2026-08-19 12:36:33  (36.61 h unobserved)
```

That is the very window the owner says logging was off. The empty state is the
tool refusing to guess about 36 hours it cannot see, with the owner independently
naming the cause — which is a better demonstration of the four states than a
green cell would have been.

**Also relevant to tonight, given correction 2 above:** the Innoruuk raid will
produce a weekly task line **only if it is among the owner's first three raids
this week.** If it is the fourth, there will be no task and no token, and that
absence means nothing about lockouts.

---

#### What the after-capture needs

```
node capture.js after
```

It diffs against the committed `before`, printing which cells changed and the
exact new kill lines with zone and tier.

**Read this before expecting a green cell.** On Avenrae the 36.61-hour hole still
sits across the boundary Tuesday, so cells stay `not_looked` and the diff will
show the new kill **without** flipping one to `completed`. That is correct and I
will not fake around it. The honest demo is the NEW KILL line appearing with its
shape and tier, beside the hole that stops us claiming more.

**If a cell must go green tonight, the raid needs to be on a character whose log
covers Tue 18 Aug onward.** Yours to decide; I have asked the owner for nothing.

---

#### One correction to your tasking, and one to mine

- **Filenames are rotation-END dates, not content dates.** The Sat 15 Aug
  18:02:54 Innoruuk kill lives in `..._2026-08-17.txt`.
- **History settles the shape question further than either of us said.**
  `You have entered The Plane of Hate 4 (Refined).` — the bare raid shape —
  occurs 7 times and has never once produced an Innoruuk kill, while all six
  Innoruuk kills are `- Group N`. Tonight does not resolve a coin-flip; it tests
  **whether a bare-shape Innoruuk kill is possible at all.**

---

### Fourth report, 23 Aug 2026 — the grid is built, and the corpus found three more defects

**Everything ordered is done.** Branch `session-d/grid`, PR open against `main`.
**59 tests green** (was 38). `node demo.js` is one command, no dependencies.

**And replaying the real corpus caught three defects, one of which had already
silently eaten a real completion.**

---

#### The grid

25 cells, five bosses by five tiers, **keyed on the game's string with the
owner's wording as a display label only**. Open cells lead and the count of them
is the first line, because the owner's reason is the design:

> "we humans experience our own form of compression drift, and only remember
>  that we've done some of those raids, not precisely which ones."

Four states, and `not_looked` never renders as `available`: a fresh install
prints **0 open, not 25**, and says so in words. There is no countdown.

#### The three name traps — and the substring hazard is worse than "imprecise"

All three confirmed against real client output, not just against our derived
JSON. `Innoruuk, the Prince of Hate`. `Cazic-Thule`, hyphenated.

**The Innoruuk trap is inverted, not merely noisy.**
`grep -F "Innoruuk has been slain by"` returns **73 hits and not one is the
boss** — 68 `Cleric of Innoruuk`, 4 `A Sage of Innoruuk`, 1 `A Knight of
Innoruuk`. The real boss scores **zero** on that search, because
`Innoruuk, the Prince of Hate has been slain by` does not contain the substring.
So a naive roster produces 73 false positives *and* misses every real kill. Add
`Innoruuk\`s Chosen` (49) and the row is noise.

Two more of the same shape: `Cazic` matches `Cazic Cenobite`, and `Nagafen`
matches both `A priest of Nagafen` and `a priest of Nagafen` — differing only in
leading case, a second trap for case-insensitive matching.

`Cazic Thule` unhyphenated **does** occur, 14 times — all player chat and one
achievement name. Zero kill lines. The mob is hyphenated in 100% of combat lines.

The roster match is exact equality. `sources/raw/roster-evidence.json` is derived
from the corpus by `analysis/roster-evidence.js`, committed, and asserted by a
test: **a typo fails the build instead of rendering as an empty row forever.**

#### The Tuesday rule

One field, `RESET_RULE`, carrying value, `provenance: 'stated'`, the source
string, and the measured bracket it sits inside. **`hour` is `null`** — the owner
gave a day, not a time, and inventing an hour to make the arithmetic tidy is the
fault this module refuses. The no-constant test is amended to fail on a reset
constant anywhere *except* that field. `projectReset` still runs as corroboration.

**One thing I added that you did not ask for, because the data forced it.** When
`now` falls on the boundary Tuesday itself, the period start is genuinely
ambiguous — we do not know whether the turnover has happened yet. My first
version silently assumed it had, and reported **"25 still open"** for Shara on a
Tuesday afternoon after a week of raiding. Safe direction, but an assumption
dressed as a fact. It now evaluates both hypotheses and marks the cell `unknown`
where they disagree.

---

#### Three defects the real corpus exposed

**1. A message about levitation was eating completions.** Verbatim:

```
[Mon Aug 10 18:05:40 2026] You have entered The Ruins of Old Paineel - Group 1 (Awakened).
[Mon Aug 10 18:05:40 2026] You have entered an area where levitation effects do not function.
[Mon Aug 10 18:11:22 2026] Master Yael has been slain by Cavity!
```

The notice parsed as a zone named *an area where levitation effects do not
function* — a bare name, therefore the open world — which cleared the instance,
so that Master Yael kill lost its difficulty and resolved no cell. **A real raid,
silently dropped.**

The fix reads the complete set from the client's own table rather than from what
we happened to see: `eqstr_us.txt` has exactly three entries beginning
`You have entered`, and the second is `You have entered an Arena (PvP) area.`,
which never occurred in our corpus and would have bitten identically.

**2. `dedupeKey` had no `kill` case**, so it fell through to `<second>|kill` and
two different bosses dying in the same second collapsed into one. Another lost
completion, in the direction a "do not forget a raid" tool must not fail.

**3. My own "~3× duplication" figure is wrong. Measured: 1.171×.** I generalised
a date-window observation — every kill line *on 9–10 Aug* appears three or four
times, which is true — to the whole corpus. It is in `docs/EVIDENCE.md` and I
have repeated it to you and to four agents. Corrected, and the correction says
whose error it was.

---

#### The grid that falls out of the real corpus

Both characters, separately, over all 434 MB:

```
  Avenrae — as of 2026-08-17 00:05:17
  4 still open · 13 uncertain    (8 of 25 done)

  boss            D0  D1  D2  D3  D4
  Lady Vox         ?   ?   ?   ?   ?
  Lord Nagafen     ?   ?   ?  ##  ##
  Master Yael      ?   ?   ?   ?   ?
  Innoruuk         .  ##   .  ##  ##
  Cazic Thule      .   .  ##  ##  ##
```

Shara's `now` lands **on** a boundary Tuesday, so hers is 2 open / 23 uncertain —
which is the ambiguity above working correctly rather than a failure.

**Attribution quality: 0 kills with no preceding zone-in, for either character.**
Median zone-in to kill 895 s (Avenrae) and 727 s (Shara), max ~45 minutes. "Most
recent zone-in" is a sound attribution rule on this data.

---

#### Where the grid contradicts what I measured — you asked me to say so

**Every one of the 55 roster-boss kill records in our corpus happened in a
`- Group N` instance. Zero in the bare `Zone N` shape. Zero in the open world.**

Your note says Innoruuk and Cazic-Thule are **raid instances**, not open world.
Our history contains no boss kill in the bare `Zone N` shape at all — for any of
the five, not just Innoruuk. So either the owner's "raid instance" means the
`- Group N` shape, or the shape we have never observed is the one the grid is
really about.

**I have not built around it.** The grid keeps the owner's 25 cells and records
the instance shape on every completion, so the question stays answerable the
moment Tuesday's capture settles it. It is on the list as the Group-vs-`Zone N`
question.

Related, and it constrains the same question: our corpus contains **no D0 kill
the game actually stated** for any of the five. The two D0 grants we hold came
from invites; the zone-in lines omitted the difficulty.

---

#### Tuesday 25 Aug — the list, unchanged in scope

`/dzlisttimers` first · the D2+ confound break · **does a kill in `- Group N` and
one in `Zone N` share a lock** · the Tuesday pair · the accented-character line.

---

### Third report, 22 Aug 2026 — the sweeps landed, and they are not flattering

**Four more defects in my own work, one of which inverts a claim I wrote for
Shara, and one of which is a clearance I asserted without searching.** All fixed,
all regression-tested. **38 tests green.** No measurement moved: brackets still
26.098 h and 26.056 h.

#### 1. THE LOGS ARE CRLF. I said LF, in the integration notes.

Every line of all 15 files ends `0D 0A`. `docs/EVIDENCE.md` said the exact
opposite, and so did the note written for Shara.

**How I got it wrong is the useful part: my hexdump was piped through `grep`,
which strips the file's line terminator and appends its own LF. I hexdumped my
instrument's output and read it as the file.** That is the fourth self-inflicted
measurement error on this project and the same shape as the other three.

Raw bytes, direct from the file this time: `... 2e 0d 0a 5b 53 75 6e ...`

**And it was a live bug, not just a wrong sentence.** The parser rejected any
CR-terminated line — and rejected it **silently**: `TS_RE` still matched, because
`.` matches CR, so the CR rode along inside the message and every anchored shape
regex failed on its `$`. The line was dropped, `dropped.unstamped` was *not*
incremented because the stamp parsed fine, and **the module would have reported
"no lockouts, ever" with a clean diagnostic.**

It never bit us only because `readline({crlfDelay: Infinity})` and Shara's
`split()` on a CRLF-or-LF pattern both strip CR first. **Luck, not design.**
A host that splits on a bare LF alone would have got a silent, total false
negative. Fixed, with a test that feeds the whole fixture CRLF-terminated and
requires identical state.

#### 2. My per-character evidence was refuted 3–0, and the disproof was in our logs

I wrote into the module header that the observation supports "per character, not
per account", hedged with "the logs do not say which".

**The logs say exactly which, and I had not searched.**

```
eqlog_Avenrae_rivervale.txt   Your total time entitled on this account is approximately 0 years, 12 days.
eqlog_Shara_rivervale_*.txt   Your total time entitled on this account is approximately 0 years, 9 days.
```

**Two different values, two different accounts.** So Avenrae and Shara each
getting their own grant says *nothing* about per-character versus per-account —
two accounts get two grants under either rule. The observation never had the
power to distinguish them.

**The hedge is the worse half.** "The logs do not say which" is a clearance
asserted without a string, which is the exact fault I have been enforcing on
everyone else all week.

CONTRACT 7 now says what is true: **per-character state is a claim about our
data, not about the game** — a log file belongs to one character, a tailer hops
between them, and merging fabricated a four-second bracket. Whether the *game*
scopes per character or per account is **not recorded**, and settling it needs
two characters on one account, which this corpus does not contain.

#### 3. The positive control proves less than I said

The Voidling answers every player who hails it, zone-wide. Measured: **123 of 195
closing lines have no first-person `danger` in the preceding five seconds**, and
only 35 of 63 own-`danger` says draw a same-second reply.

So the control proves **the channel is showing NPC dialogue**. It does **not**
prove the Voidling answered *me*. That is still exactly the control the design
needs — the hazard is a chat filter hiding system text, and any Voidling line
disproves that — but it is not evidence a given exchange completed, and I had
written it as though it were. Corrected in the module, the evidence ledger and
the Auras notes.

#### 4. A silent double-count above the dedupe horizon

`events` is capped at 5,000, so duplicate suppression only sees that far back.
Replay a longer stream and the old keys are gone: repeats are accepted as new and
**`dropped.duplicate` still reads 0**. Reachable in roughly four months at the
measured event rate.

Silent double-counting with a clean diagnostic is the worst failure this module
can have, so it is now a visible counter: `dropped.beyondDedupeHorizon`. The
observation is still recorded — discarding real data would be worse — but a host
can now see that idempotence is no longer promised and rebuild from the log.

#### One correction I am NOT accepting

The sweep reported that "every grant landed at D0 or D1" is wrong, on the grounds
that zero grants landed at a *stated* D0. **I checked, and the sweep read only
the zone-in line.** The game stated the difficulty in the invite, 37 and 32
seconds earlier for the same instance:

```
[Mon Aug 10 17:34:00 2026] ... join the instance: The Ruins of Old Paineel - Group 0 (Normal).
[Mon Aug 10 17:34:48 2026] You have entered The Ruins of Old Paineel - Group.
```

The claim stands. **But there is a real defect underneath it**, which the sweep
found by accident: the invite and the zone-in produce **two instance records for
one instance** — one at D0, one at null — inflating `instances` by 2 for Avenrae
and 3 for Shara. They are now flagged `difficultyStated: false` rather than
merged, because merging would be inference; `instances` is an upper bound on
distinct instances, and now says so.

#### Also done

`THRESHOLDS` is exported, so the five behaviour-changing constants are published
rather than hidden (Session C's constraint 5, the half I had not met). The typed
`440,214,858` byte total is out of the generated fixture header — a figure typed
into an artifact whose whole point is that it is generated. Stale "30 tests"
counts are gone from README and the verification appendix; a dated report may
keep its number, a live one may not.

---

### Second report, 22 Aug 2026

**Everything ordered is done, plus one thing I did not expect: writing the
contract down immediately broke the module, and that is the best outcome
available.**

**MERGED 22 Aug.** The owner merged PR #1; `main` is at `7543767` and carries all
of it. `session-d/phase-0` is merged and left in place as ordered; new work is on
`session-d/phase-2`. **37 tests green** (was 30). No measurement moved: brackets
still 26.098 h and 26.056 h.

**Three sweeps were still running when this was written and are not folded in
yet** — the typed-number fault class across the whole tree, an adversarial audit
of the module against all six constraints, and a full same-second ordering
inventory from the corpus. They are alive, not lost. **This section will be
updated with their results whether or not they are flattering**, and if any of
them contradicts something above, the correction lands here rather than in a
reply.

---

#### The contract caught a real bug within minutes of being written

You ordered Session C's clause 3 written into the module's contract rather than
only into the fix. I wrote all six clauses plus per-character, with **one test per
clause** — and **CONTRACT 6 failed on the first run.**

`voidling-reply` was exempt from dedupe. **I had documented that exemption as
deliberate and harmless**, in the very paragraph claiming idempotence. It was
neither: replaying a stream doubled the array, so the module was **not
idempotent** — aimed squarely at a host whose watcher can re-read a tail and whose
planned one-time backfill will overlap the live stream.

Voidling replies are now a **set of seconds**. Presence was all they were ever
for; the count carried no meaning, and a set is idempotent by construction.
Verified by diff rather than assertion: **replaying the entire 434 MB corpus now
changes exactly one key — `dropped.duplicate`**, the rejection counter doing its
job.

**The lesson is yours, not mine: this is the fourth defect on this project found
by writing a claim down precisely enough to test it.** Session C's constraint list
did not describe my module; it described what a module would have to be. Checking
against it found the gap. A prose assurance would not have.

---

#### Correction 4 — you were right that I was wrong, and then you retracted the wrong number

**I ran the join myself rather than take an agent's word, because this is a
correction to the record.** Both of us are wrong, in opposite directions.

**Mine, retracted:**
- *"A `(boss, date)` join cannot be done as specified"* — **WRONG.** It runs
  cleanly through the `mobs` dict keys, exactly as you said.
- *"0 of 213 fights land in exactly one session"* — **FLATLY WRONG.** 74 do.
- *"`measured.json` has no `boss` field"* — **upheld.** `grep -F '"boss"'` over
  `measured.json` returns 0; all 172 records carry a `mobs` dict instead.

**Yours, and this is the part worth having.** Measured, both ways:

| join | exactly one session | several | none | at least one |
|---|---|---|---|---|
| case-sensitive | 74 | 123 | 16 | **197** |
| case-insensitive | 79 | 132 | 2 | **211** |

**Your retraction ran backwards. 211 was the correct number and 197 is the
artifact.** The 14-fight gap is pure capitalisation: `raids-measured.json` stores
`a dracoliche` and `the Hand of Veeshan`, while `measured.json` upper-cases the
first letter of every `mobs` key. Only 2 of the 16 case-sensitive misses are
genuine. **You conceded 211 and retreated to 197, which is the worse figure.**

**But both numbers answer the wrong question, and this is the real correction to
the original ruling.** 197 and 211 count fights matching **at least one** session.
Neither is the count of fights pinned to a clock window — that is **79**. And the
original rescue promised *"sub-hour bounds … median 44 minutes."* Measured, the
single-match session window has **median 265 minutes** (290 case-insensitive),
min 8, max 290. **Not sub-hour. Four and a half hours.**

So the rescue exists, and it is roughly a third as broad and six times as coarse
as advertised. **Two fixes make it worth having**, if Session A ever wants fight
clocks on the raid pages:
- **Normalise case on both sides of the join**, or it silently drops 14 of 213.
- **Widen the key.** `boss + date + observers + difficulty` reaches **128 of 213**
  uniquely and collapses the residual candidate-window spread from a median of 31
  minutes to a median of 1. Both files already carry `difficulty`, and
  `observers` matches `character`.

**None of this touches the lockout work**, and I want to be explicit rather than
let a correction look like a setback: **fight timing was never the route to the
reset.** The task and hail lines carry their own second-resolution timestamps
directly. This is a Session A question about raid pages, not a Session D one.

**Two genuine misses are data defects, not join failures**, and somebody should
look: High Priest M\`kari on 12 Aug and Lord Nagafen on 10 Aug are recorded as
raid fights on dates where `measured.json` has no session listing that mob, and
both dates are inside its coverage.

---

#### The `grantsTotal` / `requestsGranted` discrepancy — resolved, and it was a naming trap

**Neither number is wrong. They count different things**, and the old names hid
that, so your reading was the fair one.

- `itemsGivenTotal` (was `grantsTotal`) — **every** `You have been given: <item>`
  line, any item.
- `requestsGranted` — only **cadence-labelled weekly task** grants.

Shara's 24 = 6 Void-Touched Potential + 9 Hamed's Ring of Tears + 9 Talisman of
Kejaar Kerrath, the last two from the **non-cadence repeatable tasks** she ran on
13 Aug. Avenrae never ran those, so his two figures coincide at 6 and 6 — **which
is exactly what made the pair look like a contradiction rather than two different
measurements.**

Renamed, and the reconciliation is written into `analysis/derive.js` where the
field is produced, so it is found by anyone who reads the number.

---

#### Correction 5 — applied, and the fault class swept

The typed `"27-hour bracket"` is gone from `lockoutCore.js`. **No width is quoted
there now at all**, because the honest fix is not to correct the number but to
stop carrying one: the widths live in `analysis/findings.json` and are
regenerated. The comment now says why, so the next person does not re-add it.

A sweep of the whole tree for the same fault class is running; I will report it
here rather than wait to be asked.

---

#### Repository, and Session C

**`main` pushed at `7ce49ac`** — the Phase 0/1 state you audited and accepted —
**and set as default.** This turn's work is on `session-d/phase-0` as
[PR #1](https://github.com/samusmylove47-maker/EQLSLockouts/pull/1). **I do not
merge it.**

**`docs/FOR-AURAS.md` has not been sent and will not be sent by me.** It now also
answers Session C's six constraints point by point, including the bug clause 6
found, since that bug was aimed at the exact watcher behaviour they flagged.

**Session C — it is ready and it is yours to carry.** The three findings that
matter are: scan the folder rather than the newest file (the two halves of our
only reset measurement live in *different files*), one engine per character, and
434 MB / 5,253,948 lines in 7.0 seconds so stream it rather than `readFileSync`.
Two of those three would produce a **wrong** answer rather than a missing one.

---

#### Tuesday 25 Aug

Protocol unchanged in scope and still costed at ten minutes, ordered by
value-per-minute: `/dzlisttimers` first, then the Voidling hail, then the Tuesday
pair, then the D2+ confound break if they are raiding anyway.

**Your accented-character test is added as step 1b** and costs five seconds:
`/say café — naïve “quotes” résumé`. Log bytes `C3 A9` for the `é` means the
client writes UTF-8; a lone `E9` means Windows-1252. That closes what the corpus
provably cannot, because its only non-ASCII content is the replacement character
itself.

**And the line holds:** the module ships no reset constant, and a test fails if
one is added.

---

### First report, 21 Aug 2026 — accepted, retained for the record

### How to read this from cloud, and what you cannot check

**I am local; you are not.** Everything I cite is one of three kinds, and I have
marked which, because the difference decides whether you can audit me.

**Kind 1 — you can read it.** Repo `samusmylove47-maker/EQLSLockouts`, branch
`session-d/phase-0`. All 14 files fetch 200 with non-trivial bodies, checked just
now, not assumed. Base:

```
https://raw.githubusercontent.com/samusmylove47-maker/EQLSLockouts/session-d/phase-0/
```

| file | what it is |
|---|---|
| `HANDOFF.md` | this |
| `README.md` | what the module is and how to run it |
| `docs/EVIDENCE.md` | every line shape, its provenance, every clearance with the exact string searched |
| `docs/CAPTURE-PROTOCOL.md` | the one sitting, ordered, with branches |
| `docs/FOR-AURAS.md` | integration notes — **written, not sent** |
| `src/lockoutCore.js` | the deliverable. Zero `require`s |
| `src/lockoutEngine.js` | optional adapter |
| `test/lockout.test.js` | the suite, all green — count not typed here, it goes stale |
| `analysis/findings.json` | **generated.** Every figure in this file is read out of it |
| `analysis/derive.js`, `hails.js`, `make-fixture.js`, `group-entries.js` | the scripts that produce it |
| `sources/raw/2026-08-10-weekly-task-fixture.log` | 87 lines, redacted, generated |

**One trap in this channel itself, found by checking my own push.**
`raw.githubusercontent.com` sits behind a CDN that caches for around five
minutes, and a `Cache-Control: no-cache` request header does not bypass it. I
fetched this file seconds after pushing the rewrite and got **HTTP 200 with the
previous version** — right status, right-looking size, wrong content. **A 200
that silently serves a stale file is the same failure family as the
everquestlegends.com soft-404 already in our record.** If you curl a handoff
immediately after a session says they have pushed, you may read the version
before the one they are telling you about.

The reliable check is the API, which is not edge-cached the same way:

```
gh api repos/samusmylove47-maker/EQLSLockouts/contents/HANDOFF.md?ref=session-d/phase-0 --jq .size
```

then compare that size against what the raw URL gives you; if they differ, the
raw copy is stale and you should wait rather than reason about it.

**I first wrote the current commit SHA here as the thing to compare against, and
the commit that added the line changed the SHA, so it was wrong the instant it
was written.** That is "derive, never type" catching me inside a paragraph about
verification. There is no fixed SHA to quote — ask `gh api` for it, or take it
from whatever the session tells you in its reply.

**Kind 2 — I read it, you cannot, and no amount of good faith fixes that.**

- **The raw logs.** 15 files, 434 MB, on this machine. Gitignored and they stay
  that way — they carry private guild chat. **This is the source of nearly every
  claim below and you have no independent access to it.**
- **The game install**, `C:\Users\Public\Daybreak Game Company\Installed Games\EverQuest Legends` — including the client string tables.
- **Shara's application tree**, `C:\Users\Lindsey\EQ tracker`.

**What stands in for Kind 2:** the committed fixture, which is generated by
`analysis/make-fixture.js` from the raw logs with private lines **dropped whole,
never rewritten**, and every drop counted in its own header. It carries both
outcomes of the lockout signal. It is 87 lines and you should read it first —
it is the shortest path to checking whether I am telling the truth.

**The honest limit:** the fixture is a window I chose. If you want a different
window, name it and I will regenerate. That is the only audit route you have and
I would rather say so than let the URL list imply more than it delivers.

**Kind 3 — third-party, you can reach it yourself.**
`github.com/jmoyers/everquest-companion`, read 21 Aug 2026.

---

### The headline

**The grep found it. The module is built, tested and complete. The reset is now
measured to a 26-hour bracket from log history alone, and the daily model is
refuted by measurement.** And there is a lockout detector that nobody else has,
which carries its own positive control.

**Twelve things in the brief and in your own rulings are wrong.** Several are
load-bearing; one would have made me report a false negative on the first grep.

---

### 1. What the log grep found

`state/logs/` exists and holds 8 logs. **7 more are on the Desktop one level up
and were never mentioned in any brief.** Combined: **15 files, 433,914,867 bytes,
5,253,948 lines**, 04–18 Aug 2026, two characters — Avenrae and Shara, boxed on
one machine.

**Only 11 of the 15 hold unique content.** Two are byte-identical across the two
directories, one is a byte-prefix of another, and that one is a byte-prefix of a
third. **Raw grep counts over-count events by about 3×.** Anyone quoting a number
off a plain `grep -c` over that corpus is quoting a wrong number. Everything below
is de-duplicated by the module.

**The weekly task line is present**, 12 grants and 12 token awards, 6 of each per
character.

**But the mechanism is not what the brief says, and the difference is the entire
product.** The task is not granted "on the kill". It is granted by a dialogue
tree on an NPC called **Voidling** in the static parent zone, 15–25 seconds
*before* the instance is entered. The kill only credits it.

**The lockout signal is the absence of a grant at hail time.** Same player, same
NPC, 51 minutes apart:

```
[Mon Aug 10 17:14:47 2026] You say, 'Hail, voidling'
[Mon Aug 10 17:14:48 2026] Voidling says, 'Ah, another who thinks themselves a Legend. ... the [danger]...'
[Mon Aug 10 17:14:49 2026] You say, 'danger'
[Mon Aug 10 17:14:49 2026] You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
[Mon Aug 10 17:14:49 2026] Voidling says, 'Your hubris risks our very reality itself.'
```
```
[Mon Aug 10 18:05:16 2026] You say, 'Hail, voidling'
[Mon Aug 10 18:05:16 2026] Voidling says, 'Ah, another who thinks themselves a Legend. ... the [danger]...'
[Mon Aug 10 18:05:17 2026] You say, 'danger'
[Mon Aug 10 18:05:18 2026] Voidling says, 'Your hubris risks our very reality itself.'
```

**Identical but for the task line. When you are locked out the game says nothing
at all.** No refusal, no timer, no lockout line anywhere in 434 MB. `grep -i`
returns 104 `lockout` and 32 `locked out` hits — raw, duplicate-inflated — and
**every one is player chat; filtering the chat verbs leaves zero system lines.**
Players ask each other how to check lockouts and one answers "press alt+z": the
state lives in a UI window that never writes to the log.

**Why silence is trustworthy here, uniquely in this project:** the Voidling's
closing line fires on **both** outcomes. It is a positive control built into the
mechanic, free, already in every log we hold. **A real lockout and a filtered
capture are distinguishable.** The module returns `unknown`, never `refused`,
when no Voidling line sits in the control window, and a test is named for it.

Classified across the corpus: **Avenrae 6 granted / 22 refused / 0 unknown.
Shara 6 granted / 20 refused / 0 unknown.**

Both exchanges above are in the committed fixture. Verify me there.

---

### 2. The reset, measured from history alone

Two characters, independently, from separate log files:

| character | old period still in force at | new period in force by | width |
|---|---|---|---|
| Avenrae | 2026-08-10 18:34:52 | 2026-08-11 20:40:44 | 26.098 h |
| Shara | 2026-08-10 18:34:14 | 2026-08-11 20:37:37 | 26.056 h |

**Clock: Eastern, UTC−04:00 in August**, read off the OS on this machine, not
asked for and not guessed. Pacific is −3 h, so: **Mon 10 Aug 15:34 → Tue 11 Aug
17:37 PDT.**

**The lower bound is a REFUSED hail, not a completion.** That is a direct
observation that the old period was still running at that instant, and — this
matters for your record — **it does not depend on the 3-per-week cap at all.**
See correction 5, where the cap turns out not to carry the weight two separate
arguments placed on it.

**A floor on the period, also measured.** Last weekly granted Tue 11 Aug 22:38,
still refused **Sun 16 Aug 22:20 (Avenrae, ≥4.99 d)** and **Mon 17 Aug 17:25
(Shara, ≥5.78 d)**, Voidling present as control, no grant in between. **Any cycle
of 24 hours, or of anything up to 5.78 days, is refuted by measurement.** That
exclusion is ours and it is publishable as a measurement if you want it.

**What the bracket cannot do:** 26 hours spans parts of Monday and Tuesday. It
does not distinguish a Tuesday-morning reset from a Monday-evening one, and I
will not let it pretend to.

**Tier 5, flagged rather than leaned on.** In our own log, on the day, inside the
bracket:

```
[Tue Aug 11 19:20:40 2026] Lethality tells General:1, 'when does the weekly Void-Touched Potential reset?'
[Tue Aug 11 19:20:50 2026] Solteris tells General:1, 'tuesdays'
[Tue Aug 11 19:20:52 2026] Anyabelle tells General:1, 'Tuesday would be my guess'
[Tue Aug 11 19:20:58 2026] Duaa tells General:1, 'like 8 hours ago'
[Tue Aug 11 19:21:00 2026] Rybar tells General:1, 'Today at 8AM'
```

"8 hours ago" from 19:21 Eastern is ~08:21 Pacific; "8AM" agrees **only** under a
Pacific reading. Internally consistent, inside our bracket, and matching jmoyers'
`LOCKOUT_RESET_WEEKDAY = 2` / `LOCKOUT_RESET_HOUR = 8`.

**Do not read that as four sources converging.** One speaker says "my guess", and
this chat is plausibly the *origin* of jmoyers' constant, which he himself marks
`SINGLE-SOURCED … VERIFY IN GAME`. **It may be one rumour wearing four hats.**
Nothing about the reset rule publishes on it.

---

### 3. The capture protocol, and the answer on play time

`docs/CAPTURE-PROTOCOL.md`. **About ten minutes, once** — far smaller than the
seven-task Phase 0, because the logs answered most of it.

**The owner asked directly on 21 Aug whether the measurements are needed to
progress. My answer: no. Nothing is blocked.** The module is complete *because*
it reports a bracket rather than a value — the missing number is one it correctly
declines to invent, not a hole. **I told them not to make a special trip**, and
ordered it by value per minute if they are logging in anyway:

1. **`/dzlisttimers`** — ten seconds, highest payoff-per-second in the project.
2. **The D2+ confound break** — free while raiding, settles a real ambiguity the
   corpus cannot (correction 11).
3. **The Tuesday pair** — the only time-locked item. Next Tuesday is **25 Aug**.

The owner has said they will take the measurements and report Tuesday.

---

### 4. Shara, and what she said back

**I did not have to speculate about integration. Her app is on this machine** —
live tree `C:\Users\Lindsey\EQ tracker`, remote `LoxyBee/EQLS-Auras`, branch
`feat/eql-roster-and-backlog`, clean, modified 21 Aug. I read it. **I copied
nothing from it.**

**What already fits:** zero runtime dependencies confirmed (no `dependencies` key
at all); CommonJS; her engines take the **raw** line and call `stripTimestamp`
internally, so `handleLine(line)` is signature-identical to
`BuffEngine.handleLine`; her engines are `EventEmitter`s with injected
dependencies, which my adapter matches; and `logWatcher` reads `utf8`, which
correction 3 says is right.

**Shara replied, relayed by the owner, 21 Aug:** *"my log parser is set up to be
last line only, but it was going to be a planned addition that the lockout timer
tracker have a button to do a one time scan by user request of the entire log to
check for timers."*

**That closes the integration concern I ranked highest, and she got there
independently before seeing any of this.** `handleLines()` is the bulk path and
it is pure, so her button owns the file reading entirely.

**`docs/FOR-AURAS.md` is written, NOT sent.** Anything offered to Shara is yours.
Three points, two of which would give a *wrong* answer rather than a missing one:

- **Scan the folder, not the newest file.** Measured: the two halves of our only
  reset measurement are in **different files** — three Mon 10 Aug grants in one
  log, three Tue 11 Aug re-grants in another. Scan one file and you find three
  grants of three *different* tasks, no repeat, and get a perfectly correct
  `not recorded` off half the evidence.
- **One engine per character.** A folder scan picks up every character, and her
  watcher already hops between them by mtime. Sharing state turned Avenrae's and
  Shara's grants — four seconds apart, because grouped — into a **four-second
  reset bracket** when I first ran it.
- **434 MB / 5,253,948 lines in 7.0 seconds**, so the button is a few seconds.
  Stream it; one of these files is 112 MB and `readFileSync` on it in the main
  process would spike and block.

Plus a latent multibyte-boundary defect in her tailer, offered as a gift: it
opens a fresh byte-offset stream with `encoding: 'utf8'` every 200 ms, so a
character straddling a poll boundary decodes to U+FFFD. Not biting today.

---

### 5. Repository — SUPERSEDED 22 Aug, see the second report

> **Stale as written.** `main` now exists at `7ce49ac` and is the default branch;
> PR #1 is open against it. The paragraph below saying no PR can be opened was
> true on 21 Aug and is not true now. Left in place rather than deleted, because
> the reasoning is what the ruling responded to.

`github.com/samusmylove47-maker/EQLSLockouts`, created by the owner. Pushed to
**`session-d/phase-0`**. Working tree clean, suite green. *(That said 30 on 21 Aug; a typed count in a dated report is fine, a typed count presented as current is not.)*

**I did not push `main`. But the repo was empty, and GitHub promotes the first
branch pushed to an empty repo to be the default — so `session-d/phase-0` is now
the default branch**, which is functionally what that restraint guards against
even though I never named `main`. I did not anticipate it and I am not leaving it
unsaid.

**No PR can be opened yet**, because a PR needs a base and `main` does not exist.
Rename the branch in the GitHub UI, or tell me to push `main` and I will open the
PR against it. I have done neither.

---

### 6. Corrections — twelve, several load-bearing

1. **The search string in my own brief is wrong.** It says grep
   `has been assigned the task`. The line is `You **have** been assigned the
   task`. That string returns **0** across all 15 logs. **Run the brief literally
   and you report that the signal is absent.** It is present 12 times. This is
   the clearance rule earning its keep on the first command of the session.

2. **P0-2 / P0-3 are NOT dead, and this is the biggest one.** The ruling was that
   `/dzlisttimers` is a live-EQ/EQEmu command Legends does not have. The
   installed client's own string table carries
   `3536 Usage: /dzListTimers - This command will list any outstanding replay
   timers you have for all expeditions.` A string table alone proves nothing — it
   is inherited Daybreak content (`voidling`, `Void-Touched`, `Potential of the
   Void` all return 0 in it). **But three strings from that same expedition block
   fire verbatim in our own logs**: the instance invite (3527, 83×), the
   expedition accept (3522), and decisively **a permission error** (3513):
   `You are not the expedition leader, only Ceriph can issue this command.`
   **Somebody typed a `/dz` command and the server answered.** And
   `grep -F "outstanding replay"` returns **0** — the one command that lists
   timers has never been run. Ten seconds, never spent.

3. **"Do not decode the log as UTF-8" is wrong.** Measured: exactly **9 bytes ≥
   0x80 in 434 MB**, all `EF BF BD` (U+FFFD), valid UTF-8; every cp1252 signature
   byte returns zero lines; line endings are LF. **UTF-8 is correct, the Sky
   Ledger's windows-1252 is wrong for these files, and Shara's `utf8` is right.**
   *Unsettled second layer:* U+FFFD is the residue of a decode that already lost
   a byte, so "the client originally emitted UTF-8" cannot be settled from a
   corpus whose only non-ASCII content is the replacement character. One line
   with a real accented character closes it.

4. **Your `(boss, date)` join cannot be done.** `assets/measured.json` has **no
   boss field** — there is nothing to join on. The rescue that was to recover
   sub-hour bounds for 211 of 213 fights does not exist as specified. *Your other
   two claims — `raidstats.py` dropping `start_ts`, and the `logstats.py` loot
   regex and merge guard — are UPHELD in full, line numbers and source text
   exact.*

5. **The 3-per-week cap cannot carry the inference two arguments rested on it.**
   Verbatim: *"a new token that can be earned up to 3 times per week from raid
   activities through voidlings."* **No scope word** — not per character, not per
   account, not per boss. "6 tokens across two days exceeds 3, therefore a reset"
   is not licensed. My adversarial pass refuted this and was right. **My bracket
   does not use the cap.**

6. **The task is granted at the Voidling, not on the kill.** A detector built
   around the kill misses the lockout signal entirely, because the signal lives
   in the *absence* of a grant at hail time.

7. **The instance grammar in the brief is incomplete.** It gives `- Solo` /
   `- Group N`. Measured across **68 distinct zone strings** there are **four**
   shapes: bare (open world), `- Group` **with no difficulty at all**,
   `- Group N (Label)`, and `Zone N (Label)` (raid). The bare `- Group` shape
   occurs 6× and a naive pattern files it as open world.

8. **`- Solo` does not occur.** Clearance: `grep -F " - Solo"` over the 68
   distinct zone strings → **0**. `raidstats.py:268` is still harmless.

9. **The D0–D4 claim you said to check, not adopt: checked, upheld, and from a
   better source than a community wiki.** The client's own invite line gives the
   complete map across 27 distinct instances with no conflicts: **0 Normal, 1
   Awakened, 2 Adaptive, 3 Fused, 4 Refined.** Tier M, ours, derived not typed.

10. **But "per boss per difficulty" looks wrong for the weekly task.** Once a
    boss's weekly was taken, group instances of that same boss at D1–D4 the same
    night granted nothing. The weekly looks **per boss**. The loot lockout may
    still be a different object from the weekly task and I am not merging them.

11. **And I cannot finish that thought, so I am naming the gap.** Every grant we
    hold landed at **D0 or D1**; every no-grant at higher difficulty happened
    *after* the weekly was taken. **"Difficulty too high" and "already locked
    out" are perfectly confounded in our data.** Protocol step 4 breaks it in one
    raid.

12. **Coverage is 04–18 Aug, not "nineteen days".** Avenrae 09–17, Shara 04–18,
    with real gaps. **Tue 18 Aug — the predicted next reset — is covered
    00:00–15:47 and contains no task line**, but they raided Castle of Mistmoore
    rather than a Voidling target, so it carries **no information**. Worth
    knowing before someone reads that silence as a refutation.

---

### 7. What this means for the other sessions — yours to route, I have contacted nobody

- **Session A.** Correction 3 contradicts a standing ruling that these logs are
  Windows-1252; if any site copy or tooling says so, it is wrong. Correction 9
  gives a Tier M difficulty table the site does not have. Corrections 7 and 8
  bear on how instanced and open-world fights are bucketed — **90 of 98 D0 raid
  fights being bare "The Plane of Sky" is two populations in one bucket**, and
  that is a site-data question, not mine. **I have handed nothing to A.**
- **Session C.** Their handoff is dated 18 Aug, still reads *"Standing by for the
  archive, the plan and her prompt"*, and **says nothing about the lockout
  commission** — while Shara has now answered a technical design question about
  it directly. The channel they describe is not the channel that is running.
- **Session B.** Nothing from me.
- **jmoyers.** Read-only, nothing of his in this tree, cited nowhere above Tier 3
  and never as corroboration of the reset rule. Credit — *Josh Moyers (jmoyers)*,
  the two fixture paths, read 21 Aug 2026 — is in the README, the evidence ledger
  and the module header. He is the reason we knew a weekly task line existed.

---

### 8. Reserved to you — I have done none of it

Nothing published to eqlsource.com. Nothing offered to Shara —
`docs/FOR-AURAS.md` is written and sitting still. No public release. **No claim
made about the reset rule**: the module ships no reset constant anywhere and a
test fails if one is ever added.

---

### 9. Method — my own instrument lied three times

**All three were caught only by running against the real corpus rather than the
fixture, and all three are now regression-tested.**

- Merging two characters produced a **4-second "reset bracket"**.
- Terminating the hail exchange on the Voidling's closing line produced a **false
  0.474-hour bracket**, because the closing line can arrive *before* the task
  line:
  ```
  [Tue Aug 11 20:40:44 2026] You say, 'danger'
  [Tue Aug 11 20:40:44 2026] Voidling says, 'Your hubris risks our very reality itself.'
  [Tue Aug 11 20:40:44 2026] You have been assigned the task '... Lady Vox - Weekly'.
  ```
- The fix then over-tightened into a **9-second bracket**, because a refusal
  **does not name a boss** and I let refusals count after the new period had
  demonstrably started.

Three self-inflicted false measurements in one session. **The lesson is the one
this project keeps relearning: a detector that has only been run on a fixture has
not been run.** `analysis/group-entries.js` is left in the tree marked
SUPERSEDED, with its own wrong premise written at the top, because the anomaly it
reported is what found the real mechanism.

---

### Verification appendix — how to check me from cloud

1. Read the **87-line fixture** first. Both outcomes of the signal are in it.
2. `analysis/findings.json` holds every figure quoted here. If a number in this
   file is not in that one, I typed it and you should challenge it.
3. `test/lockout.test.js` — run it rather than trust a count here. `NO RESET DAY IS EVER EMITTED` and
   `A FILTERED CHANNEL YIELDS unknown, NEVER a false lockout` are the two that
   encode the doctrine.
4. **Zero-`require` check — use `grep -n 'require *(' src/lockoutCore.js`, which
   returns nothing.** Do *not* use `grep -c require`: it returns **3**, because
   the word appears three times in the prose comments explaining the rule. I
   wrote the wrong command into this appendix first and caught it by running it.
   A check that reports a violation it cannot distinguish from documentation is
   worse than no check, and you would have been right to challenge me on the 3.
5. **What you cannot check: the raw logs.** Name a window and I will regenerate
   the fixture over it.

*Session D, 2026-08-21.*
