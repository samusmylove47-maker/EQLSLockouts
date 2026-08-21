# EQLS Lockouts

A dependency-free parsing core that reads EverQuest Legends' own weekly-task
lines out of a combat log and reports raid lockout state — **measuring** the
reset instead of assuming it.

    node --test test/lockout.test.js     # 30 tests
    node analysis/derive.js              # re-derive every figure from the logs
    node analysis/hails.js               # classify every Voidling exchange
    node analysis/make-fixture.js        # rebuild the redacted fixture

## What is different about it

Every other tool that ships this feature infers a lockout from kill history and
hardcodes a reset day as a constant. **This module ships no reset constant at
all.** It reports the boundary as the bracket the observations support, and says
`not recorded` for everything it has not seen.

It reads the signal the game actually prints:

    You say, 'danger'
    You have been assigned the task 'Potential of the Void - Lord Nagafen - Weekly'.
    Voidling says, 'Your hubris risks our very reality itself.'      <- AVAILABLE

    You say, 'danger'
    Voidling says, 'Your hubris risks our very reality itself.'      <- LOCKED OUT

When you are locked out the game says nothing. The Voidling's closing line fires
either way, so it is a **positive control**: a real negative and a filtered
capture are distinguishable, which is not true anywhere else in this problem.

## Shape

- `src/lockoutCore.js` — the deliverable. **Zero `require`s.** No Electron, no
  DOM, no filesystem, no timers. `Date.now()` is never called. Lines in, an
  explicit `now` in, JSON-clonable state out.
- `src/lockoutEngine.js` — optional adapter. `EventEmitter`, injected clock.
  Requires only `events` and the core. Delete it if it does not suit.

One state per character — a log file belongs to one character, and merging two
grouped characters fabricates reset brackets seconds wide.

## Documents

- `docs/EVIDENCE.md` — every line shape, its provenance, and every clearance
  with the exact string searched.
- `docs/CAPTURE-PROTOCOL.md` — the one sitting, ordered, with branches.
- `HANDOFF.md` — the report to the Director.
- `analysis/findings.json` — generated. Every figure quoted anywhere is read out
  of this file.

## Credit

The lead came from reading **Josh Moyers (jmoyers)**,
`github.com/jmoyers/everquest-companion`, `tests/fixtures/p1-unbound-pet.log` and
`tests/fixtures/e2e-overview.log`, read 21 Aug 2026 — he is the reason we knew a
weekly task line existed. Nothing from that repository is used here; the line
shapes are Daybreak's client output and our fixtures are built from our own logs.
