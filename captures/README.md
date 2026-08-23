# Captures

Before/after snapshots of the grid around a deliberately-run raid.

    node capture.js before      # before the raid
    node capture.js after       # after — diffs against the last `before`

These read the **live** game log at
`<install>/Logs/eqlog_<Character>_<server>.txt`, plus the archived copies so
coverage reaches back past the reset. The archives alone are stale.

**No chat is written here.** The `.txt` is grid state; the `.json` carries grid
state plus the roster kill lines that produced it — boss, time, zone, tier.
