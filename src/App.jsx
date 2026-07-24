import { useGame } from './hooks/useGame.js'
import Lobby from './components/Lobby.jsx'
import Countdown from './components/Countdown.jsx'
import GameScreen from './components/GameScreen.jsx'
import GameOver from './components/GameOver.jsx'

export default function App() {
  const game = useGame()

  return (
    <div className="app">
      <header className="app-header">
        <h1>🪣 Marble Typing Battle</h1>
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
