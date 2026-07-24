import Bucket from './Bucket.jsx'
import WordPrompt from './WordPrompt.jsx'

export default function GameScreen({ game }) {
  const {
    myBucket, oppBucket, capacity, word, phase, completeWord, opponentLeft, myPop,
  } = game

  return (
    <div className="panel game">
      {phase === 'playing' && (
        <p className="game-helper">
          ⌨️ Type words to fill <strong>your</strong> bucket — first to fill it wins!
          A ⚡ power-up word knocks a row of marbles out of your opponent's bucket.
        </p>
      )}
      <div className="buckets">
        <Bucket label="You" count={myBucket} capacity={capacity} mine pop={myPop} />
        <div className="vs">VS</div>
        <Bucket label="Opponent" count={oppBucket} capacity={capacity} />
      </div>

      {phase === 'playing' && (
        <WordPrompt word={word} onComplete={completeWord} disabled={opponentLeft} />
      )}

      {opponentLeft && (
        <div className="overlay">
          <div className="overlay-box">
            <h2>Opponent disconnected</h2>
            <p>They left the game or lost connection.</p>
            <button className="btn primary" onClick={game.leave}>Back to menu</button>
          </div>
        </div>
      )}
    </div>
  )
}
