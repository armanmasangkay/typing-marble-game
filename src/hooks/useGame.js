import { useCallback, useEffect, useRef, useState } from 'react'
import { NetPeer, generateRoomCode } from '../net/peer.js'
import { nextWord } from '../game/words.js'
import {
  BUCKET_CAPACITY,
  MARBLES_PER_WORD,
  POWERUP_CLEAR,
  COUNTDOWN_SECONDS,
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

  const netRef = useRef(null)
  const myBucketRef = useRef(0)
  const phaseRef = useRef('lobby')

  useEffect(() => { phaseRef.current = phase }, [phase])

  const setMyBucketBoth = useCallback((n) => {
    myBucketRef.current = n
    setMyBucket(n)
  }, [])

  const beginCountdown = useCallback(() => {
    setMyBucketBoth(0)
    setOppBucket(0)
    setResult(null)
    setOpponentLeft(false)
    setWord(null)
    setCountdown(COUNTDOWN_SECONDS)
    setPhase('countdown')
  }, [setMyBucketBoth])

  // Drive the 3-2-1 countdown, then start play.
  useEffect(() => {
    if (phase !== 'countdown') return undefined
    if (countdown <= 0) {
      setWord(nextWord())
      setPhase('playing')
      return undefined
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // --- Networking message handling ---
  const applyIncomingMarbles = useCallback((count) => {
    const net = netRef.current
    const next = myBucketRef.current + count
    if (next >= BUCKET_CAPACITY) {
      setMyBucketBoth(BUCKET_CAPACITY)
      net && net.send({ type: 'state', bucket: BUCKET_CAPACITY })
      net && net.send({ type: 'gameover' })
      setResult('lose')
      setPhase('gameover')
    } else {
      setMyBucketBoth(next)
      net && net.send({ type: 'state', bucket: next })
    }
  }, [setMyBucketBoth])

  const handleMessage = useCallback((msg) => {
    if (!msg || typeof msg !== 'object') return
    switch (msg.type) {
      case 'start':
        beginCountdown()
        break
      case 'marble':
        if (phaseRef.current === 'playing') applyIncomingMarbles(msg.count || 0)
        break
      case 'state':
        setOppBucket(msg.bucket || 0)
        break
      case 'gameover':
        // Opponent's bucket overflowed → we win.
        setResult('win')
        setPhase('gameover')
        break
      case 'rematch':
        if (phaseRef.current === 'gameover') beginCountdown()
        break
      default:
        break
    }
  }, [applyIncomingMarbles, beginCountdown])

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
      console.warn('[mtb-net] join timed out; ICE report:', err && err.ice)
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

  // --- Public actions ---
  const createRoom = useCallback(() => {
    setErrorMsg('')
    const code = generateRoomCode()
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

  // Called when the player finishes typing the current word.
  const completeWord = useCallback(() => {
    const net = netRef.current
    const current = word
    if (!current || phaseRef.current !== 'playing') return
    if (current.powerup) {
      const next = Math.max(0, myBucketRef.current - POWERUP_CLEAR)
      setMyBucketBoth(next)
      net && net.send({ type: 'state', bucket: next })
    } else {
      net && net.send({ type: 'marble', count: MARBLES_PER_WORD })
    }
    setWord(nextWord())
  }, [word, setMyBucketBoth])

  const requestRematch = useCallback(() => {
    const net = netRef.current
    net && net.send({ type: 'rematch' })
    beginCountdown()
  }, [beginCountdown])

  const leave = useCallback(() => {
    const net = netRef.current
    net && net.destroy()
    netRef.current = null
    setPhase('lobby')
    setRole(null)
    setStatus('idle')
    setRoomCode('')
    setMyBucketBoth(0)
    setOppBucket(0)
    setWord(null)
    setResult(null)
    setOpponentLeft(false)
    setErrorMsg('')
  }, [setMyBucketBoth])

  // Clean up the peer connection on unmount.
  useEffect(() => () => {
    const net = netRef.current
    net && net.destroy()
  }, [])

  return {
    phase, role, status, roomCode,
    myBucket, oppBucket, capacity: BUCKET_CAPACITY,
    word, countdown, result, opponentLeft, errorMsg,
    createRoom, joinRoom, startGame, completeWord, requestRematch, leave,
  }
}
