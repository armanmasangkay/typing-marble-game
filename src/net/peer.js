import { Peer } from 'peerjs'

// Thin wrapper around PeerJS for a 1-to-1 game connection.
// Uses the free public PeerJS cloud broker (no API key / no backend of our own).
// The broker is only used to introduce the two browsers; game data then flows
// directly peer-to-peer over a WebRTC data channel.

// Room codes are used directly as the host's PeerJS id, so they must be unique
// enough to avoid collisions on the shared public broker. We prefix them to
// reduce the chance of clashing with other apps using the same broker.
const ID_PREFIX = 'mtb-' // marble typing battle

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no easily-confused chars

// Public STUN servers help browsers discover their public address for NAT
// traversal. Listing several gives more resilience if one is unreachable.
// NOTE: these are STUN only — there is no TURN relay, so peers behind a strict
// (symmetric) NAT or restrictive firewall can still fail to connect. Adding a
// TURN server is the follow-up if cross-network joins keep failing.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

const PEER_OPTS = { config: { iceServers: ICE_SERVERS } }

// How long to wait, in ms, before giving up on a stalled connection attempt.
const BROKER_TIMEOUT_MS = 10000 // peer never registers with the broker
const CONNECT_TIMEOUT_MS = 12000 // broker reached, but data channel never opens

export function generateRoomCode(len = 5) {
  let code = ''
  for (let i = 0; i < len; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}

// Callbacks: { onStatus(status), onMessage(msg), onError(err) }
// status is one of: 'connecting' | 'waiting' | 'connected' | 'disconnected' | 'error'
export class NetPeer {
  constructor({ onStatus, onMessage, onError } = {}) {
    this.onStatus = onStatus || (() => {})
    this.onMessage = onMessage || (() => {})
    this.onError = onError || (() => {})
    this.peer = null
    this.conn = null
    this.isHost = false
    this.roomCode = null
    this.brokerTimer = null // fires if our peer never registers with the broker
    this.connectTimer = null // fires if the data channel never opens (guest)
  }

  // Host: create a room and wait for a guest to connect.
  host(roomCode) {
    this.isHost = true
    this.roomCode = roomCode
    this.onStatus('connecting')
    this.peer = new Peer(ID_PREFIX + roomCode, PEER_OPTS)

    // If the broker never confirms our id, surface a clear error instead of
    // sitting in 'connecting' forever.
    this.brokerTimer = setTimeout(
      () => this._handleError({ type: 'broker-unreachable' }),
      BROKER_TIMEOUT_MS,
    )

    this.peer.on('open', () => {
      this._clearBrokerTimer()
      this.onStatus('waiting')
    })
    this.peer.on('connection', (conn) => {
      this.conn = conn
      this._wireConn(conn)
    })
    this.peer.on('error', (err) => this._handleError(err))
    this.peer.on('disconnected', () => {
      // Lost connection to the broker; the data channel may still be alive.
      try { this.peer.reconnect() } catch { /* noop */ }
    })
  }

  // Guest: join an existing room by code.
  join(roomCode) {
    this.isHost = false
    this.roomCode = roomCode
    this.onStatus('connecting')
    this.peer = new Peer(undefined, PEER_OPTS) // random id for the guest

    // Two separate stalls to guard against: (1) our own peer never opening
    // (broker unreachable), and (2) the peer opening but the data channel to
    // the host never completing (host absent, or NAT traversal failed).
    this.brokerTimer = setTimeout(
      () => this._handleError({ type: 'broker-unreachable' }),
      BROKER_TIMEOUT_MS,
    )

    this.peer.on('open', () => {
      this._clearBrokerTimer()
      const conn = this.peer.connect(ID_PREFIX + roomCode, { reliable: true })
      this.conn = conn
      this._wireConn(conn)
      this.connectTimer = setTimeout(
        () => this._handleError({ type: 'timeout' }),
        CONNECT_TIMEOUT_MS,
      )
    })
    this.peer.on('error', (err) => this._handleError(err))
    this.peer.on('disconnected', () => {
      try { this.peer.reconnect() } catch { /* noop */ }
    })
  }

  _wireConn(conn) {
    conn.on('open', () => {
      this._clearConnectTimer()
      this.onStatus('connected')
    })
    conn.on('data', (data) => this.onMessage(data))
    conn.on('close', () => this.onStatus('disconnected'))
    conn.on('error', (err) => this._handleError(err))
  }

  _clearBrokerTimer() {
    if (this.brokerTimer) { clearTimeout(this.brokerTimer); this.brokerTimer = null }
  }

  _clearConnectTimer() {
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null }
  }

  _handleError(err) {
    // 'peer-unavailable' means the room code was wrong / host not present.
    this._clearBrokerTimer()
    this._clearConnectTimer()
    this.onError(err)
    this.onStatus('error')
  }

  send(msg) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg)
      return true
    }
    return false
  }

  destroy() {
    this._clearBrokerTimer()
    this._clearConnectTimer()
    try { this.conn && this.conn.close() } catch { /* noop */ }
    try { this.peer && this.peer.destroy() } catch { /* noop */ }
    this.conn = null
    this.peer = null
  }
}
