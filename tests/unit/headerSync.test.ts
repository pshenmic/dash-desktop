import {describe, it, expect, beforeEach, vi} from 'vitest'
import {EventEmitter} from 'events'

// Real x11 would need ~2^20 hashes per header to clear POW_LIMIT_TARGET, which
// is minutes per block in JS. This keeps every other rule real — connectivity,
// the target comparison, cumulative work — and only makes the digest cheap.
// Display order is the digest reversed, so zeroing the tail of the array is
// what puts the resulting hash under the limit.
vi.mock('@dashevo/x11-hash-js', () => ({
  default: {
    digest: (input: ArrayLike<number>) => {
      let a = 0x811c9dc5
      let b = 0x01000193
      for (let i = 0; i < input.length; i++) {
        a = ((a ^ input[i]!) * 0x01000193) >>> 0
        b = ((b + input[i]! * (i + 1)) * 0x85ebca6b) >>> 0
      }
      const out = new Array<number>(32).fill(0)
      for (let i = 0; i < 4; i++) {
        out[i] = (a >>> (i * 8)) & 0xff
        out[i + 4] = (b >>> (i * 8)) & 0xff
      }
      return out
    },
  },
}))

const {HeaderSyncWorker} = await import('../../src/main/p2p/workers/HeaderSyncWorker')
const {hashHeaderRaw} = await import('../../src/main/p2p/pow')
const {POW_LIMIT_BITS} = await import('../../src/main/p2p/constants')
type ChainStore = import('../../src/main/p2p/ChainStore').ChainStore
type PoolService = import('../../src/main/p2p/PoolService').PoolService
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

// A chain of `count` headers off `fromHash`, with `nonce` seeding each so two
// branches from the same parent differ.
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
  appended: PersistedHeader[][] = []
  deletedFrom: number[] = []
  state: ChainTipState = {tipHeight: 0, tipHash: null}

  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => []

  appendHeaders = async (headers: PersistedHeader[], nextState: ChainTipState): Promise<void> => {
    this.appended.push(headers)
    this.state = nextState
  }

  deleteHeadersFrom = async (fromHeight: number, nextState: ChainTipState): Promise<void> => {
    this.deletedFrom.push(fromHeight)
    this.state = nextState
  }
}

class FakePool extends EventEmitter {
  readyPeers = new Set<object>()
  messages = {
    GetHeaders: (args: unknown) => ({command: 'getheaders', args}),
    SendHeaders: () => ({command: 'sendheaders'}),
  }
}

const makePeer = (host: string): {host: string; port: number; version: number; bestHeight: number; sendMessage: () => void} =>
  ({host, port: 19999, version: 70230, bestHeight: 100, sendMessage: () => undefined})

describe('HeaderSyncWorker', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: InstanceType<typeof HeaderSyncWorker>
  let peerA: ReturnType<typeof makePeer>
  let peerB: ReturnType<typeof makePeer>
  let extended: PersistedHeader[][]
  let rewound: number[]
  let events: string[]

  // The worker only takes the tip-follow path once header sync has settled,
  // which is where a re-announced block actually lands. Two empty responses is
  // what finishHeaderSync waits for at this peer count.
  const reachSynced = async (): Promise<void> => {
    await worker.start()
    pool.emit('peerheaders', peerA, {headers: []})
    pool.emit('peerheaders', peerB, {headers: []})
    await Promise.resolve()
  }

  // Header events are dispatched synchronously but processed in a promise
  // chain, so the assertions have to wait a turn.
  const push = async (peer: ReturnType<typeof makePeer>, headers: Uint8Array[]): Promise<void> => {
    pool.emit('peerheaders', peer, {headers})
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
      finalityHeight: 0,
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

  it('applies a header that builds on the tip', async () => {
    const [block11] = makeChain(GENESIS_HASH, 1, 1)

    await push(peerA, [block11])

    expect(extended).toHaveLength(1)
    expect(extended[0]!.map(h => h.height)).toEqual([11])
    expect(store.state).toEqual({tipHeight: 11, tipHash: hashHeaderRaw(block11)})
  })

  // Refusing it on work would leave the tip correct too, so the assertion that
  // matters is that it never reaches branch selection: at one line per block per
  // extra peer, that log is what a real reorg has to stand out against.
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
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))
    worker.setFinalityHeight(11)

    await push(peerB, makeChain(GENESIS_HASH, 3, 500))

    expect(rewound).toEqual([])
    expect(store.deletedFrom).toEqual([])
    expect(store.state.tipHeight).toBe(11)
  })

  it('takes a heavier branch forking at exactly the chainlocked height', async () => {
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))
    worker.setFinalityHeight(10)

    await push(peerB, makeChain(GENESIS_HASH, 2, 500))

    expect(rewound).toEqual([10])
    expect(store.state.tipHeight).toBe(12)
  })

  it('never lowers the finality floor', async () => {
    worker.setFinalityHeight(11)
    worker.setFinalityHeight(5)
    await push(peerA, makeChain(GENESIS_HASH, 1, 1))

    await push(peerB, makeChain(GENESIS_HASH, 3, 500))

    expect(rewound).toEqual([])
  })

  it('rejects a batch whose parent is outside the reorg window', async () => {
    const orphanParent = hashHeaderRaw(makeHeader('11'.repeat(32), 9999))

    await push(peerA, makeChain(orphanParent, 2, 1))

    expect(extended).toEqual([])
    expect(rewound).toEqual([])
    expect(store.state.tipHeight).toBe(0)
  })

  it('rejects a batch that does not connect to itself', async () => {
    const chain = makeChain(GENESIS_HASH, 1, 1)
    const disconnected = makeHeader('22'.repeat(32), 77)

    await push(peerA, [chain[0]!, disconnected])

    expect(extended).toEqual([])
    expect(store.state.tipHeight).toBe(0)
  })
})
