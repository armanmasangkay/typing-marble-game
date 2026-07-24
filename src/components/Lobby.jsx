import { useState } from 'react'

export default function Lobby({ game }) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  const { role, status, roomCode, errorMsg, createRoom, joinRoom, startGame, leave } = game

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; user can read the code manually */
    }
  }

  // Not in a room yet — show create/join choices.
  if (!role) {
    return (
      <div className="panel lobby">
        <p className="tagline">
          Type words to fling marbles at your friend. Fill their bucket before they
          fill yours. Type a <span className="pill powerup">POWER-UP</span> word to
          clear marbles from your own bucket!
        </p>

        <div className="lobby-actions">
          <button className="btn primary big" onClick={createRoom}>
            Create Game
          </button>

          <div className="divider"><span>or</span></div>

          <div className="join-row">
            <input
              className="code-input"
              placeholder="ENTER CODE"
              value={joinCode}
              maxLength={8}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom(joinCode)}
            />
            <button className="btn" onClick={() => joinRoom(joinCode)}>
              Join Game
            </button>
          </div>
        </div>

        {errorMsg && <p className="error">{errorMsg}</p>}
      </div>
    )
  }

  // Host is waiting for a guest.
  if (role === 'host') {
    return (
      <div className="panel lobby">
        <h2>Your room code</h2>
        <div className="room-code" onClick={copyCode} title="Click to copy">
          {roomCode}
          <span className="copy-hint">{copied ? '✓ copied' : 'click to copy'}</span>
        </div>
        <p className="status-line">
          Share this code with your friend. {status === 'connected'
            ? '✅ Friend connected!'
            : '⏳ Waiting for them to join…'}
        </p>
        <div className="lobby-actions">
          <button
            className="btn primary big"
            disabled={status !== 'connected'}
            onClick={startGame}
          >
            {status === 'connected' ? 'Start Game' : 'Waiting…'}
          </button>
          <button className="btn ghost" onClick={leave}>Cancel</button>
        </div>
        {errorMsg && <p className="error">{errorMsg}</p>}
      </div>
    )
  }

  // Guest is connecting / waiting for host to start.
  return (
    <div className="panel lobby">
      <h2>Joining room {roomCode}</h2>
      <p className="status-line">
        {status === 'connected'
          ? '✅ Connected! Waiting for the host to start the game…'
          : status === 'error'
            ? '❌ Could not connect.'
            : '⏳ Connecting…'}
      </p>
      <div className="lobby-actions">
        <button className="btn ghost" onClick={leave}>Back</button>
      </div>
      {errorMsg && <p className="error">{errorMsg}</p>}
    </div>
  )
}
