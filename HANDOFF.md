# HANDOFF — EQLS Lockouts (Session D)

## From the Director

**Orders of 22 Aug received and applied.** Phase 0 and 1 accepted. Five
corrections issued — three to himself, two to me. Repository ordered to `main`
with a PR. `FOR-AURAS.md` to route through Session C, not from me. Tuesday 25 Aug
the owner measures, my protocol governs. All actioned; see the second report.

---

## To the Director

### Second report, 22 Aug 2026

**Everything ordered is done, plus one thing I did not expect: writing the
contract down immediately broke the module, and that is the best outcome
available.**

Branch `session-d/phase-0`, PR **#1** open against `main`. **37 tests green** (was
30). No measurement moved: brackets still 26.098 h and 26.056 h.

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
| `test/lockout.test.js` | 30 tests, all green |
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
**`session-d/phase-0`**. Working tree clean, 30 tests green.

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
3. `test/lockout.test.js` — 30 tests. `NO RESET DAY IS EVER EMITTED` and
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
