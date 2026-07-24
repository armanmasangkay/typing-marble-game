import { useState } from 'react'
import { useGame } from './hooks/useGame.js'
import Lobby from './components/Lobby.jsx'
import Countdown from './components/Countdown.jsx'
import GameScreen from './components/GameScreen.jsx'
import GameOver from './components/GameOver.jsx'
import { toggleMuted, isMuted, unlockAudio } from './audio/sfx.js'

export default function App() {
  const game = useGame()
  const [muted, setMuted] = useState(isMuted())

  const handleMute = () => {
    unlockAudio() // clicking is a gesture — unlock audio in case it's the first
    setMuted(toggleMuted())
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🪣 Marble Typing Battle</h1>
        <button
          className="mute-btn"
          onClick={handleMute}
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      {game.phase === 'lobby' && <Lobby game={game} />}
      {game.phase === 'countdown' && <Countdown value={game.countdown} />}
      {(game.phase === 'playing' || game.phase === 'gameover') && (
        <GameScreen game={game} />
      )}
      {game.phase === 'gameover' && <GameOver game={game} />}
    </div>
  )
}
