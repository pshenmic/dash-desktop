import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {EventEmitter} from 'events'

// Real x11 needs ~2^20 hashes per header to clear POW_LIMIT_TARGET, which no
// test can mine. Display order is the digest reversed, so zeroing its tail is
// what puts the result under the limit.
vi.mock('../../src/main/p2p/utils/x11', () => ({
  x11Wire: (input: Uint8Array) => {
    let a = 0x811c9dc5
    let b = 0x01000193
    for (let i = 0; i < input.length; i++) {
      a = ((a ^ input[i]!) * 0x01000193) >>> 0
      b = ((b + input[i]! * (i + 1)) * 0x85ebca6b) >>> 0
    }
    const out = new Uint8Array(32)
    for (let i = 0; i < 4; i++) {
      out[i] = (a >>> (i * 8)) & 0xff
      out[i + 4] = (b >>> (i * 8)) & 0xff
    }
    return out
  },
}))

const {HeaderSyncWorker} = await import('../../src/main/p2p/sync/workers/HeaderSyncWorker')
const {hashHeaderRaw} = await import('../../src/main/p2p/utils/pow')
const {
  POW_LIMIT_BITS, HEADER_STALL_TIMEOUT_MS, HEADER_STALL_CHECK_MS,
  HEADER_RACE_PEERS, HEADER_SYNC_TIMEOUT_MS, ORPHAN_VOTE_PEERS, REORG_MAX_DEPTH,
} = await import('../../src/main/p2p/constants')
type PeerRotation = import('../../src/main/p2p/net/peerRotation').PeerRotation
type ChainStore = import('../../src/main/p2p/store/ChainStore').ChainStore
type PoolService = import('../../src/main/p2p/net/PoolService').PoolService
type PersistedHeader = import('../../src/main/p2p/types/chainStore').PersistedHeader
type ChainTipState = import('../../src/main/p2p/types/chainStore').ChainTipState

const GENESIS_HASH = '00'.repeat(32)
const BLOCK_TIME = 1_760_000_000

function makeHeader(prevHashDisplay: string, nonce: number, nBits = POW_LIMIT_BITS): Uint8Array {
  const raw = new Uint8Array(80)
  const dv = new DataView(raw.buffer)
  dv.setUint32(0, 2, true)
  // rawPrevHash reads bytes 35..4 descending, so the display hex goes in reversed.
  for (let i = 0; i < 32; i++) {
    raw[4 + i] = parseInt(prevHashDisplay.slice((31 - i) * 2, (31 - i) * 2 + 2), 16)
  }
  dv.setUint32(68, BLOCK_TIME, true)
  dv.setUint32(72, nBits, true)
  dv.setUint32(76, nonce, true)
  return raw
}

// `nonce` seeds each header, so two branches off the same parent differ.
function makeChain(fromHash: string, count: number, nonce: number, nBits = POW_LIMIT_BITS): Uint8Array[] {
  const chain: Uint8Array[] = []
  let prev = fromHash
  for (let i = 0; i < count; i++) {
    const header = makeHeader(prev, nonce + i, nBits)
    chain.push(header)
    prev = hashHeaderRaw(header)
  }
  return chain
}

class FakeChainStore {
  readonly network = 'mainnet' as const
  appended: PersistedHeader[][] = []
  deletedFrom: number[] = []
  state: ChainTipState = {tipHeight: 0, tipHash: null}
  private readonly byHeight = new Map<number, Uint8Array>()

  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => []

  appendHeaders = async (headers: PersistedHeader[], nextState: ChainTipState): Promise<void> => {
    this.appended.push(headers)
    for (const header of headers) this.byHeight.set(header.height, header.raw)
    this.state = nextState
  }

  deleteHeadersFrom = async (fromHeight: number, nextState: ChainTipState): Promise<void> => {
    this.deletedFrom.push(fromHeight)
    for (const height of [...this.byHeight.keys()]) {
      if (height >= fromHeight) this.byHeight.delete(height)
    }
    this.state = nextState
  }

  // No hash keyspace, so the worker falls back to hashing the header — the
  // path a chain.db written before that keyspace takes.
  forEachHashInRange = async (): Promise<number> => 0

  getHeaderByHeight = async (height: number): Promise<Uint8Array | null> =>
    this.byHeight.get(height) ?? null
}

class FakePool extends EventEmitter {
  readyPeers = new Set<object>()
  messages = {
    GetHeaders: (args: unknown) => ({command: 'getheaders', args}),
    SendHeaders: () => ({command: 'sendheaders'}),
  }
}

interface TestPeer {
  host: string
  port: number
  version: number
  bestHeight: number
  sent: Array<{command: string}>
  sendMessage: (msg: {command: string}) => void
}

const makePeer = (host: string): TestPeer => {
  const sent: Array<{command: string}> = []
  return {
    host,
    port: 19999,
    version: 70230,
    bestHeight: 100,
    sent,
    sendMessage: (msg: {command: string}) => sent.push(msg),
  }
}

const hashAt = (n: number): string => n.toString(16).padStart(64, '0')

const blockInv = (hash: string): {inventory: Array<{type: number; hash: Uint8Array}>} => {
  // Inv hashes are wire order; the worker reverses them back to display hex.
  const wire = new Uint8Array(32)
  for (let i = 0; i < 32; i++) wire[i] = parseInt(hash.slice((31 - i) * 2, (31 - i) * 2 + 2), 16)
  return {inventory: [{type: 2, hash: wire}]}
}

const getHeaderRequests = (peer: TestPeer): Array<{command: string}> =>
  peer.sent.filter(msg => msg.command === 'getheaders')

describe('HeaderSyncWorker', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: InstanceType<typeof HeaderSyncWorker>
  let peerA: ReturnType<typeof makePeer>
  let peerB: ReturnType<typeof makePeer>
  let extended: PersistedHeader[][]
  let rewound: number[]
  let events: string[]

  // Two empty responses is what finishHeaderSync waits for at this peer count.
  const reachSynced = async (): Promise<void> => {
    await worker.start()
    pool.emit('peerheaders', peerA, {headers: []})
    pool.emit('peerheaders', peerB, {headers: []})
    await Promise.resolve()
  }

  // Dispatched synchronously but processed in a promise chain.
  const push = async (peer: ReturnType<typeof makePeer>, headers: Uint8Array[]): Promise<void> => {
    pool.emit('peerheaders', peer, {headers})
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  // Checked against chain.db, so the answer lands a turn later.
  const lock = async (height: number, hash: string): Promise<void> => {
    worker.noteChainLock(height, hash)
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  beforeEach(async () => {
    store = new FakeChainStore()
    pool = new FakePool()
    peerA = makePeer('1.1.1.1')
    peerB = makePeer('2.2.2.2')
    pool.readyPeers.add(peerA)
    pool.readyPeers.add(peerB)

    worker = new HeaderSyncWorker({
      chainStore: store as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      initialTipHeight: 10,
      initialTipHash: GENESIS_HASH,
      chainLock: null,
    })

    extended = []
    rewound = []
    events = []
    worker.on('chainExtended', (headers: PersistedHeader[]) => {
      extended.push(headers)
      events.push('extended')
    })
    worker.on('chainRewound', (height: number) => {
      rewound.push(height)
      events.push('rewound')
    })

    await reachSynced()
  })

  afterEach(() => {
    worker.stop()
  })

  it('applies a header that builds on the tip', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)

    await push(peerA, [block11])

    expect(extended).toHaveLength(1)
    expect(extended[0]!.map(h => h.height)).toEqual([11])
    expect(store.state).toEqual({tipHeight: 11, tipHash: hashHeaderRaw(block11)})
  })

  // Refusing it on work leaves the tip correct too, so what matters is that it
  // never reaches branch selection — that log is where a real reorg shows up.
  it('ignores a block a second peer re-announces after we accepted it', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)
    await push(peerA, [block11])
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await push(peerB, [block11])

    const lines = log.mock.calls.map(args => String(args[0]))
    log.mockRestore()

    expect(lines.filter(line => line.includes('fork at h='))).toEqual([])
    expect(extended).toHaveLength(1)
    expect(rewound).toEqual([])
    expect(store.deletedFrom).toEqual([])
    expect(store.state.tipHeight).toBe(11)
  })

  it('applies the new tail of a batch that overlaps blocks we already hold', async () => {
    const chain = makeChain(GENESIS_HASH, 2, 1)
    await push(peerA, [chain[0]!])

    await push(peerB, chain)

    expect(extended).toHaveLength(2)
    expect(extended[1]!.map(h => h.height)).toEqual([12])
    expect(rewound).toEqual([])
    expect(store.state.tipHeight).toBe(12)
  })

  it('keeps our branch when a competing one carries no more work', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))

    await push(peerB, makeChain(GENESIS_HASH, 1, 500))

    expect(rewound).toEqual([])
    expect(store.deletedFrom).toEqual([])
    expect(store.state.tipHeight).toBe(11)
  })

  it('rewinds to the fork point when a competing branch carries more work', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))
    const winner = makeChain(GENESIS_HASH, 2, 500)

    await push(peerB, winner)

    expect(rewound).toEqual([10])
    expect(store.deletedFrom).toEqual([11])
    expect(store.state).toEqual({tipHeight: 12, tipHash: hashHeaderRaw(winner[1]!)})
  })

  it('reports the rewind before the replacement branch, so downstream drops stale state first', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))

    await push(peerB, makeChain(GENESIS_HASH, 2, 500))

    expect(events).toEqual(['extended', 'rewound', 'extended'])
  })

  it('refuses a heavier branch that forks below a chainlocked height', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)
    await push(peerA, [block11])
    await lock(11, hashHeaderRaw(block11))

    await push(peerB, makeChain(GENESIS_HASH, 3, 500))

    expect(rewound).toEqual([])
    expect(store.deletedFrom).toEqual([])
    expect(store.state.tipHeight).toBe(11)
  })

  it('takes a heavier branch forking at exactly the chainlocked height', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))
    await lock(10, GENESIS_HASH)

    await push(peerB, makeChain(GENESIS_HASH, 2, 500))

    expect(rewound).toEqual([10])
    expect(store.state.tipHeight).toBe(12)
  })

  it('never lowers the finality floor', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)
    await push(peerA, [block11])
    await lock(11, hashHeaderRaw(block11))
    await lock(5, hashAt(5))

    await push(peerB, makeChain(GENESIS_HASH, 3, 500))

    expect(rewound).toEqual([])
  })

  // A floor is only a floor over a block we hold: the height alone would pin us
  // to whatever branch we happen to be on there.
  it('rewinds when the chainlock names a block other than ours at that height', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))

    await lock(11, hashHeaderRaw(makeHeader(GENESIS_HASH, 777)))

    expect(rewound).toEqual([10])
    expect(store.deletedFrom).toEqual([11])
    expect(store.state).toEqual({tipHeight: 10, tipHash: GENESIS_HASH})
  })

  it('leaves the branch alone when the chainlock names our own block', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)
    await push(peerA, [block11])

    await lock(11, hashHeaderRaw(block11))

    expect(rewound).toEqual([])
    expect(store.state.tipHeight).toBe(11)
  })

  // Announced network-wide, so it arrives long before we are at that height —
  // which is not a reason to take it on trust, only to hold it.
  it('holds a chainlock above our tip until the tip reaches it', async () => {
    const ours = makeChain(GENESIS_HASH, 2, 1)
    const other = makeHeader(hashHeaderRaw(ours[0]!), 777)

    await lock(12, hashHeaderRaw(other))
    expect(rewound).toEqual([])

    await push(peerA, ours)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(rewound).toEqual([11])
  })

  // A locator of one hash is one a peer that left our branch cannot answer, and
  // the chainlock height running ahead of the tip is the normal case.
  it('keeps a locator that reaches back when the chainlock is above our tip', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 5, 1))
    await lock(5_000_000, hashAt(7))
    peerA.sent.length = 0

    pool.emit('peerinv', peerA, blockInv(hashAt(99)))

    const request = getHeaderRequests(peerA)[0] as unknown as {args: {starts: Uint8Array[]}}
    expect(request.args.starts.length).toBeGreaterThan(1)
  })

  it('rejects a batch whose parent is outside the reorg window', async () => {
    const orphanParent = hashHeaderRaw(makeHeader('11'.repeat(32), 9999))

    await push(peerA, makeChain(orphanParent, 2, 1))

    expect(extended).toEqual([])
    expect(rewound).toEqual([])
    expect(store.state.tipHeight).toBe(0)
  })

  // Nothing cancels the losing racers, so when the sync ends thousands of
  // batches are still in flight, every one built on a tip the chain has since
  // left behind. Reporting them buried every real warning the sync produced.
  it('stays quiet about a batch answering a race the tip has already passed', async () => {
    await push(peerA, makeChain(GENESIS_HASH, REORG_MAX_DEPTH + 1, 1))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await push(peerB, makeChain(GENESIS_HASH, 2, 500))

    const lines = warn.mock.calls.map(args => String(args[0]))
    warn.mockRestore()

    expect(lines.filter(line => line.includes('reject batch'))).toEqual([])
    expect(extended).toHaveLength(1)
  })

  it('still reports a batch built on a tip it never asked from', async () => {
    const orphanParent = hashHeaderRaw(makeHeader('11'.repeat(32), 9999))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await push(peerA, makeChain(orphanParent, 2, 1))

    const lines = warn.mock.calls.map(args => String(args[0]))
    warn.mockRestore()

    expect(lines.filter(line => line.includes('reject batch'))).toHaveLength(1)
  })

  it('asks for headers when a peer announces a block by inv', async () => {
    peerA.sent.length = 0

    pool.emit('peerinv', peerA, blockInv(hashAt(999)))

    expect(getHeaderRequests(peerA)).toHaveLength(1)
  })

  it('asks once for a block every peer announces', async () => {
    peerA.sent.length = 0
    peerB.sent.length = 0

    pool.emit('peerinv', peerA, blockInv(hashAt(999)))
    pool.emit('peerinv', peerB, blockInv(hashAt(999)))

    expect(getHeaderRequests(peerA)).toHaveLength(1)
    expect(getHeaderRequests(peerB)).toHaveLength(0)
  })

  it('ignores an announcement for a block it already holds', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)
    await push(peerA, [block11])
    peerA.sent.length = 0

    pool.emit('peerinv', peerA, blockInv(hashHeaderRaw(block11)))

    expect(getHeaderRequests(peerA)).toEqual([])
  })

  it('chases again once the earlier announcement resolved into headers', async () => {
    pool.emit('peerinv', peerA, blockInv(hashAt(999)))
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))
    peerA.sent.length = 0

    pool.emit('peerinv', peerA, blockInv(hashAt(998)))

    expect(getHeaderRequests(peerA)).toHaveLength(1)
  })

  it('rejects a batch that does not connect to itself', async () => {
    const chain = makeChain(GENESIS_HASH, 1, 1)
    const disconnected = makeHeader('22'.repeat(32), 77)

    await push(peerA, [chain[0]!, disconnected])

    expect(extended).toEqual([])
    expect(store.state.tipHeight).toBe(0)
  })
})

describe('HeaderSyncWorker tip-follow stall', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: InstanceType<typeof HeaderSyncWorker>
  let peer: TestPeer

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    store = new FakeChainStore()
    pool = new FakePool()
    peer = makePeer('1.1.1.1')
    pool.readyPeers.add(peer)

    worker = new HeaderSyncWorker({
      chainStore: store as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      initialTipHeight: 10,
      initialTipHash: GENESIS_HASH,
      chainLock: null,
    })

    await worker.start()
    pool.emit('peerheaders', peer, {headers: []})
    await Promise.resolve()
    peer.sent.length = 0
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stays quiet while the tip is still moving', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS - 1_000)

    expect(getHeaderRequests(peer)).toEqual([])
  })

  it('polls for headers once the tip has gone quiet', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + HEADER_STALL_CHECK_MS)

    expect(getHeaderRequests(peer).length).toBeGreaterThan(0)
  })

  it('does not re-poll every tick while still quiet', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + HEADER_STALL_CHECK_MS)
    const afterFirst = getHeaderRequests(peer).length

    await vi.advanceTimersByTimeAsync(HEADER_STALL_CHECK_MS * 3)

    expect(getHeaderRequests(peer)).toHaveLength(afterFirst)
  })

  // The `stopped` guard keeps this quiet either way, so the handle is asserted
  // too — a worker is rebuilt per bulk-layer restart.
  it('releases the poll timer once the worker is torn down', async () => {
    worker.stop()

    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS * 3)

    expect(getHeaderRequests(peer)).toEqual([])
    expect((worker as unknown as {stallTimer: unknown}).stallTimer).toBeNull()
  })
})

// A narrow race can strand itself: readyPeers is insertion ordered, so without
// tracking, the same silent peers head every race and each one costs a full
// HEADER_SYNC_TIMEOUT_MS before anyone else is asked.
describe('HeaderSyncWorker race peer selection', () => {
  let pool: FakePool
  let store: FakeChainStore
  let worker: InstanceType<typeof HeaderSyncWorker>
  let peers: ReturnType<typeof makePeer>[]
  let rewound: number[]

  const silent = (): ReturnType<typeof makePeer>[] => peers.slice(0, HEADER_RACE_PEERS)
  const untried = (): ReturnType<typeof makePeer>[] => peers.slice(HEADER_RACE_PEERS)
  const rotation = (): PeerRotation => (worker as unknown as {rotation: PeerRotation}).rotation

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    pool = new FakePool()
    // More peers than one race can hold, or every peer is asked regardless.
    peers = Array.from({length: HEADER_RACE_PEERS + 5}, (_, i) => makePeer(`10.0.0.${i}`))
    for (const peer of peers) pool.readyPeers.add(peer)

    store = new FakeChainStore()
    worker = new HeaderSyncWorker({
      chainStore: store as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      initialTipHeight: 10,
      initialTipHash: GENESIS_HASH,
      chainLock: null,
    })
    rewound = []
    worker.on('chainRewound', (height: number) => rewound.push(height))
    await worker.start()
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('asks the first race up to the race width', () => {
    expect(silent().every(p => getHeaderRequests(p).length === 1)).toBe(true)
    expect(untried().every(p => getHeaderRequests(p).length === 0)).toBe(true)
  })

  it('reaches untried peers after a race times out', () => {
    vi.advanceTimersByTime(HEADER_SYNC_TIMEOUT_MS + 1)

    // Every peer the first race never got to is asked by the second.
    expect(untried().every(p => getHeaderRequests(p).length === 1)).toBe(true)
  })

  it('clears a peer that answers, silent or not', () => {
    vi.advanceTimersByTime(HEADER_SYNC_TIMEOUT_MS + 1)
    expect(rotation().silentCount).toBe(HEADER_RACE_PEERS)

    // An empty `headers` is still an answer — the peer has nothing, not nothing to say.
    pool.emit('peerheaders', peers[0]!, {headers: []})

    expect(rotation().isSilent(peers[0]! as never)).toBe(false)
  })

  // A race asks from our tip, so an answer saying that tip is the orphan cannot
  // build on it — as every branch a race can be corrected by cannot.
  it('acts on an answer that forks below the tip the race asked from', async () => {
    const ours = makeChain(GENESIS_HASH, 3, 1)
    pool.emit('peerheaders', peers[0]!, {headers: ours})
    await vi.advanceTimersByTimeAsync(0)
    expect(store.state.tipHeight).toBe(13)

    // Hangs off h=12, which is in the window but was never a tip we asked from.
    const winner = makeChain(hashHeaderRaw(ours[1]!), 3, 500)
    pool.emit('peerheaders', peers[1]!, {headers: winner})
    await vi.advanceTimersByTimeAsync(0)

    expect(rewound).toEqual([12])
    expect(store.state.tipHeight).toBe(15)
  })

  // A peer that cannot place our tip answers from genesis. Left in `racers` that
  // reads as silence, and penalises the peers that did in fact answer.
  it('credits a peer that answers from a hash we never held', async () => {
    const stranger = makeChain('22'.repeat(32), 2, 7)

    for (const peer of silent()) {
      pool.emit('peerheaders', peer, {headers: stranger})
    }
    await vi.advanceTimersByTimeAsync(0)

    expect(rotation().silentCount).toBe(0)
    // The race ended on the answers rather than on its timeout, so the next one
    // is already out without a single timer having fired.
    expect(silent().every(p => getHeaderRequests(p).length === 2)).toBe(true)
  })

  it('forgets a peer that disconnects', () => {
    vi.advanceTimersByTime(HEADER_SYNC_TIMEOUT_MS + 1)

    pool.readyPeers.delete(peers[0]!)
    pool.emit('peerdisconnect', peers[0]!)

    expect(rotation().isSilent(peers[0]! as never)).toBe(false)
  })
})

// A branch that lost further back than the window reaches still validates and
// still carries work, so only the peers can say it is the wrong one.
describe('HeaderSyncWorker orphaned beyond the reorg window', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: InstanceType<typeof HeaderSyncWorker>
  let peerA: ReturnType<typeof makePeer>
  let rewound: number[]

  // Deep enough that a second rewind would also have somewhere to land.
  const ours = makeChain(GENESIS_HASH, REORG_MAX_DEPTH * 3, 1)
  const tip = 10 + ours.length
  const stranger = makeChain('22'.repeat(32), 2, 7)
  const ourHashAt = (height: number): string => hashHeaderRaw(ours[height - 11]!)

  const push = async (peer: ReturnType<typeof makePeer>, headers: Uint8Array[]): Promise<void> => {
    pool.emit('peerheaders', peer, {headers})
    await vi.advanceTimersByTimeAsync(0)
  }

  // Connected, like the peers a real answer comes from: the threshold they have
  // to clear is read off the pool.
  const strangers = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) {
      const peer = makePeer(`10.9.0.${i}`)
      pool.readyPeers.add(peer)
      await push(peer, stranger)
    }
  }

  const lock = async (height: number): Promise<void> => {
    worker.noteChainLock(height, ourHashAt(height))
    await vi.advanceTimersByTimeAsync(0)
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    store = new FakeChainStore()
    pool = new FakePool()
    peerA = makePeer('1.1.1.1')
    pool.readyPeers.add(peerA)

    worker = new HeaderSyncWorker({
      chainStore: store as unknown as ChainStore,
      peerPool: pool as unknown as PoolService,
      initialTipHeight: 10,
      initialTipHash: GENESIS_HASH,
      chainLock: null,
    })
    rewound = []
    worker.on('chainRewound', (height: number) => rewound.push(height))

    await worker.start()
    await push(peerA, ours)
    pool.emit('peerheaders', peerA, {headers: []})
    pool.emit('peerheaders', peerA, {headers: []})
    await vi.advanceTimersByTimeAsync(0)
  })

  afterEach(() => {
    worker.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('rewinds a reorg window once enough peers cannot place our tip', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + 1)

    await strangers(ORPHAN_VOTE_PEERS)

    expect(rewound).toEqual([tip - REORG_MAX_DEPTH])
    expect(store.state.tipHeight).toBe(tip - REORG_MAX_DEPTH)
  })

  it('needs more than one peer to say so', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + 1)

    await strangers(ORPHAN_VOTE_PEERS - 1)

    expect(rewound).toEqual([])
  })

  // A peer on its own fork answers from outside our window too. Acting on that
  // while our own tip is still moving would be the wallet forking itself.
  it('ignores them while the tip is still taking headers', async () => {
    await strangers(ORPHAN_VOTE_PEERS + 2)

    expect(rewound).toEqual([])
  })

  // Static mode pins the pool, often to one peer, so a fixed quorum of three is
  // one it could never reach.
  it('takes the word of the only peer a pinned pool has', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + 1)

    await push(peerA, stranger)

    expect(rewound).toEqual([tip - REORG_MAX_DEPTH])
  })

  // The drop is bounded by consensus, not by how many peers ask for it.
  it('stops the rewind at the last chainlock we verified', async () => {
    await lock(tip - 5)
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + 1)

    await strangers(ORPHAN_VOTE_PEERS)

    expect(rewound).toEqual([tip - 5])
  })

  it('drops nothing when the chainlock reaches our tip', async () => {
    await lock(tip)
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + 1)

    await strangers(ORPHAN_VOTE_PEERS)

    expect(rewound).toEqual([])
    expect(store.state.tipHeight).toBe(tip)
  })

  // The burst arrives in one tick, hundreds of batches wide, and every peer past
  // the threshold would otherwise queue another window to drop.
  it('rewinds once, not once per peer in the burst', async () => {
    await vi.advanceTimersByTimeAsync(HEADER_STALL_TIMEOUT_MS + 1)

    for (let i = 0; i < ORPHAN_VOTE_PEERS * 3; i++) {
      const peer = makePeer(`10.9.0.${i}`)
      pool.readyPeers.add(peer)
      pool.emit('peerheaders', peer, {headers: stranger})
    }
    await vi.advanceTimersByTimeAsync(0)

    expect(rewound).toEqual([tip - REORG_MAX_DEPTH])
  })
})
