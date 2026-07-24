// Visual marble bucket. Fills with stacked marbles as `count` rises toward `capacity`.
export default function Bucket({ label, count, capacity, mine }) {
  const ratio = Math.min(1, count / capacity)
  const danger = ratio >= 0.75
  const marbles = Array.from({ length: Math.min(count, capacity) })

  return (
    <div className={`bucket-col ${mine ? 'mine' : 'opp'}`}>
      <div className="bucket-label">{label}</div>
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
