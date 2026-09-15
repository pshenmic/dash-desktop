import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {CheckpointAnchors} from '../../src/main/p2p/sync/checkpointAnchors'
import {PeerRotation} from '../../src/main/p2p/net/peerRotation'
import {
  CFCHECKPT_AGREE_PEERS,
  CFCHECKPT_RACE_TIMEOUT_MS,
  HASH_LEN,
} from '../../src/main/p2p/constants'
import type {CFCheckptArgs, Peer} from 'dash-core-p2p'

// floor(SCAN_TIP / 1000) * 1000, so the stop hash covers exactly two anchors.
const SCAN_TIP = 2_999
const STOP_HEIGHT = 2_000
const ANCHORS = STOP_HEIGHT / 1000

const makePeer = (host: string): Peer =>
  ({host, port: 19999, sendMessage: () => undefined} as unknown as Peer)

// Distinct per seed, so two peers' answers differ exactly when their seeds do.
const answer = (seed: number, count = ANCHORS): Uint8Array[] =>
  Array.from({length: count}, (_, i) => new Uint8Array(HASH_LEN).fill(seed + i))

describe('CheckpointAnchors', () => {
  let peers: Peer[]
  let rotation: PeerRotation
  let anchors: CheckpointAnchors
  let ready: Array<{headers: Uint8Array[]; peer: Peer}>

  const receive = (from: Peer, filterHeaders: Uint8Array[]): void => {
    anchors.receive({filterHeaders} as unknown as CFCheckptArgs, from)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    peers = [makePeer('1.1.1.1'), makePeer('2.2.2.2'), makePeer('3.3.3.3')]
    rotation = new PeerRotation(() => peers)
    ready = []
    anchors = new CheckpointAnchors({
      rotation,
      messages: {GetCFCheckpt: () => ({command: 'getcfcheckpt'})},
      stopHashAt: (height: number) =>
        height > 0 && height % 1000 === 0 ? new Uint8Array(HASH_LEN) : undefined,
      onReady: (headers, peer) => ready.push({headers, peer}),
      poolCanGrow: () => true,
    })
    expect(anchors.request(SCAN_TIP)).toBe(true)
  })

  afterEach(() => {
    anchors.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // An empty vector used to be accepted, and every check below this class then
  // compared against nothing and passed — the whole filter-header chain was
  // taken from whoever answered.
  it('refuses an empty answer', () => {
    receive(peers[0]!, [])
    receive(peers[1]!, [])

    expect(ready).toEqual([])
    expect(anchors.has(1000)).toBe(false)
  })

  it('refuses an answer shorter than the stop hash covers', () => {
    receive(peers[0]!, answer(1, ANCHORS - 1))
    receive(peers[1]!, answer(1, ANCHORS - 1))

    expect(ready).toEqual([])
  })

  it('refuses an answer whose entries are not filter headers', () => {
    const stunted = [new Uint8Array(HASH_LEN), new Uint8Array(4)]
    receive(peers[0]!, stunted)
    receive(peers[1]!, stunted)

    expect(ready).toEqual([])
  })

  it('waits for a second peer before confirming one answer', () => {
    receive(peers[0]!, answer(1))

    expect(CFCHECKPT_AGREE_PEERS).toBeGreaterThan(1)
    expect(ready).toEqual([])
    expect(anchors.has(1000)).toBe(false)
  })

  // Measured on testnet: about one +CF peer in three answers getcfcheckpt at
  // all. Requiring a second confirmation outright left the scan rotating peers
  // for good and never starting.
  it('proceeds on one uncontradicted answer rather than stalling', () => {
    receive(peers[0]!, answer(1))

    vi.advanceTimersByTime(CFCHECKPT_RACE_TIMEOUT_MS + 1)

    expect(ready).toHaveLength(1)
    expect(anchors.get(1000)).toEqual(answer(1)[0])
  })

  it('keeps asking rather than picking a side between contradicting answers', () => {
    receive(peers[0]!, answer(1))
    receive(peers[1]!, answer(90))

    vi.advanceTimersByTime(CFCHECKPT_RACE_TIMEOUT_MS + 1)

    expect(ready).toEqual([])
    expect(anchors.has(1000)).toBe(false)
  })

  it('never proceeds on an answer that failed its shape check', () => {
    receive(peers[0]!, [])

    vi.advanceTimersByTime(CFCHECKPT_RACE_TIMEOUT_MS + 1)

    expect(ready).toEqual([])
  })

  it('settles once enough peers return the same anchors', () => {
    receive(peers[0]!, answer(1))
    receive(peers[1]!, answer(1))

    expect(ready).toHaveLength(1)
    expect(anchors.get(1000)).toEqual(answer(1)[0])
    expect(anchors.get(2000)).toEqual(answer(1)[1])
  })

  it('counts one peer once, however often it answers', () => {
    receive(peers[0]!, answer(1))
    receive(peers[0]!, answer(1))
    receive(peers[0]!, answer(1))

    expect(ready).toEqual([])
  })

  // The liar answered first, which under the old first-wins rule decided the
  // anchors for the whole scan.
  it('takes the anchors the honest peers agree on, not the first answer', () => {
    receive(peers[0]!, answer(90))
    receive(peers[1]!, answer(1))
    receive(peers[2]!, answer(1))

    expect(ready).toHaveLength(1)
    expect(anchors.get(1000)).toEqual(answer(1)[0])
  })

  // The peers that answer are the scarce resource, and benching them with the
  // silent ones left the rotation handing out non-responders round after round.
  it('benches only the peers that stayed silent', () => {
    receive(peers[0]!, answer(1))

    vi.advanceTimersByTime(CFCHECKPT_RACE_TIMEOUT_MS + 1)

    expect(rotation.isSilent(peers[0]!)).toBe(false)
    expect(rotation.isSilent(peers[1]!)).toBe(true)
  })

  it('discards answers once the stop hash moves on', () => {
    receive(peers[0]!, answer(1))
    // A deeper scan tip asks a different question: three anchors, not two.
    anchors.request(3_999)

    receive(peers[1]!, answer(1, 3))
    receive(peers[2]!, answer(1, 3))

    expect(ready).toHaveLength(1)
    expect(ready[0]!.headers).toHaveLength(3)
  })

  it('stops asking once it has settled', () => {
    receive(peers[0]!, answer(1))
    receive(peers[1]!, answer(1))
    ready.length = 0

    vi.advanceTimersByTime(60_000)

    expect(ready).toEqual([])
  })
})

// Static mode pins the peer set, and one pinned peer is allowed. There is
// nothing to compare against and nothing on the way, so the scan must start on
// what that peer says.
describe('CheckpointAnchors against a single pinned peer', () => {
  let only: Peer
  let anchors: CheckpointAnchors
  let ready: Array<{headers: Uint8Array[]; peer: Peer}>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    only = makePeer('1.1.1.1')
    ready = []
    anchors = new CheckpointAnchors({
      rotation: new PeerRotation(() => [only]),
      messages: {GetCFCheckpt: () => ({command: 'getcfcheckpt'})},
      stopHashAt: (height: number) =>
        height > 0 && height % 1000 === 0 ? new Uint8Array(HASH_LEN) : undefined,
      onReady: (headers, peer) => ready.push({headers, peer}),
      poolCanGrow: () => false,
    })
    expect(anchors.request(SCAN_TIP)).toBe(true)
  })

  afterEach(() => {
    anchors.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Without the pinned check this waits out the race timer first, for a second
  // answer that cannot arrive.
  it('starts the scan on the one answer available, without waiting', () => {
    anchors.receive({filterHeaders: answer(1)} as unknown as CFCheckptArgs, only)

    expect(ready).toHaveLength(1)
    expect(anchors.get(1000)).toEqual(answer(1)[0])
  })

  it('still refuses an answer that fails its shape check', () => {
    anchors.receive({filterHeaders: []} as unknown as CFCheckptArgs, only)
    vi.advanceTimersByTime(CFCHECKPT_RACE_TIMEOUT_MS + 1)

    expect(ready).toEqual([])
  })

  it('settles once, however often the peer repeats itself', () => {
    for (let i = 0; i < 5; i++) {
      anchors.receive({filterHeaders: answer(1)} as unknown as CFCheckptArgs, only)
    }

    expect(ready).toHaveLength(1)
  })
})
