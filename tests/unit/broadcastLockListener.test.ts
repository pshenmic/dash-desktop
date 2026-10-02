import {describe, expect, it, vi} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logTransport', () => ({logChildOutput: vi.fn()}))

import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'

describe('broadcast lock listener', () => {
  it('keeps the selected wallet on a transport recovery', async () => {
    const service = new WalletSyncService({} as never, {} as never, {} as never, Preferences.default())
    const internals = service as unknown as {
      child: unknown
      lockListenNetwork: 'mainnet' | 'testnet' | null
      lockListenWalletId: string | undefined
      send: (command: {type: string; requestId?: string}) => void
      handleP2PEvent: (event: unknown) => void
    }
    internals.child = {}
    internals.lockListenNetwork = 'testnet'
    internals.lockListenWalletId = 'wallet-1'
    internals.send = command => {
      if (command.type !== 'broadcast') return
      internals.handleP2PEvent({
        type: 'broadcastResult',
        requestId: command.requestId,
        ok: true,
        result: {
          txid: '', peersInvited: 0, peersAcked: [], peersDelivered: [], peersPropagated: [],
          instantLocked: false, islockHex: null, lockLatencyMs: null,
          waitedForLock: false, rejections: [], durationMs: 0,
        },
        errorMessage: null,
      })
    }
    const startLockListen = vi.spyOn(service, 'startLockListen')

    await service.broadcastTransaction('00')

    expect(startLockListen).toHaveBeenCalledWith('testnet', 'wallet-1')
  })
})
