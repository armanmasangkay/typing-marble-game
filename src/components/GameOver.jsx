export default function GameOver({ game }) {
  const {
    result, requestRematch, cancelRematch, leave,
    opponentLeft, myRematch, oppRematch,
  } = game
  const won = result === 'win'

  return (
    <div className="overlay">
      <div className={`overlay-box ${won ? 'win' : 'lose'}`}>
        <h2>{won ? '🏆 You Win!' : '💀 You Lose!'}</h2>
        <p>{won ? 'You filled your bucket first!' : 'Your opponent filled their bucket first.'}</p>
        <div className="lobby-actions">
          {!opponentLeft && (
            myRematch ? (
              // We've asked and are waiting for the opponent to agree.
              <>
                <button className="btn primary big" disabled>Waiting for opponent…</button>
                <button className="btn ghost" onClick={cancelRematch}>Cancel</button>
              </>
            ) : oppRematch ? (
              // Opponent asked first — this button accepts.
              <button className="btn primary big" onClick={requestRematch}>
                Opponent wants a rematch — Accept
              </button>
            ) : (
              <button className="btn primary big" onClick={requestRematch}>Rematch</button>
            )
          )}
          <button className="btn ghost" onClick={leave}>Back to menu</button>
        </div>
      </div>
    </div>
  )
}
