import type {Message, Peer} from 'dash-core-p2p'

// 'static' dials `peers` and nothing else; 'dynamic' augments DNS and gossip
// with whatever the user supplied.
export type PeerMode = 'dynamic' | 'static'

// User-supplied discovery, per network. Empty arrays mean built-in behaviour.
export interface PeerOverrides {
  mode: PeerMode
  dnsSeeds: string[]
  peers: string[]
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