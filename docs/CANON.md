# CANON — measured facts, and the traps that cost us wrong answers

Working notes for Session D. Everything here traces to a named source with a
date. **A number without the exact string it was measured with is not in this
file.** If a claim is refuted later, it is struck through rather than deleted —
the retraction is the useful part.

---

## Tier M — measured by us

**Reset bracket.** After `2026-08-10 18:34:52`, before `2026-08-11 20:37:37`
Eastern = **26.056 h** (Shara) / 26.098 h (Avenrae), two characters
independently. Eastern is UTC−04:00 in August; Pacific is −3 h.

**Period floor ≥ 5.78 days.** The weekly was still refused 5.78 d after a grant,
with the Voidling present as a positive control. Refutes any cycle ≤ 5.78 d.

**`B − R = 514,800 s = EXACTLY 5 d 23 h`** — the alt+Z measurement, assumption
free. **The absolute period is NOT determined**: 1 h → 6 d, 90 m → 6 d 0 h 30 m,
2 h → 6 d 1 h, 3 h → 6 d 2 h. One reading is two equations in three unknowns.

**Encoding: UTF-8.** 9 bytes ≥ 0x80 in 494,943,214 bytes across 16 files, every
one `EF BF BD`. The 61 MB live log had zero. **windows-1252 cannot encode
U+FFFD**, so the only positive evidence points at a UTF-8 writer.

~~**Line endings: CRLF**, every line of all 15 archived files.~~ **REFUTED
27 Aug 2026 — see the corrections below. 11 files are CRLF, 4 are LF-only.**

**Corpus redundancy 1.171×**, not 3×. 11 of 15 archived files unique.

**Difficulty map**, from the client's own invite line, no conflicts anywhere:
`0 Normal · 1 Awakened · 2 Adaptive · 3 Fused · 4 Refined`.

**Zone grammar, four shapes.** Bare `<Zone>` = OPEN WORLD. `<Zone> N (Label)` =
raid instance. `<Zone> - Group N (Label)` = group instance. `<Zone> - Group` =
group instance at **tier 0** — see the correction below.

**All 93 kills of the ten roster bosses were in `- Group N` instances.** Zero in
the bare `Zone N` raid shape, which *does* occur (14 Fear visits, 5 Hate visits)
without producing one. "Raid" is the owner's word for the activity, not the
client's word for the shape.

**The weekly task is the first 3 raids per week, not per boss** (owner, 23 Aug
2026). Avenrae, week of 11 Aug: 18 roster kills, 3 grants, 3 tokens. **A refused
hail means "you have spent your three this week", NOT "this boss is locked".**

**A kill proves completion, not consumption.** Avenrae killed Innoruuk at D4 on
12, 15 AND 16 Aug — inside one week, every one in a group instance.

**Zone-in → kill:** min 199 s, median ~900 s, max 2718 s. 0 kills with no
preceding zone-in.

**Which mobs are lockout bosses.** The signature is **exactly once on every
group visit** — universality alone is worthless, because trash respawns.
Measured through the module's own parser (which does not read `died.`):

| zone | visits | boss signature | trash that also hits every visit |
|---|---|---|---|
| Nagafen's Lair | 15 | King Tranix 14, Lord Nagafen 14, Magus Rokyl 14, Warlord Skarlon 12 | a fire giant warrior 14/15 — **up to 16 per visit** |
| The Permafrost Caverns | 12 | Lady Vox 12, Giant wooly spider 12, **A priest of Nagafen 12**, an ice giant diplomat 10 | an ice giant 12/12 — **up to 7 per visit** |
| The Ruins of Old Paineel | 25 | Master Yael 25 | — (channeler 20/25, flighty fiend 17/25 are not universal) |

**Nagafen's Lair and Permafrost each carry four, not one.** `A priest of
Nagafen` was named by nobody — not the window, not any order — and carries Lady
Vox's exact signature. **Its leading article hid it, the same way `a dracoliche`
hid.**

**Privacy shape, recorded instead of the names:** 14 distinct other players
appear as instance inviters; 368 distinct names appear as the killer on a kill
line. No names retained.

---

## Corrections I have had to make to this file

### ~~"Bare `- Group` means the tier is not stated, and is never 0."~~ REFUTED 26 Aug 2026

**It means tier 0 and nothing else.** The client omits the index exactly when
the index is zero. This inversion is what made the shipped tool useless — the
owner ran it after a week of raiding and got "0 of 25 done · 15 uncertain".

| line shape | 0 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|---|
| `has asked you to join the instance: …` | **12** | 16 | 13 | 19 | 18 |
| `You have entered <Zone> - Group N (L).` | **0** | 16 | 13 | 19 | 17 |
| `You have entered <Zone> - Group.` | **12** | – | – | – | – |

Tiers 1–3 match invite-for-entry exactly, and an entry line stating an index of
0 does not exist in any of the 16 files. The day one appears, the rule is dead —
a test guards exactly that.

**`- Solo` does NOT get the rule.** A search for `" - Solo"` returns 0 on all 16
files: no entry line, no invite line, nothing. The owner's alt+Z window shows a
`Solo 3` lock, so the shape is real and **our logs have simply never seen one.**

### ~~"Line endings are CRLF, every line of all 15 archived files."~~ REFUTED 27 Aug 2026

**11 files are CRLF; 4 are LF-only** — `eqlog_Shara_rivervale_2026-08-14`,
`-16`, `-17` and `-18`. Read by opening each file descriptor and counting
terminators in-process at three offsets — head, middle and tail — with **no
pipe anywhere**, because piping is how I got this wrong the first time.

The parser is unharmed: `splitStamp` strips a trailing CR **conditionally**, and
`readline` with `crlfDelay: Infinity` handles both. But the claim was false, and
I had generalised from a sample that happened to be all CRLF.

**NOT MEASURED, and I nearly wrote it as if it were:** that those four were
normalised by some tool rather than written that way by the client. It is the
obvious reading — the four are consecutive dated Shara archives and the client
demonstrably writes CRLF elsewhere — but I have no evidence of a transform, and
"the obvious reading" is not a measurement. If it matters, it is checkable: the
same client writing the same session should not change terminator mid-corpus.

One file reads "mixed" at 2855/2856. That is my instrument: a 64 KB sample
window can open between a CR and its LF. Exactly one off, at one boundary.

### ~~"There are two kill-line shapes."~~ THERE ARE THREE. Found 27 Aug 2026

**`<Name> died.`** — 47 lines across the 16 files, 8 inside a `- Group`
instance. `src/lockoutCore.js` contains the string `died` zero times.

**It is deliberately not parsed**, and the reason is in the data: the shape
covers player and pet deaths as well as mob deaths. `Shara died.` and
`Avenrae died.` are both in it, so reading it as a kill line would score the
owner's own death as a boss kill.

**It touches none of the ten roster bosses** — every roster spelling searched
against every `died.` line, zero hits — so the grid is unaffected today. Where
it matters is the roster question: `Warlord Skarlon died.` ×2 and
`An ice giant diplomat died.` ×2 are most of the gap between their visit counts
and 15/15 and 12/12.

### ~~"Six days, solved."~~ RETRACTED
Two readings are two equations in three unknowns. "No other pairing gives a
whole number" was false. Only `B − R = 5 d 23 h` is determined.

### ~~"~3× duplication in the corpus."~~ Measured 1.171×.
I generalised a date-window figure to the whole corpus.

### ~~"The logs do not say which account."~~ REFUTED 3–0.
`/played` shows Avenrae 12 days entitled, Shara 9 → different accounts. My hedge
was a clearance asserted without a string.

### ~~"Line endings are LF."~~
My hexdump was piped through `grep`, which strips the terminator and appends its
own LF. **I hexdumped my instrument, not the file.**

---

## Traps — each one cost someone a wrong answer

- `has been assigned` is wrong; the client writes **`have been assigned`**.
- A fixed-string search for `Innoruuk has been slain by` returns 73 hits,
  **none of them the boss**. The boss scores 0 on that search. Near-misses total
  156 against 11 real.
- **The client capitalises line-initial names.** `A dracoliche` (8) vs
  `a dracoliche` (3); `The Hand of Veeshan` (5) vs `the`. Match must fold case —
  safe **only** with exact equality, never substring.
- `a dracoliche` and `the Hand of Veeshan` are **real bosses with leading
  articles**. The "article means trash" heuristic is wrong.
- **KILLING BLOWS TRUNCATE TO REMAINING HIT POINTS.** The client reports damage
  APPLIED, capped at the target's remaining HP, not the value rolled. Measured
  here over the live log on eight deterministic spell sources: **5 of 5
  below-modal hits landed on the tick the target died (100%), against 49 of
  2,805 at-modal hits (1.7%)** — a ~59x difference. Any maximum, mean or
  histogram over a set including killing blows is contaminated downward, worst
  on the fights that end quickest. Filter on a same-timestamp death first.
  We model no damage line; this is recorded so a later version does not.
- **A NULL RESULT FROM A BADLY AIMED TEST IS NOT A NULL RESULT.** My first pass
  at the above found nothing, because I had the capture groups backwards and was
  keying melee lines on attacker+target — and "a rock golem" names many mobs, so
  the death-tick match diluted to noise. I nearly reported the absence.
- **THERE IS A THIRD KILL SHAPE, `<Name> died.`** — 47 lines, 8 inside group
  instances, and it carries PLAYER deaths too (`Shara died.`, `Avenrae died.`).
  Deliberately unparsed. Any roster derived from two shapes under-counts.
- **`<NAME> has been slain by Lord Nagafen!` is a raid member DYING**, not a
  mob kill. The boss is the KILLER on those lines.
- **`You have slain <X>!` is the first-person kill form.** A `has been slain by`
  search misses 8 real boss kills.
- `You have entered an area where levitation effects do not function.` parses as
  a bare zone and clears the instance. Complete non-zone set from
  `eqstr_us.txt`: strings 3342 and 5151.
- `lockout_lines` in `logstats.py` is `STUN_LOCKOUT` — 7,071 false positives.
  `LockoutSpellTimer` is SPA 390, unrelated.
- **THE eql-source WORKTREE AT `.claude/worktrees/intelligent-saha-4b21a7` IS
  STALE AND HAS FOOLED ME TWICE.** 43 commits behind on 27 Aug (it made me tell
  the Director the site was dark-only, when the authoritative stylesheet had four
  `prefers-color-scheme` blocks); **48 behind on 30 Aug**, when it gave me 716 of
  717 pages fetching Google Fonts against the true 715. **Read `origin/main` —
  `git show origin/main:public/assets/site.css`, `git ls-tree -r origin/main`.**
  A stale tree returns plausible numbers rather than obviously wrong ones, which
  is exactly what makes it more dangerous than a broken one. (A, 30 Aug.)
- **TWO READINGS OF ONE MONOTONIC COUNTER AGREE BY CONSTRUCTION.** `read +
  remaining` gives the same expiry both times; only read precision and clock
  drift can separate them. I cited a 6-second agreement across 10.836 h as
  corroboration — it is 154 ppm of clock drift and says nothing about what the
  counter counts. **Agreement between two views of one number is not a second
  witness.** (Session C, 30 Aug.)
- **A CONSTANT ONLY EVER READ BY HUMANS LOOKS EXACTLY LIKE ONE THAT IS WIRED IN.**
  `RESET_RULE.hour` had ZERO call sites for eleven days while I asked for the
  measurement daily. Grep the call sites before reporting something blocked on a
  number. (Session C, 30 Aug.)
- **Filenames are rotation-END dates, not content dates.**
- `raw.githubusercontent.com` caches ~5 min and returns **HTTP 200 with stale
  content**. Verify with `gh api`.
- `raids-measured.json`: 98 of 213 rows carry difficulty 0 and **90 of those are
  open-world kills** — that column is a bucket, not a tier.
- **Working copy is CRLF.** A multi-line Python `.replace()` on `\n` silently
  fails. Use the Edit tool, or `newline=''` with an explicit NL.
- **`node --test test/` is broken** on Node 24 / Windows (MODULE_NOT_FOUND on
  the directory). Run each suite file individually.
- One ambiguous kill must never blank cells it says nothing about. It did, for
  two weeks: `onDay` and `unstated` were computed row-wide, so 8 kills produced
  12 `unknown` cells.

---

## Doctrine

NEVER INVENT A NUMBER · DERIVE, NEVER TYPE · A CLEARANCE CARRIES THE STRING YOU
SEARCHED · A CHECK RESULT NAMES THE TREE IT WAS MEASURED ON · A DRAWING IS AN
ASSERTION · ONE SAMPLE IS A SAMPLE, NOT A RATE · NEVER PRESENT LIVE EQ OR P99
BEHAVIOUR AS LEGENDS · **A REFUSAL TO GUESS IS NOT A REFUSAL TO HELP.**

Security, standing: **no memory reading, no packet inspection, no client
injection.** Log files and what the client prints to the player, nothing else.
Raw logs never commit; captures commit as scrubbed verbatim excerpts, and a line
is **dropped entirely rather than rewritten** — a rewritten line still parses
into a fake event. Other players are never named outside the credits.

---

## Paths

| what | where |
|---|---|
| this repo | `C:\Users\Lindsey\Desktop\EQLSLockouts` |
| eql-source | `C:\Users\Lindsey\Desktop\EQL Source\eql-source` |
| archives (15 files) | `…\EQL Source\eql-source\state\logs\` and `…\EQL Source\` |
| **LIVE log** (through today) | `C:\Users\Public\Daybreak Game Company\Installed Games\EverQuest Legends\Logs\eqlog_Avenrae_rivervale.txt` |
| Sky Ledger reference page | `public/app/sky-ledger.dad68d2b.html` |
| Auras live tree | `C:\Users\Lindsey\EQ tracker` (remote `LoxyBee/EQLS-Auras`) |
| Session C workspace | `C:\Users\Lindsey\EQLS Auras` |

---

## Open, and what would close each

| question | what would settle it |
|---|---|
| the absolute lockout period | **alt+Z within a minute of entering a fresh instance** — fixes R, therefore B, with no assumption |
| **the reset HOUR** | the **wall-clock time each alt+Z screenshot was taken**, plus the remaining time it prints. Two readings that agree prove both the instant and that locks share one. This is the one that unblocks the grid. |
| does `/dzlisttimers` log? | run it, then `/say timers check done` as a control. Nothing printed **with** the control line present is a real negative, not a failed capture. |
| Solo instances | never observed in 16 files; the window says they exist |
| do bosses in a raid share a lock? | a run clearing *some* of a zone's bosses, then evidence about the others |
| Group vs raid instance — one lock or two? | unmeasured; the grid carries `shapes` so it stays answerable |
| Plane of Hate row shape | **Director's ruling.** Ten further bosses die in Hate instances, but only in the bare `Zone N` shape; Innoruuk and the Maestro only in `- Group N`. The two shapes hold different populations. |
| clause 2 and 4 amendments | **I have never received their content.** Asked four times. |
