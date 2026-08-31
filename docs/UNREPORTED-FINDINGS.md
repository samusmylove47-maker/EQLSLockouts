# What this repository knows that nobody has asked for

**Part 1 of the 31 Aug assignment.** Facts and measurements, not proposals.
Every item is cited to a file and a line and was read from the source tonight.
Each says who it would change; anything that changes nobody is left out.

Ordered by who it blocks soonest. **C ships Tuesday, so C's items are first.**

---

## 1. The reset HOUR is unmeasured — and the day it arrives, it is a one-line change

`src/lockoutCore.js:896` — `RESET_RULE` is frozen with:

```js
weekday: 2,              // Tuesday
hour: null,              // not recorded
provenance: 'stated',    // NOT 'measured'. We did not observe this.
source: 'owner, first-hand, 23 Aug 2026',
```

**`provenance: 'stated'` is doing real work and is easy to miss.** The weekday
came from the owner saying so, not from us seeing it. Our own measurement sits
beside it — `measuredBracketPacific: 'Mon 10 Aug 15:34 → Tue 11 Aug 17:37 2026'`
— and the bracket *contains* a Tuesday, which is consistency, not confirmation.

**WHO IT CHANGES — C.** Anything rendering a reset time, a countdown, or a
"resets in N hours" is rendering a number we do not have. The module reports
`period.hourKnown: false` (`:2313`) and `periodStartedAt: null` precisely so a
host cannot accidentally draw one.

**And the useful half, which I would not have known without checking tonight:
the dormant path is not dead code and is not untested.** `test/grid.test.js:1365`
drives it as a matched pair — the real module with `hour: null`, then a fresh
module instance with the constant replaced by `hour: 12` — and asserts:

| | `hour: null` (as shipped) | `hour: 12` |
|---|---|---|
| `period.hourKnown` | `false` | `true` |
| `period.periodStartedAt` | `null` | `2026-08-18 12:00:00` |
| `conditionalCount` | `>= 2` | **`0`** |

**So the cost of the hour arriving is editing one constant, and `conditional`
disappears entirely** — that whole cell state exists only to carry this
ambiguity. C can plan on that rather than on a rewrite.

*Recorded honestly: I went looking for this expecting to find an untested guard
and report myself for it. It is tested, with a pair. Session C found the
original miss — for eleven days `RESET_RULE.hour` had **zero uses** in the
module, so a perfect hour handed over would have changed not one cell.*

### C's correction, and it lowers my estimate

**C reports the cost is lower than I quoted: on Shara's side the constant is
already a parameter** — the hour is a user-editable setting wired through
`lockoutService` to the grid. My "edit one constant" is the cost *in this
repository*; downstream it is already zero. Corrected rather than defended.

### And the part of C's note that matters more than the cost

**C enumerated all 18 occurrences of `conditional` in Shara's core rather than
grepping for the two it expected, and found that her app cannot produce a
`conditional` cell at all.** Her host always passes `boundaryCivil`, and her
`hourKnown` is `!!opts.boundaryCivil || hour !== null` — so it is always true,
the boundary-day window collapses to zero width, and both assignment sites are
dead. **There is a complete UI for the state — amber cell, "depends" label,
summary count, and a tooltip reading "the reset hour, which has never been
measured" — that nothing can reach.**

**This is a divergence between her core and mine, and it is worth naming as
one.** In this module `hourKnown` is computed from `RESET_RULE.hour` alone
(`src/lockoutCore.js:1940`) and there is no `opts.boundaryCivil` — that disjunct
exists only downstream. So the state I built to *express* an unmeasured hour is
suppressed by a host that supplies a default instead.

**C is right that this is not a defect**, and I am not going to upgrade it into
one from a tree I have not read. It follows from a deliberate choice to give the
user an editable default rather than inherit the core's refusal to invent one.
Whether to drop the dead UI or let the host pass `null` is C's and Shara's, C has
filed it low priority and explicitly not for Tuesday, and I agree with that
placement.

**What I take from it for my own side:** a downstream host can neutralise a
refusal state without touching the engine, and the engine cannot tell. That is
worth knowing about anything I build to express uncertainty.

*C also recorded, unprompted, that the runtime probe it wrote to demonstrate this
**could not produce a `conditional` cell in any configuration, including the leg
where one should appear** — and said so rather than leaning on the source read
while implying the probe had run. A probe that cannot produce the thing it is
looking for establishes nothing about its absence. That is the same fault as my
auditor that could not return YES, self-caught and self-published in a third
repository before anyone asked.*

---

## 2. The lockout anchor is not in the log, and no amount of kill data will ever say so

`src/lockoutCore.js:1003`, `LOCKOUT_MODEL.inferenceHazard`, verbatim:

> **IF A FUTURE VERSION INFERS LOCKOUT EXPIRY FROM KILL TIMESTAMPS, NO VOLUME OF
> KILL DATA WILL EVER REVEAL THE ERROR.** 14 locks earned across 6,133 seconds of
> kills showed ONE value with zero spread; per-kill stamping would have shown 14
> values spread over 1h42m.

**WHO IT CHANGES — E, directly and now.** E's engine is built on joining and
differencing timestamps, and E has just made itself *more* dependent on exact
per-event joins. This is the one place where that instinct is actively wrong:
the lock is **not stamped at the kill**. Fourteen locks, nearly two hours of
kills, one value, zero spread.

The failure mode is the reason it is written in capitals — it is
**unfalsifiable from the inside.** More kills produce more agreement, because
they all read the same single value. A model that infers expiry from kill times
gets *more confident* as it gets more wrong.

`anchorEvent` stays `null` until something measures it (`:1009`), and the
comment below it records that an earlier revision of mine overstated even this:
the anchor was derived from an assumed elapsed time then matched to a salient
log line, which is one free parameter fitted to itself.

---

## 3. State is per-CHARACTER, not per-account, and it is measured

`src/lockoutCore.js:1166`. A log file belongs to one character
(`eqlog_<Character>_<server>.txt`) and a task is granted to a character, not an
account. From our own corpus, two grouped characters receiving the same weekly
**four seconds apart**:

```
[Mon Aug 10 17:14:49 2026] ... 'Potential of the Void - Lord Nagafen - Weekly'.   (Avenrae)
[Mon Aug 10 17:14:53 2026] ... 'Potential of the Void - Lord Nagafen - Weekly'.   (Shara)
```

**WHO IT CHANGES — C.** `createState(character)` takes a character for a reason.
A host that persists one state per *install* or per *account* will merge two
characters' lockouts and report raids complete that the second character has not
done. `STATE_VERSION` is `1` (`:1166`); there is no migration path yet, so the
key choice made on Tuesday is the one C lives with.

---

## 4. `- Solo` is modelled as nothing, on zero observations — and Solo locks demonstrably exist

`src/lockoutCore.js:434`. Bare `- Group` is treated as difficulty 0, carried as
`difficultyFromOmission` (`:480`), because the convention was measured — 12
invites, 12 bare entries, 0 index-0 entry lines.

**`- Solo` deliberately does not get that rule.** `grep -a -- " - Solo"` over all
16 files returns **0** on every one. Extending the convention would be inventing
a number.

**And the part that matters: the owner's alt+Z window shows a `Solo 3` lock**
(`:439`). So Solo instances exist, they lock, and this module models none of
them.

**WHO IT CHANGES — C and A.** Any "what is left this week" total is computed over
a surface we know to be incomplete. That is not a bug — it is an honest gap —
but a UI that presents the total as *the* total is asserting something the
engine does not. The engine can tell you it has never seen a Solo instance; it
cannot tell you there are none.

---

## 5. `alsoDies` is measured, inert, and one line from changing every grid

`src/lockoutCore.js:749`. Two lists that are not the same list:

- **`bosses`** — completion keys. Killing one marks the cell done.
- **`alsoDies`** — measured to die on nearly every group visit, and **not used to
  complete anything.**

Measured, and one of these nobody had named before we looked:

| zone | `alsoDies` | evidence |
|---|---|---|
| Nagafen's Lair | King Tranix, Magus Rokyl, Warlord Skarlon | 14/15, 14/15, 12/15 |
| The Permafrost Caverns | A priest of Nagafen, + 2 | **12/12, exactly once — carries Lady Vox's exact signature** |
| The Ruins of Old Paineel | *(none)* | Master Yael 25/25; genuinely single-boss |

*A priest of Nagafen* was hidden by its leading article, the same way *a
dracoliche* was.

**WHO IT CHANGES — the Director, and then C.** Promoting `alsoDies` to `bosses`
is a one-line change (`:767`) **and it can only fail in the dangerous
direction.** Lord Nagafen already dies on every visit where Tranix does, so
promotion buys nothing — except in the one case it changes: a group that kills
Tranix and then **wipes on Nagafen** would be told the raid is done and would
miss it. That is exactly the failure this tool exists to prevent.

It stays recorded, named in the tooltip, and inert until the shared-lock
question is settled by an alt+Z reading. **This is a decision waiting on a
ruling, not on work.**

---

## 6. DST — inert on our corpus, and I can now say by how much

`src/lockoutCore.js:CAVEAT_DST`: log stamps carry no timezone, so an interval
spanning a daylight-saving transition is wrong by the size of the shift.

**Measured tonight rather than left as a caveat.** Across the four Desktop logs,
749,233 stamped lines:

```
earliest stamp   2026-08-19 00:00:07
latest stamp     2026-08-29 23:34:57
span             10.98 days
```

**No DST transition falls inside it.** US transitions in 2026 are in March and
November, so every interval E computes on this corpus is currently unaffected.

**WHO IT CHANGES — E.** E's DPS windows, ability-lane uptime and cooldown gaps
are all interval arithmetic. The hazard is inert *today* and becomes live the
moment anyone runs the engine over a log spanning early November — with no error,
no warning, and an interval wrong by exactly one hour.

---

## 7. Unstamped lines are real, rare, and not a symptom

`parseLine` returns `null` for an unstamped line, and that is a normal case, not
a failure. Measured across all four logs:

```
lines       749,255
stamped     749,233
UNSTAMPED        22   (0.003%)
empty             0
```

All 22 begin with a letter, and **none contains an inner timestamp** — so none is
a truncated or interleaved stamped line. They are genuine unstamped text
(multi-line lore, and lines caught mid-write).

**WHO IT CHANGES — E.** A `null` from `parseLine` at a rate of 3 per 100,000 is
the expected floor, not a parser problem to chase. Equally, a host that alarms
on `dropped.unstamped > 0` will alarm on every real log.

---

## 8. On the Director placing the windows-1252 fallback in `PARSER-INTERFACE.md §7`

The order tells A that A decodes and that the fallback "belongs in D's
`PARSER-INTERFACE.md` §7".

**Agreed on substance, and one correction on placement.** §7 is the section that
says the fallback **does not exist and where it would have to live** — it is a
statement about an absence, not a container for an implementation. A document
section cannot hold a decoder.

**The fallback belongs in whatever code opens the file** — for A, the build-time
loader; for C, the Electron reader. `lockoutCore.js` takes strings and never
sees a byte (zero `require`, no `fs`, no `Buffer`), so it structurally cannot
host one, and putting it there would mean giving the engine an IO surface it has
deliberately never had.

**A is right that A decodes.** §7 is where the requirement is *recorded*, and it
should stay a requirement rather than become an owner.

**A specified the fallback for the first time** in `eql-source`
`claude/bundle-contract` §4, under the commit subject *"there is no
windows-1252 fallback to relocate"* — so the clause has now been refuted in two
consecutive orders, the second time without my involvement.

*Attribution, stated precisely because A asked me to shrink its own credit and
the accurate split is neither party's generosity: the finding that no such
fallback exists is mine, measured repo-wide over EQLSLockouts. A measured the
same absence over `eql-source`, which is a different tree and a real second
measurement rather than a re-derivation of mine. **The four-word phrasing is
A's and it is better than mine** — "nothing to relocate" says in four words what
I had written as a paragraph about sections not being containers. Phrasing A's,
each measurement its own author's, and the browser half below is entirely A's.*

**A also found the half I did not have, and I reproduced it rather than citing
it.** My measurement was that Node substitutes U+FFFD silently. A measured the
browser:

```
Buffer.toString('utf8')                     "[Tue ��]"   no throw
TextDecoder('utf-8')            (default)   "[Tue ��]"   no throw
TextDecoder('utf-8', {fatal:true})          THROWS  TypeError
TextDecoder('windows-1252')                 "[Tue “”]"   RECOVERS
CONTROL — valid UTF-8 under {fatal:true}    "[Tue ok]"   does NOT throw
```

**The control is the part that matters and it is why this is a real fix rather
than a hope.** `{fatal:true}` returns *both* of its answers — it throws on the
bad input and passes the good one. It is a detector with a matched pair, which
is exactly the property my self-containment auditor lacked when it could not
return YES.

So the seam divides cleanly: **my survey establishes the exposure is zero in this
corpus; A's establishes the host can detect and recover if it ever is not.**
Neither of us asserted anything about the other's side. A's contract commits to
reporting which decode path was taken, on the grounds that a silent recovery is
how the original fault hid — which is correct and is the same reasoning as the
`dropped.*` counters in this module.

### And the ordering constraint, which A measured after I raised it as a question

I flagged — as a question about A's side, not a claim — that `{fatal:true}` must
be the **first** decode rather than a validation pass after a lossy one. A
measured it:

```
raw cp1252 bytes -> TextDecoder('utf-8')          "[Tue ??]"   no throw
                 -> re-encode, then {fatal:true}   PASSES
                    while two U+FFFD remain in the data
```

**A correct detector applied one step too late stops detecting and reports
success.** That is now a stated constraint in the contract rather than something
implied by the order of a numbered list — A's distinction, and the right one:
code that works is not the same as a contract someone else can implement.

**A's fourth step, which I did not propose and which closes the remaining gap:
count U+FFFD in the result and report it on both paths.** Neither decoder can
catch a file that already contains U+FFFD as legitimate bytes — E's six — because
at the byte level that input is clean. Counting is the only honest instrument
left there.

*Already implemented on this side, which neither of us noticed:*
`analysis/name-encoding-scan.js` counts baked `EF BF BD` byte triples separately
from decoded U+FFFD, for exactly that reason. **Two sessions arrived at the same
instrument from opposite ends of the seam within an hour, without either knowing
the other had it.**

---

## 9. Things that make me look bad, which is the point

Per the assignment. All of these are mine and all are in the record already;
collecting them because the pattern is more useful than any one of them.

- **My self-containment auditor could not return YES.** It returned a clean NO
  for any page carrying a local stylesheet, so its NO meant nothing — and it was
  the instrument I had used to verify my own build. Session C found it (`95acd2f`).
- **My build test was a positive with no pair.** The real bundle passed; so did
  the real bundle with an empty list, and so did an *empty document* with a real
  list. Three passes, no discrimination.
- **`not_looked` was defeatable in seven lines, and my own `heartbeat()` was that
  input.** The helper I wrote to make tests realistic was the thing that flipped
  a whole week out of the honest state.
- **A prose countdown test that walked a fixture of 25 `not_looked` cells** and
  asserted none of them showed a countdown. Vacuous: none of them could have.
- **Coverage had two definitions** and `projectGrid` read both — `spans` for the
  gate, `firstSeen` for the reported value. A log of pure combat extended one and
  not the other. Fixed at `applyLine`'s top (`src/lockoutCore.js:1294`), from one
  rule.
- **Tonight: five measurements, all held. Five mechanism claims, four wrong.**
  The legacy-alias reading, my endorsement of C's rename mechanism which I routed
  to the Director *without testing*, my EQLSLockouts argument which rested on my
  own memory, and the Anthropic-pair inference that creation dates establish
  birth branch. The measurements held because a control is a question you ask
  without knowing what you want the answer to be.
- **And one from an hour ago: I wrote "107 tests green" when it is 106.** I typed
  a number instead of deriving one, in the same message whose entire value was
  that every figure came off an instrument.

**The pattern, stated once:** every error above is an instrument that could not
return one of its two answers, or a claim made without one. Not one came from
carelessness about the domain.

---

# Part 2 — proposals, bounded so they can fail

Three, ranked. The assignment says three I would defend beat nine I thought of,
so the two I would defend least are named as such rather than padded in.

**None requires believing an unmeasured rule.** Every number below was measured
tonight and is reproducible from a script in this repository.

---

## Rank 1 — publish the bounds as HORIZONS, not as counts

**The fact it rests on.** `THRESHOLDS` exports `MAX_EVENTS: 5000`
(`src/lockoutCore.js:2484`) so a host can read its own ceiling. **But a count is
not a ceiling a host can act on** — nobody embedding this can tell whether 5,000
is a week or a decade, and the one thing they need to know is when it runs out.

Measured over the four Desktop logs, one character, 10.48 days of kills:

| | |
|---|---|
| kill events | 1,774 |
| mean per 7 days | 1,184 |
| **peak in any 7-day window** | **1,185** |
| **`MAX_EVENTS = 5000` therefore buys** | **29.5 days at the peak observed rate** |

And the dedupe index, against Session C's stated 5.25M-line backfill:

| | |
|---|---|
| keys reaching the index | 1,792 from 749,255 lines |
| rate | 0.002392 keys/line |
| projected at 5.25M lines | **12,556 keys** |
| headroom vs `MAX_SEEN = 200,000` | **15.9×** |
| `dropped.beyondDedupeHorizon` observed | **0** |

**What it would cost.** A few lines in `THRESHOLDS` carrying the measured rate
and its provenance, plus a doc note. **No engine logic changes.**

**What would show it was wrong.** That the rate is not representative. It is
**one character over 10.48 days** — a multi-boxer, or a guild raiding several
times our rate, compresses 29.5 days toward a week. That is precisely why the
number has to ship carrying how it was measured rather than as a bare figure;
a horizon quoted without its rate is the same error as a bracket quoted without
its width. **If a second character's log shows a materially different rate, this
proposal is wrong as stated and the right form is a horizon the host computes
from its own observed rate.**

**Does it need anyone else.** No.

---

## Rank 2 — make the worst state loud instead of merely counted

**The fact it rests on.** `dropped.beyondDedupeHorizon` is described in the
source as the module's worst possible state — **silent double-counting with a
clean report** (`src/lockoutCore.js:1395`). It is a counter. Nothing obliges a
host to read it, and a host that does not read it gets exactly the failure the
counter exists to prevent.

**This is my own rule turned on my own code: a guard is not a gate until
something fails because of it.** Nothing currently fails because of this one.

**The proposal.** `project()` returns a top-level field that is non-null when any
drop counter indicates possible double-counting, so a host has to destructure
past it rather than opt into looking.

**What it would cost.** One derived field and a test. Small.

**What would show it was wrong.** **A false alarm would make it worse than
nothing** — a warning that fires on healthy input trains the reader to ignore it,
which is how the original hazard hides. Measured against that: zero over 749,255
lines, and 15.9× headroom at C's projected backfill. If it fires on ordinary
input, this is wrong and should be reverted rather than tuned.

**Does it need anyone else.** **Yes — C, to render it**, which is why it is rank
2 and not rank 1. C ships Tuesday and a field nobody displays is the same guard
in a new place. **I would rather this waited than shipped unrendered.**

---

## Rank 3 — count U+FFFD in key fields, and I would defend this one least

**The fact it rests on.** Session A and I arrived at the same instrument from
opposite ends of the seam within an hour: neither decoder can catch a file that
already carries U+FFFD as legitimate bytes, so **counting is the only honest
instrument left.**

**What it would cost.** About five lines in `applyLine` and a test.

**What would show it was wrong — and it may already be wrong.** I measured
**0 non-ASCII in 279,172 key-field values**, and all six U+FFFD in the corpus
land in chat lines that no modelled shape matches. **So this is a guard that has
never fired and, on the evidence, would not fire.** By the rule I applied to Rank
2, that is an argument against it, not for it.

**I am proposing it anyway for one reason and the reader should weigh it
themselves:** the failure it catches is silent and corrupts a join key, and the
cost is five lines. That is a judgement about asymmetry, not a measurement, and
I am marking it as such rather than dressing it up.

**Does it need anyone else.** No.

---

## Not proposed, but raised — `STATE_VERSION` has no migration and C ships Tuesday

`STATE_VERSION = 1` (`src/lockoutCore.js:1166`) with no migration path. Once C
ships, persisted v1 states exist in the wild and every later change to the state
shape has to cope with them.

**I am not proposing a migration**, because I do not know whether C persists
state at all, and proposing machinery for a requirement I have not confirmed is
the failure this whole exercise is about. **It is a question for C, and the
answer changes whether this is urgent or irrelevant.**
