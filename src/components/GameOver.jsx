export default function GameOver({ game }) {
  const { result, requestRematch, leave, opponentLeft } = game
  const won = result === 'win'

  return (
    <div className="overlay">
      <div className={`overlay-box ${won ? 'win' : 'lose'}`}>
        <h2>{won ? '🏆 You Win!' : '💀 You Lose!'}</h2>
        <p>{won ? 'Your opponent’s bucket overflowed.' : 'Your bucket overflowed.'}</p>
        <div className="lobby-actions">
          {!opponentLeft && (
            <button className="btn primary big" onClick={requestRematch}>Rematch</button>
          )}
          <button className="btn ghost" onClick={leave}>Back to menu</button>
        </div>
      </div>
    </div>
  )
}
