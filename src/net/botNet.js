import {
  BUCKET_CAPACITY,
  MARBLES_PER_WORD,
  BOT_DIFFICULTY,
  topRowCount,
} from '../game/constants.js'

// A drop-in fake opponent that satisfies the same interface useGame expects of
// NetPeer (onStatus / onMessage / onError callbacks; send() + destroy()). The
// bot never touches the network — it just simulates a second player typing by
// feeding the exact same protocol messages into onMessage on a self-rescheduling
// timer. This lets the entire game loop, rendering, countdown, win/lose, and
// rematch flow run unchanged for single-player games.
export class BotNet {
  constructor({ onStatus, onMessage, onError, difficulty } = {}) {
    this.onStatus = onStatus || (() => {})
    this.onMessage = onMessage || (() => {})
    this.onError = onError || (() => {})
    this.cfg = BOT_DIFFICULTY[difficulty] || BOT_DIFFICULTY.medium
    this.bucket = 0
    this.timer = null
    this.dead = false

    // Report "connected" asynchronously so it mirrors the real net's ordering
    // and never fires synchronously during a render.
    setTimeout(() => {
      if (!this.dead) this.onStatus('connected')
    }, 0)
  }

  // Player → bot messages. We react the way a real peer would.
  send(msg) {
    if (!msg || typeof msg !== 'object' || this.dead) return
    switch (msg.type) {
      case 'start':
        this.bucket = 0
        this._scheduleNext()
        break
      case 'rematch':
        // Host restarted: reset and re-arm, self-contained (no extra 'start').
        this.bucket = 0
        this._scheduleNext()
        break
      case 'clearRow': {
        // Player typed a power-up against us: knock out our own top row and
        // report the new total so the player sees our bucket drop.
        const removed = topRowCount(this.bucket)
        if (removed > 0) {
          this.bucket -= removed
          this.onMessage({ type: 'state', bucket: this.bucket })
        }
        break
      }
      case 'gameover':
        // Player filled first — stop typing.
        this._clearTimer()
        break
      case 'state':
      default:
        // Player's own progress; the bot doesn't need it.
        break
    }
  }

  destroy() {
    this.dead = true
    this._clearTimer()
  }

  // --- internals ---

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  // Re-roll a fresh delay from the difficulty band for EVERY word, so the bot's
  // speed varies word-to-word instead of ticking like a metronome.
  _scheduleNext() {
    this._clearTimer()
    const [min, max] = this.cfg.wordMs
    const delay = min + Math.random() * (max - min)
    this.timer = setTimeout(() => this._completeWord(), delay)
  }

  _completeWord() {
    this.timer = null
    if (this.dead) return

    if (Math.random() < this.cfg.powerupChance) {
      // Offensive: knock a row out of the player's bucket.
      this.onMessage({ type: 'clearRow' })
    } else {
      this.bucket = Math.min(BUCKET_CAPACITY, this.bucket + MARBLES_PER_WORD)
      this.onMessage({ type: 'state', bucket: this.bucket })
      if (this.bucket >= BUCKET_CAPACITY) {
        // Bot filled first — the player loses the race.
        this.onMessage({ type: 'gameover' })
        return
      }
    }
    this._scheduleNext()
  }
}
