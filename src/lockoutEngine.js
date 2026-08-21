'use strict';

// EQLS Lockouts — optional adapter.
//
// `lockoutCore.js` is the deliverable. This file is a convenience wrapper and
// nothing depends on it: if it does not suit the host app, delete it and call
// the core directly. It exists only so that dropping this into an app whose
// engines are EventEmitters with injected dependencies costs no adaptation.
//
// Requires `events` and nothing else. `events` is a node builtin.

const { EventEmitter } = require('events');
const core = require('./lockoutCore');

// Converts a host `Date` into the civil timestamp the core requires.
//
// This is the ONLY place a real clock is read, and it is deliberately at the
// edge. The local components of a Date are the same wall clock the game client
// writes into the log, which is why this conversion is sound and why doing it
// via UTC or an offset would not be.
function civilFromDate(date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

class LockoutEngine extends EventEmitter {
  // One engine per character. See the note on `createState` for why this is a
  // constructor argument rather than something inferred from the lines.
  constructor(character) {
    super();
    this.state = core.createState(character);
    // Injected rather than called directly, for the same reason the host app's
    // other engines inject theirs: it keeps this instantiable in a plain node
    // test script, and it keeps the clock substitutable in a test.
    this.nowFn = () => civilFromDate(new Date());
  }

  setNowFn(fn) {
    this.nowFn = fn;
  }

  // Feed one raw log line, exactly as a tailer emits it: timestamp included,
  // trailing newline already stripped. Safe to call with lines this module
  // does not model — they are ignored.
  //
  // Emits 'change' only when the line actually moved the state, so a caller
  // can re-render on the event rather than polling.
  handleLine(line) {
    const before = this.state.events.length;
    core.applyLine(this.state, line);
    if (this.state.events.length !== before) {
      const ev = this.state.events[this.state.events.length - 1];
      this.emit('event', ev);
      this.emit('change', this.snapshot());
    }
  }

  // Feed history in bulk. A tailer that starts at end-of-file has no past, and
  // this module's whole value is in the past — the reset bracket needs two
  // assignments, and those may be days apart. Read the existing log once at
  // startup and pass it here.
  handleLines(lines) {
    core.applyLines(this.state, lines);
    this.emit('change', this.snapshot());
  }

  snapshot() {
    return core.project(this.state, this.nowFn());
  }

  // JSON-clonable, safe to persist and to send over IPC.
  serialize() {
    return JSON.parse(JSON.stringify(this.state));
  }

  restore(saved) {
    if (!saved || saved.version !== core.STATE_VERSION || saved.character !== this.state.character) {
      // A version we do not recognise is discarded rather than guessed at.
      // Re-reading the log rebuilds the state exactly; there is nothing here
      // that cannot be recovered from the source.
      this.state = core.createState(this.state.character);
      return false;
    }
    this.state = saved;
    return true;
  }
}

module.exports = { LockoutEngine, civilFromDate };
