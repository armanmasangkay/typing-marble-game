// Procedural sound effects synthesized with the Web Audio API — no asset files.
// The AudioContext is created lazily and resumed on the first user gesture so we
// don't trip browser autoplay policies.

let ctx = null
let muted = false

// Listeners so UI (mute button) can react to state changes.
const muteListeners = new Set()

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  // Autoplay policy: context may start 'suspended' until a gesture resumes it.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Call once from a user-gesture handler (e.g. a click) to unlock audio.
export function unlockAudio() {
  getCtx()
}

export function isMuted() {
  return muted
}

export function setMuted(next) {
  muted = !!next
  muteListeners.forEach((fn) => fn(muted))
}

export function toggleMuted() {
  setMuted(!muted)
  return muted
}

export function onMuteChange(fn) {
  muteListeners.add(fn)
  return () => muteListeners.delete(fn)
}

// --- Low-level synth helpers ---

// A single enveloped oscillator tone.
function tone({ freq, type = 'sine', start = 0, dur = 0.15, gain = 0.2, glideTo = null }) {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime + start
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glideTo != null) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)

  // Quick attack, exponential decay for a plucky/percussive feel.
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(g)
  g.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

// Short filtered noise burst — used for the marble "plop" body and typing tick.
function noise({ start = 0, dur = 0.06, gain = 0.15, freq = 1200, q = 1 }) {
  const ac = getCtx()
  if (!ac) return
  const t0 = ac.currentTime + start
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  // Deterministic pseudo-noise (Math.random is fine here; no replay concerns).
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1

  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  src.connect(filter)
  filter.connect(g)
  g.connect(ac.destination)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

function guard() {
  return !muted && getCtx()
}

// --- Public sound effects ---

// Marble landing: a low sine "plop" with a soft noise thump. `pitch` (0..n)
// nudges the frequency up so rapid batches don't sound identical.
export function playDrop(pitch = 0) {
  if (!guard()) return
  const base = 180 + pitch * 22
  tone({ freq: base, type: 'sine', dur: 0.16, gain: 0.28, glideTo: base * 0.6 })
  noise({ dur: 0.05, gain: 0.06, freq: 900, q: 0.7 })
}

// Soft mechanical key tick.
export function playType() {
  if (!guard()) return
  noise({ dur: 0.03, gain: 0.05, freq: 2200, q: 2 })
  tone({ freq: 320, type: 'square', dur: 0.03, gain: 0.04 })
}

// Wrong character — subtle low blip.
export function playError() {
  if (!guard()) return
  tone({ freq: 140, type: 'sawtooth', dur: 0.1, gain: 0.08 })
}

// Your marbles get knocked out by an opponent's power-up: a bright burst of
// noise plus a quick downward tone — a satisfying "pop".
export function playPop() {
  if (!guard()) return
  noise({ dur: 0.12, gain: 0.16, freq: 1600, q: 0.8 })
  tone({ freq: 620, type: 'triangle', dur: 0.14, gain: 0.16, glideTo: 180 })
}

// Power-up word cleared: sparkly rising arpeggio.
export function playPowerup() {
  if (!guard()) return
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  notes.forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.06, dur: 0.18, gain: 0.16 }))
}

// Countdown tick (3, 2, 1).
export function playCountdown() {
  if (!guard()) return
  tone({ freq: 440, type: 'square', dur: 0.12, gain: 0.18 })
}

// "GO!" — higher, brighter tone.
export function playGo() {
  if (!guard()) return
  tone({ freq: 880, type: 'square', dur: 0.22, gain: 0.22 })
}

// Win chime — ascending major triad.
export function playWin() {
  if (!guard()) return
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.12, dur: 0.5, gain: 0.2 }))
}

// Lose tone — descending, darker.
export function playLose() {
  if (!guard()) return
  const notes = [392, 329.63, 261.63, 196] // G4 E4 C4 G3
  notes.forEach((f, i) => tone({ freq: f, type: 'sawtooth', start: i * 0.14, dur: 0.4, gain: 0.16 }))
}
