import { useEffect, useRef, useState } from 'react'
import { playDrop } from '../audio/sfx.js'

// Visual marble bucket. Fills with stacked marbles as `count` rises toward `capacity`.
// `pop` (only passed for the local player's bucket) signals that an opponent's
// power-up just knocked a row out: { n, removed } — `n` bumps each hit so the
// effect re-fires, `removed` is how many marbles to burst.
export default function Bucket({ label, count, capacity, mine, pop }) {
  const ratio = Math.min(1, count / capacity)
  const danger = ratio >= 0.75
  const marbles = Array.from({ length: Math.min(count, capacity) })

  // Play a drop sound whenever this bucket gains marbles.
  const prevCount = useRef(count)
  useEffect(() => {
    const added = count - prevCount.current
    if (added > 0) {
      // Pitch nudges up per marble so batches don't sound identical.
      for (let i = 0; i < added; i += 1) playDrop(i)
    }
    prevCount.current = count
  }, [count])

  // Pop/burst + shake when our row gets cleared. Driven off the `pop` signal
  // (not the count drop) so the sound in useGame stays the single audio source.
  const [burst, setBurst] = useState(0) // number of burst pieces currently showing
  const [shaking, setShaking] = useState(false)
  const popN = pop ? pop.n : 0
  useEffect(() => {
    if (!popN) return undefined
    setBurst(Math.min(pop.removed, 6))
    setShaking(true)
    const t = setTimeout(() => {
      setBurst(0)
      setShaking(false)
    }, 450)
    return () => clearTimeout(t)
  }, [popN])

  return (
    <div className={`bucket-col ${mine ? 'mine' : 'opp'}`}>
      <div className="bucket-label">
        <span className="side-badge">{mine ? '🔵' : '🟣'}</span>{label}
      </div>
      <div className={`bucket ${danger ? 'danger' : ''} ${shaking ? 'shake' : ''}`}>
        <div className="bucket-fill" style={{ height: `${ratio * 100}%` }} />
        <div className="marbles">
          {marbles.map((_, i) => (
            <span
              className="marble"
              key={i}
              style={{ '--i': i % 6 }}
            />
          ))}
        </div>
        {burst > 0 && (
          <div className="burst">
            {Array.from({ length: burst }).map((_, i) => (
              <span className="marble marble-pop" key={i} style={{ '--i': i }} />
            ))}
          </div>
        )}
      </div>
      <div className="bucket-count">{count} / {capacity}</div>
    </div>
  )
}
