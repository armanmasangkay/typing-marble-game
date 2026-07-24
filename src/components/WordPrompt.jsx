import { useEffect, useRef, useState } from 'react'

export default function WordPrompt({ word, onComplete, disabled }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  // Clear + refocus whenever a new word appears.
  useEffect(() => {
    setValue('')
    if (inputRef.current) inputRef.current.focus()
  }, [word])

  if (!word) return null

  const handleChange = (e) => {
    const raw = e.target.value
    // Space (or trailing space) submits the word; also auto-submit on exact match.
    const candidate = raw.endsWith(' ') ? raw.trim() : raw
    if (candidate === word.text) {
      setValue('')
      onComplete()
      return
    }
    setValue(raw)
  }

  // Per-character coloring against what's typed so far.
  const typed = value
  const chars = word.text.split('').map((ch, i) => {
    let cls = 'ch'
    if (i < typed.length) cls += typed[i] === ch ? ' ok' : ' bad'
    return <span className={cls} key={i}>{ch}</span>
  })

  return (
    <div className={`word-prompt ${word.powerup ? 'powerup' : ''}`}>
      {word.powerup && <div className="powerup-tag">⚡ POWER-UP — clears your marbles!</div>}
      <div className="word-text">{chars}</div>
      <input
        ref={inputRef}
        className="type-input"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="type here…"
      />
    </div>
  )
}
