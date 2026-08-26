# Capture protocol — one sitting

**Status: this is much smaller than it was going to be.** Nineteen days of logs
already on disk answered most of Phase 0 without anyone logging in. What is left
needs about **ten minutes in game, once**, plus one two-hour return visit that
only matters if it lands on the right day.

Read the whole thing before starting. Every step says what to write down and what
a null result means, because a null result here is data.

---

## Before you log in

**Chat filters first, and this is not optional.** A filter that hides system text
makes an empty capture and a true negative byte-identical. Set every filter you
can find to show in the main window, and specifically confirm NPC dialogue is on
— the whole protocol depends on seeing `Voidling says, ...`.

**Confirm logging is on.** `/log on`. The repo has already been bitten by a zone
crossing that was never written because logging started afterwards.

**Write down the wall clock and the timezone** at the moment you start. The
machine reads `Eastern Standard Time` (UTC−05:00 base, DST active in August, so
UTC−04:00) — confirmed from the OS on 21 Aug 2026. If you are playing on a
different machine, say so, because every published reset claim is stated in
Pacific and the conversion is the whole point.

---

## Step 1 — `/dzlisttimers`. Ten seconds. Do this first.

**Type exactly:** `/dzlisttimers`

Then, whatever happens, type a message you will recognise into a channel you can
see — `/say protocol step 1 done` — so the log carries a **positive control**
proving the window was open and unfiltered at that moment.

**Why this is here at all, when I was told the command was dead.** It is not
dead. `<install>/eqstr_us.txt` line 1949 carries the client's own usage string:

> `3536 Usage: /dzListTimers    - This command will list any outstanding replay
> timers you have for all expeditions.  This is the amount of time you must wait
> before being allowed to enter another instance of that zone.`

and three other strings from the same expedition block **fire verbatim in our own
logs**, so the system is live on this server, not inherited boilerplate:

- `Onomar has accepted your offer to join your expedition.` (string 3522)
- `You are not the expedition leader, only Ceriph can issue this command.` (3513)
- 83 × `... has asked you to join the instance: ... Accepting will incur you a
  charge or replay timer.` (3527)

String 3513 is the important one: it is a **permission error**, which means
somebody typed a `/dz` command and the server answered. The command family
exists.

`grep -F "outstanding replay"` across all 15 logs returns **0**. Nobody has ever
run it.

**Branches:**

| what you see | what it means | what to do |
|---|---|---|
| A list of timers | The whole reset question may be readable directly. | Screenshot it, then step 2. |
| `You have no outstanding replay timers` or similar | Command works, you hold none. | Note it, do step 1 again right after a raid instance. |
| Nothing at all | Either not implemented, or filtered. | Your positive control line decides which. Note it and move on. |
| `Unknown command` | Not implemented. Genuinely dead. | Note the exact wording and move on. |

Also try, ten seconds each, and write the exact response for each:
`/dzhelp`, `/dztimers`, `/dzplayerlist`, `/dzquit`.

---

## Step 1b — one accented character. Five seconds, closes a question open for weeks.

**Type exactly:** `/say café — naïve “quotes” résumé`

Then move on. That is the whole step.

**What it settles.** We measured the corpus and it is UTF-8: exactly 9 bytes ≥
0x80 in 434 MB, all of them `EF BF BD` (U+FFFD). But **U+FFFD is the residue of a
decode that already threw a byte away.** So "UTF-8 is the right decoder for the
bytes on disk" is settled, while "what the client originally emitted" is not, and
**cannot be settled from a corpus whose only non-ASCII content is the replacement
character itself.**

One line with a real accented character in it decides it permanently:

- log bytes `C3 A9` for the `é` → the client writes **UTF-8**
- log bytes `E9` alone → the client writes **Windows-1252**

Any accented character will do; the line above just gets several classes at once
(accented vowels, a dash, curly quotes). It does not matter what it says, and it
does not need to be in a public channel — `/say` in an empty zone is fine.

**Why it matters beyond tidiness:** the host app decodes `utf8` and reads at byte
offsets, so a multi-byte character straddling a read boundary would corrupt a
line. Today that is untestable because no such character has ever been logged.
This makes it testable.

---

## Step 2 — the one observation that resolves the reset rule

**This is the whole sitting. Everything else is optional.**

Go to a Voidling — Nagafen's Lair, The Ruins of Old Paineel, or The Permafrost
Caverns, in the **static zone**, not inside an instance. Then:

1. `/say Hail, voidling`
2. Wait for `Voidling says, '...accept the risk and the [danger]...'`
3. `/say danger`
4. **Write down the wall clock to the minute.**

**Read the result like this:**

```
You say, 'danger'
You have been assigned the task 'Potential of the Void - <Boss> - Weekly'.   <- AVAILABLE
Voidling says, 'Your hubris risks our very reality itself.'
```
```
You say, 'danger'
Voidling says, 'Your hubris risks our very reality itself.'                  <- LOCKED OUT
```

**The two are identical but for the task line. When you are locked out the game
says nothing at all.** There is no refusal message, no timer, no lockout line
anywhere in 440 MB of log.

**The Voidling's closing line is your positive control and it is free** — it
fires in both cases. If you see the closing line and no task line, that is a real
negative, not a filtered one. This is the only place in this project where
silence is trustworthy, and it is trustworthy *because* of that reply.

**Do all three Voidlings if you can.** Three data points cost about five minutes.

---

## Step 3 — the return visit, and the day it has to be

Everything above can happen any time. **This step is the one that costs a week if
it is missed.**

Our own logs bracket the turnover to a **26.06-hour window** between
**Mon 10 Aug 18:34 and Tue 11 Aug 20:37 Eastern**. That is not narrow enough to
name an hour. Community chat in our own log, on the day, says Tuesday ~08:00
Pacific — but that is player talk and one of them wrote "Tuesday would be my
guess".

**So: on a Tuesday, hail a Voidling twice.**

- **Once before 10:00 Eastern** (07:00 Pacific). Expect REFUSED.
- **Once after 12:00 Eastern** (09:00 Pacific). Expect GRANTED.
- Write the wall clock beside each.

If both refuse, the reset is later than 12:00 Eastern — come back at 16:00. If
both grant, it is earlier than 10:00 — come back next Tuesday at 06:00.

**Each pair halves the window.** Two Tuesdays gets it inside a couple of hours.
One Tuesday, done properly, already beats every published source.

**Do not do this on a day you have already taken the weekly** — a task you are
holding cannot be re-granted, and the capture reads REFUSED for the wrong reason.

---

## Step 4 — free, if you happen to be raiding anyway

**The one confound the logs cannot resolve.** Every weekly we have ever seen
granted came at difficulty **0 (Normal)** or **1 (Awakened)**. Every group entry
at D2, D3 and D4 produced no task — but every one of those happened *after* the
weekly had already been taken that week, so "the difficulty was too high" and
"you were already locked out" are perfectly confounded in our data.

**Break it:** on a day when a boss's weekly is NOT yet taken, hail its Voidling
and make the instance at **D2 or higher**. Does the task still get granted?

- **Granted** → difficulty is irrelevant to the weekly. The lockout is per boss.
- **Not granted** → the weekly only exists at low difficulty, and every count we
  have is measuring something else.

Either answer is worth more than another hour of raiding.

---

## What to bring back

Nothing but the log, and these notes:

1. Wall clock and timezone at start.
2. Exact response to each `/dz` command, verbatim, including "nothing happened".
3. Wall clock beside every `danger`.
4. Whether your chat filters were showing NPC dialogue.

The log holds everything else. **Do not clean anything up** — a line you thought
was noise is what the last three findings came out of.

---

## Step 1c — alt+Z within a minute of entering an instance. Ten seconds.

**Enter any instance, then immediately press alt+Z and screenshot the
"Outstanding Instance Timers" list.**

**What it settles.** The window shows a Replay Timer and a set of boss lockouts,
but two readings at one moment give two equations in three unknowns — both
periods and the elapsed time — so they determine only the *difference* between
the periods, which is **exactly 5 days 23 hours**. The absolute periods are not
determined by any single reading.

Reading the window immediately after entering means the Replay Timer is showing
almost its **full period**. That fixes it, and the exact difference then fixes
the lockout period with no assumption at all.

**Why it matters:** the difference between a 6-day and a 6-day-1-hour lockout is
the difference between "available Monday evening" and "available Monday night",
and a tracker that is an hour optimistic tells you a raid is open when it is not.
