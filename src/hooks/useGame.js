import { useCallback, useEffect, useRef, useState } from 'react'
import { NetPeer, generateRoomCode } from '../net/peer.js'
import { BotNet } from '../net/botNet.js'
import { nextWord } from '../game/words.js'
import { playCountdown, playGo, playWin, playLose, playPop } from '../audio/sfx.js'
import {
  BUCKET_CAPACITY,
  MARBLES_PER_WORD,
  COUNTDOWN_SECONDS,
  topRowCount,
} from '../game/constants.js'

// phase: 'lobby' | 'countdown' | 'playing' | 'gameover'
export function useGame() {
  const [phase, setPhase] = useState('lobby')
  const [role, setRole] = useState(null) // 'host' | 'guest'
  const [status, setStatus] = useState('idle') // connection status from NetPeer
  const [roomCode, setRoomCode] = useState('')
  const [myBucket, setMyBucket] = useState(0)
  const [oppBucket, setOppBucket] = useState(0)
  const [word, setWord] = useState(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [result, setResult] = useState(null) // 'win' | 'lose'
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  // Rematch is mutual: a new match only begins once BOTH players have opted in.
  // myRematch = this client asked; oppRematch = the opponent asked.
  const [myRematch, setMyRematch] = useState(false)
  const [oppRematch, setOppRematch] = useState(false)
  // Bumped each time an opponent power-up knocks a row out of YOUR bucket, so
  // the "You" bucket can play the pop/burst animation. The count of marbles
  // removed rides along so the burst spawns the right number of pieces.
  const [myPop, setMyPop] = useState({ n: 0, removed: 0 })

  const netRef = useRef(null)
  const myBucketRef = useRef(0)
  const phaseRef = useRef('lobby')
  const roleRef = useRef(null)
  const autoJoinedRef = useRef(false)
  // Mirror the rematch opt-ins into refs so async message handlers read the
  // current values without stale closures (same pattern as phaseRef above).
  const myRematchRef = useRef(false)
  const oppRematchRef = useRef(false)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { roleRef.current = role }, [role])

  const setMyRematchBoth = useCallback((v) => {
    myRematchRef.current = v
    setMyRematch(v)
  }, [])

  const setOppRematchBoth = useCallback((v) => {
    oppRematchRef.current = v
    setOppRematch(v)
  }, [])

  const setMyBucketBoth = useCallback((n) => {
    myBucketRef.current = n
    setMyBucket(n)
  }, [])

  const beginCountdown = useCallback(() => {
    setMyBucketBoth(0)
    setOppBucket(0)
    setResult(null)
    setOpponentLeft(false)
    setMyRematchBoth(false)
    setOppRematchBoth(false)
    setWord(null)
    setMyPop({ n: 0, removed: 0 })
    setCountdown(COUNTDOWN_SECONDS)
    setPhase('countdown')
  }, [setMyBucketBoth, setMyRematchBoth, setOppRematchBoth])

  // Both players have opted into a rematch — start a fresh match. The HOST is
  // authoritative: it broadcasts the go-signal and starts locally, so both sides
  // begin from one message and can't race into two countdowns. The guest waits
  // for the incoming 'rematchStart' instead.
  const maybeStartRematch = useCallback(() => {
    if (!(myRematchRef.current && oppRematchRef.current)) return
    if (roleRef.current !== 'host') return
    const net = netRef.current
    net && net.send({ type: 'rematchStart' })
    beginCountdown()
  }, [beginCountdown])

  // Drive the 3-2-1 countdown, then start play.
  useEffect(() => {
    if (phase !== 'countdown') return undefined
    if (countdown <= 0) {
      playGo()
      setWord(nextWord())
      setPhase('playing')
      return undefined
    }
    playCountdown()
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // Win/lose chimes whenever a result is decided.
  useEffect(() => {
    if (result === 'win') playWin()
    else if (result === 'lose') playLose()
  }, [result])

  // --- Networking message handling ---
  // The opponent typed a power-up word: knock our top visible row of marbles
  // out. We're authoritative over our own count, so we compute the row size
  // here, remove it, play the pop feedback, and echo our new total back.
  const applyIncomingClear = useCallback(() => {
    const net = netRef.current
    const removed = topRowCount(myBucketRef.current)
    if (removed <= 0) return
    const next = myBucketRef.current - removed
    setMyBucketBoth(next)
    net && net.send({ type: 'state', bucket: next })
    playPop()
    setMyPop((p) => ({ n: p.n + 1, removed }))
  }, [setMyBucketBoth])

  const handleMessage = useCallback((msg) => {
    if (!msg || typeof msg !== 'object') return
    switch (msg.type) {
      case 'start':
        beginCountdown()
        break
      case 'clearRow':
        if (phaseRef.current === 'playing') applyIncomingClear()
        break
      case 'state':
        setOppBucket(msg.bucket || 0)
        break
      case 'gameover':
        // Opponent filled their bucket first → we lose the race.
        setResult('lose')
        setPhase('gameover')
        break
      case 'rematch':
        // Opponent wants a rematch. Record their opt-in; only actually start
        // once we've opted in too (host fires the go-signal in maybeStartRematch).
        if (phaseRef.current === 'gameover') {
          setOppRematchBoth(true)
          maybeStartRematch()
        }
        break
      case 'rematchCancel':
        setOppRematchBoth(false)
        break
      case 'rematchStart':
        // Host confirmed both sides are in — guest starts the new match.
        beginCountdown()
        break
      default:
        break
    }
  }, [applyIncomingClear, beginCountdown, maybeStartRematch, setOppRematchBoth])

  const handleStatus = useCallback((s) => {
    setStatus(s)
    if (s === 'disconnected' &&
        (phaseRef.current === 'playing' || phaseRef.current === 'countdown')) {
      setOpponentLeft(true)
    }
  }, [])

  const handleError = useCallback((err) => {
    const code = err && err.type
    if (code === 'peer-unavailable') {
      setErrorMsg('No game found with that code. Check the code and try again.')
    } else if (code === 'unavailable-id') {
      setErrorMsg('That room code is already in use. Try creating a new game.')
    } else if (code === 'timeout') {
      // Log ICE diagnostics so a reproduction with devtools open reveals
      // whether this is a NAT-traversal failure (see src/net/peer.js).
      const ice = err && err.ice
      console.warn('[mtb-net] join timed out; ICE report:', ice)
      // Developer-facing hint: the relay-path story behind the timeout.
      if (ice && ice.turnConfigured === false) {
        console.warn(
          '[mtb-net] No TURN relay in this build (turnConfigured=false). ' +
          'Set VITE_TURN_* in the deploy env and redeploy — see .env.example.',
        )
      } else if (ice && ice.turnConfigured && !ice.gotRelay) {
        console.warn(
          '[mtb-net] TURN is configured but no relay candidate gathered ' +
          '(gotRelay=false). The relay is likely unreachable — try dedicated ' +
          'TURN credentials.',
        )
      }
      // Player-facing copy stays friendly regardless of the underlying cause.
      setErrorMsg(
        "Couldn't reach your friend's game. Make sure the code is right and " +
        "they're still on the waiting screen, then try again.",
      )
    } else if (code === 'broker-unreachable') {
      setErrorMsg(
        "Couldn't connect to the matchmaking server. Check your internet and " +
        'try again in a moment.',
      )
    } else {
      setErrorMsg('Connection problem. Please try again.')
    }
  }, [])

  const makeNet = useCallback(() => {
    const net = new NetPeer({
      onStatus: handleStatus,
      onMessage: handleMessage,
      onError: handleError,
    })
    netRef.current = net
    return net
  }, [handleStatus, handleMessage, handleError])

  const makeBotNet = useCallback((difficulty) => {
    const net = new BotNet({
      onStatus: handleStatus,
      onMessage: handleMessage,
      onError: handleError,
      difficulty,
    })
    netRef.current = net
    return net
  }, [handleStatus, handleMessage, handleError])

  // --- Public actions ---
  const createRoom = useCallback(() => {
    setErrorMsg('')
    const code = generateRoomCode()
    // Mark auto-join as handled so writing the code into our own URL below can't
    // later make the host try to join its own room.
    autoJoinedRef.current = true
    setRole('host')
    setRoomCode(code)
    makeNet().host(code)
  }, [makeNet])

  const joinRoom = useCallback((code) => {
    setErrorMsg('')
    const clean = (code || '').trim().toUpperCase()
    if (!clean) {
      setErrorMsg('Enter a room code first.')
      return
    }
    setRole('guest')
    setRoomCode(clean)
    makeNet().join(clean)
  }, [makeNet])

  const startGame = useCallback(() => {
    const net = netRef.current
    if (!net) return
    net.send({ type: 'start' })
    beginCountdown()
  }, [beginCountdown])

  // Single-player: spin up a bot opponent and start immediately — no room code,
  // no peer to wait for.
  const startBotGame = useCallback((difficulty) => {
    setErrorMsg('')
    setRole('solo')
    setRoomCode('')
    const net = makeBotNet(difficulty)
    net.send({ type: 'start' })
    beginCountdown()
  }, [makeBotNet, beginCountdown])

  // Called when the player finishes typing the current word.
  const completeWord = useCallback(() => {
    const net = netRef.current
    const current = word
    if (!current || phaseRef.current !== 'playing') return
    if (current.powerup) {
      // Offensive: knock a row out of the opponent's bucket. Our own bucket is
      // unchanged; the opponent removes its top row and echoes back its total.
      net && net.send({ type: 'clearRow' })
    } else {
      // Add marbles to OUR bucket. First to fill wins the race.
      const next = Math.min(BUCKET_CAPACITY, myBucketRef.current + MARBLES_PER_WORD)
      setMyBucketBoth(next)
      net && net.send({ type: 'state', bucket: next })
      if (next >= BUCKET_CAPACITY) {
        net && net.send({ type: 'gameover' })
        setResult('win')
        setPhase('gameover')
        return
      }
    }
    setWord(nextWord())
  }, [word, setMyBucketBoth])

  // Also serves as the "accept" action when the opponent already asked.
  const requestRematch = useCallback(() => {
    const net = netRef.current
    // Single-player: the bot can't agree, so keep the instant restart.
    if (roleRef.current === 'solo') {
      net && net.send({ type: 'rematch' })
      beginCountdown()
      return
    }
    // Multiplayer: opt in and tell the opponent. The match only begins once both
    // sides have opted in (checked here in case they already did).
    setMyRematchBoth(true)
    net && net.send({ type: 'rematch' })
    maybeStartRematch()
  }, [beginCountdown, maybeStartRematch, setMyRematchBoth])

  const cancelRematch = useCallback(() => {
    const net = netRef.current
    setMyRematchBoth(false)
    net && net.send({ type: 'rematchCancel' })
  }, [setMyRematchBoth])

  const leave = useCallback(() => {
    const net = netRef.current
    net && net.destroy()
    netRef.current = null
    // Drop any join code from the URL so a refresh or "Back" doesn't re-trigger
    // auto-join into the room we just left.
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    setPhase('lobby')
    setRole(null)
    setStatus('idle')
    setRoomCode('')
    setMyBucketBoth(0)
    setOppBucket(0)
    setWord(null)
    setResult(null)
    setOpponentLeft(false)
    setMyRematchBoth(false)
    setOppRematchBoth(false)
    setErrorMsg('')
  }, [setMyBucketBoth, setMyRematchBoth, setOppRematchBoth])

  // Clean up the peer connection on unmount.
  useEffect(() => () => {
    const net = netRef.current
    net && net.destroy()
  }, [])

  // If the app was opened via a share link (e.g. /#ABCDE), pull the code out of
  // the hash and join automatically — the friend clicks the link and lands
  // straight on the guest "Connecting…" screen with no code to type. Runs once.
  useEffect(() => {
    if (autoJoinedRef.current) return
    autoJoinedRef.current = true
    if (typeof window === 'undefined') return
    const code = window.location.hash.replace(/^#/, '').trim()
    if (code) joinRoom(code)
  }, [joinRoom])

  // Full shareable URL for the current room (host side). Empty until a room
  // code exists.
  const roomLink = roomCode && typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}#${roomCode}`
    : ''

  return {
    phase, role, status, roomCode, roomLink,
    myBucket, oppBucket, capacity: BUCKET_CAPACITY,
    word, countdown, result, opponentLeft, errorMsg, myPop,
    myRematch, oppRematch,
    createRoom, joinRoom, startGame, startBotGame, completeWord,
    requestRematch, cancelRematch, leave,
  }
}
