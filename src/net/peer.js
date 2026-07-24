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

// Optional TURN relay, enabled purely by env — no behavior change when unset.
// TURN relays traffic through a server when direct P2P fails (strict/symmetric
// NAT, UDP-blocking firewalls), so it's the real fix for those cross-network
// join failures. To enable, set VITE_TURN_URL (+ username/credential) in the
// deploy env. VITE_TURN_URL may be a comma-separated list so a plain UDP entry
// and a TLS/443 fallback (for the strictest firewalls) share one credential.
// A free, no-signup starting point is Metered Open Relay, e.g.:
//   VITE_TURN_URL=turn:openrelay.metered.ca:80,turns:openrelay.metered.ca:443?transport=tcp
//   VITE_TURN_USERNAME=openrelayproject
//   VITE_TURN_CREDENTIAL=openrelayproject
// Whether a TURN relay was actually inlined into this build. This is the single
// source of truth for distinguishing "TURN not deployed" from "TURN deployed but
// the relay candidate never gathered" — it reflects the running build, not the repo.
let TURN_CONFIGURED = false
if (import.meta.env.VITE_TURN_URL) {
  const urls = import.meta.env.VITE_TURN_URL.split(',')
    .map((u) => u.trim())
    .filter(Boolean)
  if (urls.length) {
    ICE_SERVERS.push({
      urls, // one credential can cover several TURN transports
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    })
    TURN_CONFIGURED = true
  }
}

const PEER_OPTS = { config: { iceServers: ICE_SERVERS } }

// Verbose ICE logging for diagnosing connection failures. On in dev; in a
// deployed build, turn on per-browser with localStorage.mtb-netdebug = '1'.
const NET_DEBUG =
  import.meta.env.DEV ||
  (typeof localStorage !== 'undefined' &&
    localStorage.getItem('mtb-netdebug') === '1')

function netLog(...args) {
  if (NET_DEBUG) console.log('[mtb-net]', ...args)
}

// Log, from the running build, whether TURN was inlined. On the live site this
// answers "did my Vercel env vars actually reach this deployment?" without guessing:
// enable with localStorage.mtb-netdebug = '1' and reload.
netLog('TURN configured:', TURN_CONFIGURED, '| ICE servers:', ICE_SERVERS.length)

// Pull the candidate type (host / srflx / prflx / relay) out of an SDP
// candidate line, which looks like "candidate:... typ srflx ...".
function candidateType(candidate) {
  if (!candidate) return 'unknown'
  const m = /\btyp (\w+)/.exec(candidate)
  return m ? m[1] : 'unknown'
}

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
    this.iceReport = null // last-seen ICE diagnostics (for failure analysis)
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
        () => this._handleError({ type: 'timeout', ice: this._iceSummary() }),
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
    this._attachIceDiagnostics(conn)
  }

  // Watch the underlying RTCPeerConnection so a failed join can be diagnosed:
  // did we gather a server-reflexive (STUN) candidate? did ICE ever leave
  // 'new'/'checking'? Findings are logged (when NET_DEBUG) and stashed on
  // this.iceReport so _handleError can attach them to a timeout error.
  _attachIceDiagnostics(conn) {
    const report = {
      role: this.isHost ? 'host' : 'guest',
      localCandidateTypes: {},
      iceConnectionState: null,
      iceGatheringState: null,
      // Gathering errors keyed by the STUN/TURN server that failed. This is the
      // signal that explains a missing relay: TURN auth failures show up here as
      // errorCode 401/403, and an unreachable relay as 701 / a timeout.
      turnErrors: [],
    }
    this.iceReport = report

    // conn.peerConnection can be null for a moment after connect(); poll briefly.
    let tries = 0
    const attach = () => {
      const pc = conn.peerConnection
      if (!pc) {
        if (tries++ < 40) setTimeout(attach, 100) // up to ~4s
        return
      }
      report.iceConnectionState = pc.iceConnectionState
      report.iceGatheringState = pc.iceGatheringState

      pc.addEventListener('icecandidate', (e) => {
        if (!e.candidate) return
        const type = candidateType(e.candidate.candidate)
        report.localCandidateTypes[type] =
          (report.localCandidateTypes[type] || 0) + 1
        netLog('local ICE candidate:', type)
      })
      // Why a candidate failed to gather. Without this we only see that a relay
      // is *absent*, not whether the TURN server rejected our credentials
      // (401/403) or was simply unreachable (701 / timeout). errorCode 701 for a
      // STUN server is benign noise, so only the TURN errors are actionable.
      pc.addEventListener('icecandidateerror', (e) => {
        const entry = {
          url: e.url,
          errorCode: e.errorCode,
          errorText: e.errorText,
          address: e.address,
          port: e.port,
        }
        report.turnErrors.push(entry)
        netLog('ICE candidate error:', entry)
      })
      pc.addEventListener('iceconnectionstatechange', () => {
        report.iceConnectionState = pc.iceConnectionState
        netLog('iceConnectionState ->', pc.iceConnectionState)
        // Capture the full summary on failure too (not just the guest timeout),
        // so host-side and non-timeout failures are inspectable.
        if (pc.iceConnectionState === 'failed') {
          netLog('ICE failed; summary:', this._iceSummary())
        }
      })
      pc.addEventListener('icegatheringstatechange', () => {
        report.iceGatheringState = pc.iceGatheringState
        netLog('iceGatheringState ->', pc.iceGatheringState)
      })
    }
    attach()
  }

  // Snapshot of the ICE report for logging/attaching to an error.
  _iceSummary() {
    if (!this.iceReport) return null
    const types = Object.keys(this.iceReport.localCandidateTypes)
    return {
      ...this.iceReport,
      localCandidateTypes: { ...this.iceReport.localCandidateTypes },
      turnErrors: [...(this.iceReport.turnErrors || [])],
      gotSrflx: types.includes('srflx'),
      gotRelay: types.includes('relay'),
      turnConfigured: TURN_CONFIGURED,
    }
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
    netLog('error:', err && err.type, 'ice:', this._iceSummary())
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
