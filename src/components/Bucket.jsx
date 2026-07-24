import { useEffect, useRef } from 'react'
import { playDrop } from '../audio/sfx.js'

// Visual marble bucket. Fills with stacked marbles as `count` rises toward `capacity`.
export default function Bucket({ label, count, capacity, mine }) {
  const ratio = Math.min(1, count / capacity)
  const danger = ratio >= 0.75
  const marbles = Array.from({ length: Math.min(count, capacity) })

  // Play a drop sound whenever this bucket gains marbles (covers both sides:
  // your marbles landing in the opponent's bucket, and theirs landing in yours).
  const prevCount = useRef(count)
  useEffect(() => {
    const added = count - prevCount.current
    if (added > 0) {
      // Pitch nudges up per marble so batches don't sound identical.
      for (let i = 0; i < added; i += 1) playDrop(i)
    }
    prevCount.current = count
  }, [count])

  return (
    <div className={`bucket-col ${mine ? 'mine' : 'opp'}`}>
      <div className="bucket-label">
        <span className="side-badge">{mine ? '🔵' : '🟣'}</span>{label}
      </div>
      <div className={`bucket ${danger ? 'danger' : ''}`}>
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
      </div>
      <div className="bucket-count">{count} / {capacity}</div>
    </div>
  )
}
