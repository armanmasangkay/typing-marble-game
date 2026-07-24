import { useState } from 'react'
import { BOT_DIFFICULTY } from '../game/constants.js'

export default function Lobby({ game }) {
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [showBot, setShowBot] = useState(false)

  const {
    role, status, roomCode, roomLink, errorMsg,
    createRoom, joinRoom, startGame, startBotGame, leave,
  } = game

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink || roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; user can select the link manually */
    }
  }

  // Not in a room yet — show create/join choices.
  if (!role) {
    return (
      <div className="panel lobby">
        <p className="tagline">
          Type words to fill your own bucket. First to fill it wins the race! Type a{' '}
          <span className="pill powerup">POWER-UP</span> word to knock a row of marbles
          out of your opponent's bucket and slow them down!
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

          <div className="divider"><span>or</span></div>

          {!showBot ? (
            <button className="btn" onClick={() => setShowBot(true)}>
              🤖 Play vs Bot
            </button>
          ) : (
            <div className="bot-picker">
              <p className="bot-picker-label">Choose a difficulty:</p>
              <div className="difficulty-row">
                {Object.entries(BOT_DIFFICULTY).map(([key, { label }]) => (
                  <button
                    key={key}
                    className="btn"
                    onClick={() => startBotGame(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {errorMsg && <p className="error">{errorMsg}</p>}
      </div>
    )
  }

  // Host is waiting for a guest.
  if (role === 'host') {
    return (
      <div className="panel lobby">
        <h2>Invite a friend</h2>
        <div className="room-code" onClick={copyLink} title="Click to copy the link">
          {roomLink || roomCode}
          <span className="copy-hint">{copied ? '✓ copied' : 'click to copy link'}</span>
        </div>
        <p className="status-line">
          Send this link — they just click it to join. {status === 'connected'
            ? '✅ Friend connected!'
            : '⏳ Waiting for them to join…'}
        </p>
        <p className="code-fallback">Or share the code: <strong>{roomCode}</strong></p>
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
            : '⏳ Connecting… this can take a few seconds.'}
      </p>
      <div className="lobby-actions">
        <button className="btn ghost" onClick={leave}>
          {status === 'error' ? 'Try again' : 'Back'}
        </button>
      </div>
      {errorMsg && <p className="error">{errorMsg}</p>}
    </div>
  )
}
