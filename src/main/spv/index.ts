import {ChainDAO} from './ChainDAO'
import {GENESIS_HASH} from './genesis'
import {HeaderSync, HeaderSyncStatus} from './headerSync'
import {SpvCommand, SpvEvent, SpvStatus} from './messages'

declare const process: NodeJS.Process & {
  parentPort: {
    on: (event: 'message', listener: (msg: { data: SpvCommand }) => void) => void
    postMessage: (msg: SpvEvent) => void
  }
}

let chainDAO: ChainDAO | null = null
let headerSync: HeaderSync | null = null
let activeNetwork: SpvStatus['network'] = null

let status: SpvStatus = {
  phase: 'idle',
  network: null,
  tipHeight: 0,
  tipHash: null,
  peerCount: 0,
  updatedAt: Date.now(),
}

function emit(next: Partial<SpvStatus>): void {
  status = { ...status, ...next, updatedAt: Date.now() }
  process.parentPort.postMessage({ type: 'status', status })
}

function emitFromHeaderSync(s: HeaderSyncStatus): void {
  emit({
    phase: s.phase,
    network: activeNetwork,
    tipHeight: s.tipHeight,
    tipHash: s.tipHash,
    peerCount: s.peerCount,
  })
}

function reportError(message: string): void {
  process.parentPort.postMessage({ type: 'error', message })
}

async function teardown(): Promise<void> {
  if (headerSync) {
    headerSync.stop()
    headerSync = null
  }
  if (chainDAO) {
    await chainDAO.close().catch(() => {})
    chainDAO = null
  }
}

async function handleStart(cmd: Extract<SpvCommand, { type: 'start' }>): Promise<void> {
  await teardown()

  activeNetwork = cmd.network
  emit({ phase: 'connecting', network: cmd.network, peerCount: 0 })

  chainDAO = new ChainDAO(cmd.chainDbPath)
  await chainDAO.open()

  const persisted = await chainDAO.initSyncState(cmd.network)

  if (!chainDAO || !persisted) {
    reportError('Chain DB init failed — see utility process logs')
    await teardown()
    return
  }

  // Resume point: max(checkpoint, persisted_tip). If neither is set, fall
  // back to the network's genesis hash at height 1.
  let resumeHeight = persisted.tipHeight
  let resumeHash = persisted.tipHash
  console.log(`[spv] persisted state: height=${resumeHeight} hash=${resumeHash ?? 'null'}`)
  if (cmd.startHeight > resumeHeight) {
    resumeHeight = cmd.startHeight
    resumeHash = cmd.startHash
    console.log(`[spv] checkpoint override: height=${resumeHeight} hash=${resumeHash}`)
  }
  if (!resumeHash) {
    resumeHash = GENESIS_HASH[cmd.network]
    resumeHeight = 1
    console.log(`[spv] genesis fallback: height=${resumeHeight} hash=${resumeHash}`)
  }
  console.log(`[spv] starting sync from height=${resumeHeight} hash=${resumeHash}`)

  headerSync = new HeaderSync({
    network: cmd.network,
    chainDAO,
    initialTipHeight: resumeHeight,
    initialTipHash: resumeHash,
    emit: emitFromHeaderSync,
  })
  headerSync.start()
}

async function handleStop(): Promise<void> {
  await teardown()
  activeNetwork = null
  emit({ phase: 'stopped', network: null, peerCount: 0 })
}

process.parentPort.on('message', ({ data }) => {
  if (data.type === 'start') {
    console.log(data)
    handleStart(data).catch(err => {
      console.error('err')
      reportError(err instanceof Error ? err.message : String(err))
    })
    return
  }
  if (data.type === 'stop') {
    console.log(data)
    handleStop().catch(err => reportError(err instanceof Error ? err.message : String(err)))
  }
})

emit({ phase: 'idle' })
