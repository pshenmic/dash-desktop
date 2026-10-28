import type {Message, MnListDiff, Peer} from 'dash-core-p2p'
import {MNLIST_REFRESH_MS, MNLIST_REPLY_TIMEOUT_MS, PLATFORM_QUORUM_PEERS} from '../constants'
import {wireToDisplayHex} from '../utils/byteOrder'
import {committedQuorums, evonodeDapiUrls, quorumKey} from '../utils/masternodeList'
import {hashHeaderRaw} from '../utils/pow'
import type {MasternodeListOptions, QuorumSet} from '../types/masternodeList'
import {Logger} from '../../src/utils/logger'

const log = new Logger('p2p')

// The evonodes platform requests go to, refreshed hourly from a full list, and the
// quorum keys its proofs are checked with, followed block by block.
export class MasternodeList {
  private verifiedAt = 0
  private askedAt = 0
  private retry: ReturnType<typeof setTimeout> | null = null
  private quorums: QuorumSet | null = null

  constructor(private readonly opts: MasternodeListOptions) {}

  // A new lock pool may be on another network, so its list is fetched afresh.
  resetPool(): void {
    this.verifiedAt = 0
    this.askedAt = 0
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
  }

  // A peer is asked for a block it announced itself, so it always holds it; a reply
  // is checked against its own coinbase, so the first verified one wins.
  onBlockAnnounced(peer: Peer, blockHash: string): void {
    const now = Date.now()
    if (now - this.verifiedAt < MNLIST_REFRESH_MS || now - this.askedAt < MNLIST_REPLY_TIMEOUT_MS) return
    this.ask(peer, blockHash)
  }

  // Many peers never answer getmnlistd, and waiting for the next announcement
  // leaves platform requests without evonodes for minutes.
  private ask(peer: Peer, blockHash: string): void {
    const pool = this.opts.pool()
    if (!pool) return
    this.askedAt = Date.now()
    log.info(`asking ${peer.host}:${peer.port} for the masternode list at ${blockHash}`)
    peer.sendMessage(pool.messages.GetMnListDiff({blockHash}))

    if (this.retry) clearTimeout(this.retry)
    this.retry = setTimeout(() => {
      this.retry = null
      const others = [...this.opts.pool()?.readyPeers ?? []].filter(ready => ready !== peer)
      if (Date.now() - this.verifiedAt < MNLIST_REFRESH_MS || others.length === 0) return
      this.ask(others[Math.floor(Math.random() * others.length)]!, blockHash)
    }, MNLIST_REPLY_TIMEOUT_MS)
  }

  // Core opens every connection with a getheaders whose locator starts at its tip.
  // A peer still syncing would name a block long buried, so only the highest count.
  onPeerTip = (peer: Peer, msg: Message & {starts?: Uint8Array[]}): void => {
    const best = Math.max(...[...this.opts.pool()?.readyPeers ?? []].map(ready => ready.bestHeight ?? 0))
    const tip = msg.starts?.[0]
    if (tip != null && (peer.bestHeight ?? 0) >= best) this.onBlockAnnounced(peer, wireToDisplayHex(tip))
  }

  onDiff = (peer: Peer, msg: Message & {mnlistdiff?: MnListDiff}): void => {
    const pool = this.opts.pool()
    const diff = msg.mnlistdiff
    if (!pool || diff == null) return
    this.applyQuorums(peer, diff).catch(err => log.warn(`quorums from ${peer.host}:${peer.port} failed:`, err))
    // Only a full list carries every evonode, and a peer answering after the
    // list verified would only repeat it.
    if (/[^0]/.test(diff.baseBlockHash) || Date.now() - this.verifiedAt < MNLIST_REFRESH_MS) return
    const dapiUrls = evonodeDapiUrls(diff)
    if (dapiUrls == null) {
      log.warn(`${peer.host}:${peer.port} sent a masternode list its coinbase does not commit to`)
      this.askedAt = 0
      return
    }
    this.verifiedAt = Date.now()
    log.info(`masternode list at ${diff.blockHash} from ${peer.host}:${peer.port}: ${dapiUrls.length} evonode DAPI url(s)`)
    this.opts.events.evonodeDapiUrls(pool.network, dapiUrls)
  }

  // A diff from the last verified quorum set, so following the tip costs a few KB a block.
  followTip(blockHash: string): void {
    const pool = this.opts.pool()
    if (!pool) return
    const request = pool.messages.GetMnListDiff({baseBlockHash: this.quorums?.blockHash, blockHash})
    const peers = [...pool.readyPeers]
    for (let i = 0; i < PLATFORM_QUORUM_PEERS && peers.length > 0; i++) {
      peers.splice(Math.floor(Math.random() * peers.length), 1)[0]!.sendMessage(request)
    }
  }

  // Core refuses, and scores, a diff based on a block off its active chain.
  rewound(height: number): void {
    if (this.quorums != null && this.quorums.height > height) this.quorums = null
  }

  closeChain(): void {
    const store = this.opts.chain()
    if (store && this.quorums) this.opts.events.platformQuorums(store.network, new Map())
    this.quorums = null
  }

  // Quorums are trusted only at a block on our own header chain: its work vouches
  // for the coinbase, and the coinbase for the commitments.
  private async applyQuorums(peer: Peer, diff: MnListDiff): Promise<void> {
    const store = this.opts.chain()
    const height = diff.coinbaseHeight
    if (store == null || height == null) return
    const header = await store.getHeaderByHeight(height)
    const current = this.quorums
    if (header == null || hashHeaderRaw(header) !== diff.blockHash || store !== this.opts.chain() || height <= (current?.height ?? 0)) return
    const commitments = committedQuorums(diff, header, diff.baseBlockHash === current?.blockHash ? current.commitments : [])
    if (commitments == null) {
      log.warn(`${peer.host}:${peer.port} sent quorums block ${height} does not commit to`)
      return
    }
    this.quorums = {blockHash: diff.blockHash, height, commitments}
    this.opts.events.platformQuorums(store.network, new Map(commitments.map(quorum =>
      [quorumKey(quorum), Uint8Array.from(Buffer.from(quorum.quorumPublicKey, 'hex'))])))
  }
}
