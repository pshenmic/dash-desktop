import type {Message, Peer} from 'dash-core-p2p'
import type {PeerRegistry} from '../net/peerRegistry'

// 'static' dials `peers` and nothing else; 'dynamic' augments DNS and gossip
// with whatever the user supplied.
export type PeerMode = 'dynamic' | 'static'

// User-supplied discovery, per network. Empty arrays mean built-in behaviour.
export interface PeerOverrides {
  mode: PeerMode
  dnsSeeds: string[]
  peers: string[]
  banned: string[]
}

// One connected peer, as the getPeers endpoint reports it. `pingMs` is null
// until a pong has been measured, `userAgent` until the version handshake lands.
export interface PeerInfo {
  // Which pool holds it — in dynamic mode two pools dial different peers.
  pool: string
  host: string
  port: number
  userAgent: string | null
  pingMs: number | null
}

export interface PoolServiceOptions {
  // Replaces the network's built-in seeds when non-empty.
  dnsSeeds?: string[]
  // Dialled on start, in addition to whatever discovery finds.
  peers?: string[]
  // false drops the tx inv stream — and with it ISLOCK/ISDLOCK inv, so only a
  // pool that never needs lock detection may set it.
  relay?: boolean
  dnsSeed?: boolean
  // Dial `peers` and nothing else: DNS is off and gossiped addresses are
  // neither recorded nor dialled, so the pool stays exactly what the user named.
  staticPeers?: boolean
  // Shared between the pools of one process so a node is dialled by one of
  // them, never both.
  registry?: PeerRegistry
  // Entries the pool refuses, as `host` or `host:port`. Replaced live by
  // setBanned rather than read once, so a ban does not rebuild the pool.
  banned?: string[]
  // Prefixes this pool's logs. Two pools log the same lines otherwise.
  label?: string
  readyPeers?: number
  minPeers?: number
  maxConnections?: number
}

export interface PoolServiceEventMap {
  peerconnect: (peer: Peer) => void
  peerready: (peer: Peer) => void
  peerdisconnect: (peer: Peer) => void
  peerversion: (peer: Peer, message: Message & { services?: bigint }) => void
  peerheaders: (peer: Peer, message: Message & { headers?: Uint8Array[] }) => void
  peerinv: (peer: Peer, message: Message & { inventory?: Array<{ type: number; hash: Uint8Array }> }) => void
  peeraddr: (peer: Peer, message: Message & { addresses?: unknown[] }) => void
  peerping: (peer: Peer, message: Message) => void
  peerpong: (peer: Peer, message: Message) => void
  peerblock: (peer: Peer, message: Message & { block?: unknown }) => void
  peercfcheckpt: (peer: Peer, message: Message) => void
  peercfheaders: (peer: Peer, message: Message) => void
  peercfilter: (peer: Peer, message: Message) => void
  peerislock: (peer: Peer, message: Message & { txid?: string }) => void
  peertx: (peer: Peer, message: Message & { transaction?: unknown }) => void
  peerisdlock: (peer: Peer, message: Message & { txid?: string }) => void
  peerclsig: (peer: Peer, message: Message & { height?: number; blockHash?: string }) => void
  seederror: (err: Error) => void
}