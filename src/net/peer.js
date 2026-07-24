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
  }

  // Host: create a room and wait for a guest to connect.
  host(roomCode) {
    this.isHost = true
    this.roomCode = roomCode
    this.onStatus('connecting')
    this.peer = new Peer(ID_PREFIX + roomCode)

    this.peer.on('open', () => {
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
    this.peer = new Peer() // random id for the guest

    this.peer.on('open', () => {
      const conn = this.peer.connect(ID_PREFIX + roomCode, { reliable: true })
      this.conn = conn
      this._wireConn(conn)
    })
    this.peer.on('error', (err) => this._handleError(err))
    this.peer.on('disconnected', () => {
      try { this.peer.reconnect() } catch { /* noop */ }
    })
  }

  _wireConn(conn) {
    conn.on('open', () => this.onStatus('connected'))
    conn.on('data', (data) => this.onMessage(data))
    conn.on('close', () => this.onStatus('disconnected'))
    conn.on('error', (err) => this._handleError(err))
  }

  _handleError(err) {
    // 'peer-unavailable' means the room code was wrong / host not present.
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
    try { this.conn && this.conn.close() } catch { /* noop */ }
    try { this.peer && this.peer.destroy() } catch { /* noop */ }
    this.conn = null
    this.peer = null
  }
}
