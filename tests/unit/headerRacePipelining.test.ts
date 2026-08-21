import {describe, it, expect, beforeEach, vi} from 'vitest'
import {EventEmitter} from 'events'

// Same stand-in as headerSync.test.ts: real x11 needs ~2^20 hashes per header
// to clear POW_LIMIT_TARGET, which no test can mine.
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
const {POW_LIMIT_BITS} = await import('../../src/main/p2p/constants')
type ChainStore = import('../../src/main/p2p/store/ChainStore').ChainStore
type PoolService = import('../../src/main/p2p/net/PoolService').PoolService
type PersistedHeader = import('../../src/main/p2p/types/chainStore').PersistedHeader
type ChainTipState = import('../../src/main/p2p/types/chainStore').ChainTipState

const GENESIS_HASH = '00'.repeat(32)
const BLOCK_TIME = 1_760_000_000

function makeHeader(prevHashDisplay: string, nonce: number): Uint8Array {
  const raw = new Uint8Array(80)
  const dv = new DataView(raw.buffer)
  dv.setUint32(0, 2, true)
  for (let i = 0; i < 32; i++) {
    raw[4 + i] = parseInt(prevHashDisplay.slice((31 - i) * 2, (31 - i) * 2 + 2), 16)
  }
  dv.setUint32(68, BLOCK_TIME, true)
  dv.setUint32(72, POW_LIMIT_BITS, true)
  dv.setUint32(76, nonce, true)
  return raw
}

function makeChain(fromHash: string, count: number, nonce: number): Uint8Array[] {
  const chain: Uint8Array[] = []
  let prev = fromHash
  for (let i = 0; i < count; i++) {
    const header = makeHeader(prev, nonce + i)
    chain.push(header)
    prev = hashHeaderRaw(header)
  }
  return chain
}

class FakeChainStore {
  state: ChainTipState = {tipHeight: 0, tipHash: null}
  iterateHeadersInRange = async (): Promise<Array<{height: number; raw: Uint8Array}>> => []
  appendHeaders = async (_h: PersistedHeader[], nextState: ChainTipState): Promise<void> => {
    this.state = nextState
  }
  deleteHeadersFrom = async (_f: number, nextState: ChainTipState): Promise<void> => {
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

const makePeer = (host: string) => ({
  host, port: 19999, version: 70230, bestHeight: 100,
  sent: [] as Array<{command: string}>,
  sendMessage(msg: {command: string}) { this.sent.push(msg) },
})

// `getheaders` carries no request id, so the worker cannot tell an answer to
// this race from one to the race before it except by what it connects to. The
// same peers get picked race after race, so their responses overlap constantly:
// measured at 97% of first responses on a real testnet sync.
describe('header race response pipelining', () => {
  let store: FakeChainStore
  let pool: FakePool
  let worker: InstanceType<typeof HeaderSyncWorker>
  let peerA: ReturnType<typeof makePeer>
  let peerB: ReturnType<typeof makePeer>
  let extended: PersistedHeader[][]

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
    worker.on('chainExtended', (headers: PersistedHeader[]) => extended.push(headers))

    // start() leaves the worker in 'syncing-headers' with a race outstanding.
    await worker.start()
  })

  it('ignores a batch that answers the previous race', async () => {
    const raceOne = makeChain(GENESIS_HASH, 2, 1)
    await push(peerA, raceOne)
    expect(extended).toHaveLength(1)
    const tip = hashHeaderRaw(raceOne[1]!)
    expect(store.state.tipHash).toBe(tip)

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // peerB's answer to race one, arriving after race two already started. Its
    // parent is still inside the reorg window, so left to reach processHeaders
    // it is weighed as a competing branch rather than recognised as our own
    // stale request coming back.
    await push(peerB, makeChain(GENESIS_HASH, 2, 500))
    const lines = [...log.mock.calls, ...warn.mock.calls].map(a => String(a[0]))
    log.mockRestore()
    warn.mockRestore()

    expect(extended).toHaveLength(1)
    expect(store.state.tipHash).toBe(tip)
    // Never routed into branch selection at all.
    expect(lines.some(l => l.includes('fork at h=') || l.includes('reject batch'))).toBe(false)
  })

  // The stale batch used to consume peerB's slot in race two, so peerB's real
  // answer was then dropped for not being in `racers` and the race waited on
  // whoever was left. That is the 40ms -> 343ms the logs showed.
  it('still accepts that peer real answer to the current race', async () => {
    const raceOne = makeChain(GENESIS_HASH, 2, 1)
    await push(peerA, raceOne)
    const tip = hashHeaderRaw(raceOne[1]!)

    await push(peerB, makeChain(GENESIS_HASH, 2, 500))   // stale
    await push(peerB, makeChain(tip, 2, 900))            // fresh

    expect(extended).toHaveLength(2)
    expect(extended[1]!.map(h => h.height)).toEqual([13, 14])
    expect(store.state.tipHeight).toBe(14)
  })
})
