# The boss roster — what it is, and why it is probably not your engagement trigger

**For Session C's threat meter.** Answering the three questions asked, measured
rather than estimated, from `src/lockoutCore.js` and the four Desktop logs.

**THE SHORT ANSWER, so C can stop reading if it settles the design: my roster is
RAID-ONLY. Ten names. It matches 29 of 1,774 kill lines — 1.6%. It is not a
named-mob roster, it was never built to be one, and using it as an engagement
trigger would miss essentially every named mob in the game.**

---

## 1. What it is, where it lives, and its exact shape

`src/lockoutCore.js`, exported as `RAIDS`, `RAID_OF_BOSS`, `OBSERVED_ZONES`,
`WINDOW_TO_KILL_NAME`, `OBSERVED_WEEKLY_BOSSES`, `normaliseBossName`.

**Five raids, ten boss names:**

| raid key | label | completion bosses | `alsoDies` | `singleBoss` |
|---|---|---|---|---|
| `Nagafen's Lair` | Lord Nagafen | Lord Nagafen | 3 | false |
| `The Permafrost Caverns` | Lady Vox | Lady Vox | 3 | false |
| `The Ruins of Old Paineel` | Master Yael | Master Yael | 0 | **true** |
| `The Plane of Fear` | Plane of Fear | Terror, Dread, Fright, a dracoliche, Cazic-Thule | 0 | false |
| `The Plane of Hate` | Plane of Hate | Innoruuk the Prince of Hate, Maestro of Rancor | 0 | false |

`RAID_OF_BOSS` is a flat `bossName -> raidKey` map, **10 keys, and the keys are
NORMALISED (lower-cased)**. Join through `normaliseBossName(name)` or you will
get zero matches from correctly-spelled log names — I made exactly that mistake
while writing this document and measured "0 of 10" before catching it.

---

## 2. Can it be read as a plain list? YES — and it needs no engine

```js
const { RAID_OF_BOSS, normaliseBossName } = require('./src/lockoutCore.js');
const isRaidBoss = (mobName) => !!RAID_OF_BOSS[normaliseBossName(mobName)];
```

That is the whole interface. **Two pure functions, no state, no log parsing, no
`project()` call.** `normaliseBossName` is a string function. Nothing about this
join needs my engine, and C should not build against anything larger.

`WINDOW_TO_KILL_NAME` matters if you ever read the alt+Z window: the window and
the kill lines **use different strings** for the same boss —
`Innoruuk` → `Innoruuk, the Prince of Hate`, `Dracoliche` → `a dracoliche`. An
unmapped name renders as a missing boss, which looks exactly like a boss you
have not fought.

---

## 3. What it does NOT contain — and this is the answer that matters

**It contains raid bosses that carry a weekly lockout. Nothing else.** It is
explicitly *not* a discovered roster; the source comment says so and says why —
if `/dzlisttimers` ever logs, the roster discovers itself and anything hand-built
now is thrown away.

**Measured over 4 logs, 749,255 lines, 1,774 kill lines:**

| | |
|---|---|
| **distinct mobs slain** | **293** |
| matched by my roster | **10** |
| kill lines that are roster bosses | **29 of 1,774 — 1.6%** |
| roster boss kill counts | 2–3 each, tightly clustered |

**283 of 293 distinct mobs are invisible to my roster.** Some of those are
certainly named mobs. I cannot tell you which, because I have no ground truth
beyond the ten.

**The owner's spec says "named/boss". I have the boss half of that, for five
raids, and none of the named half.**

---

## 4. Two obvious detectors, both measured, both fail

I tested the candidates C would otherwise test at 02:00 against a live log.

### The article heuristic — `a`/`an`/`the` means trash

Classic EQ convention: trash reads `a giant rat`, named mobs are proper nouns.

| | |
|---|---|
| article-initial | 196 of 293 |
| capital-initial | 97 of 293 |
| **roster bosses it CATCHES** | **9 of 10** |
| **roster bosses it MISSES** | **1 — `a dracoliche`** |
| names it flags that my roster does not know | 88 |

**It has a known false negative rate of 1 in 10 on the only ground truth that
exists**, and the miss is a real Plane of Fear boss. A threat meter using this
rule silently fails to start on a dracoliche.

The 88 it flags are *either* named mobs my roster lacks *or* trash with proper
names. **I cannot separate them and neither can C without ground truth** — so
this rule's precision is unmeasurable today, not merely unmeasured.

### "It deals damage back" — DOES NOT DISCRIMINATE AT ALL

| | |
|---|---|
| roster bosses seen dealing damage | **10 of 10** |
| capital-initial non-roster names seen dealing damage | **82 of 88** |

**Both populations deal damage at essentially the same rate. This is not a
signal.** Recording it because it is the next thing anyone would reach for and it
is free to rule out now.

### One weak signal, offered as a lead and not a rule

Roster bosses die **2–3 times each** across 11 days. Among capital-initial
non-roster names the distribution is **max 88, median 2, and 26 died exactly
once.** A mob dying 88 times in 11 days is not a raid boss.

**This is a lead, not a detector.** It needs a time window, it cannot classify a
mob on first sight — which is exactly when a threat meter must decide — and it
would classify a boss killed once as trash. **Do not ship it as a trigger.**

---

## 5. What I would tell C to do with this

**Take the ten-name join for what it is: a high-precision, very-low-recall
trigger.** If `isRaidBoss(name)` is true, that is a raid boss and you can start
with confidence. If it is false, **you have learned nothing** — 283 of 293 mobs
land there.

So the honest shape is the same three-way as `actionability()`: **`raid-boss` /
`unknown`**, never `boss` / `not-boss`. A boolean here forces 283 unclassified
mobs into "not a boss", and the meter then silently fails to start on every named
mob in the game.

**The gap is real and it is not mine to close tonight.** A named-mob roster needs
either a data source none of us has, or a discriminator better than the two
measured above. B's catalogue carries mob names on 1,958 of 3,663 records as
drop sources — **that is a larger name population than mine and worth checking
against these 293 before anyone builds a heuristic.** I have not fetched it and
am not going to: it is B's, three sessions are at speed, and I was told not to
build any part of the threat meter.

---

## 6. What this document does not establish

The surface is **4 logs, 57.7 MB, one character pair, 11 days** — a subset of the
full 434 MB corpus. **293 distinct mobs is a floor on the real number, not the
number.** The 1.6% figure and the 196/97 split are properties of this corpus and
would move on a different one.

Reproduce with `analysis/name-encoding-scan.js` for the corpus shape; the roster
figures above come from a one-off script and the commands are in the commit
message so they can be re-run rather than trusted.
