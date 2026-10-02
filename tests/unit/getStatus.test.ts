import {describe, expect, it, vi} from 'vitest'
import {GetStatusHandler} from '../../src/main/src/api/getStatus'

describe('getStatus', () => {
  it('returns the selected wallet data revision', async () => {
    const walletService = {
      getSelectedWallet: vi.fn().mockResolvedValue({walletId: 'wallet-1', network: 'testnet'}),
      getConnectionStatus: vi.fn().mockResolvedValue('synced'),
    }
    const walletSyncService = {
      getStatus: vi.fn().mockReturnValue({phase: 'synced'}),
      getWalletDataRevision: vi.fn().mockReturnValue(7),
    }
    const handler = new GetStatusHandler(
      walletService as never,
      {isReady: () => true} as never,
      walletSyncService as never,
    )

    const status = await handler.handle(null as never)

    expect(status).toMatchObject({
      selectedWalletId: 'wallet-1',
      network: 'testnet',
      connectionStatus: 'synced',
      walletDataRevision: 7,
    })
    expect(walletSyncService.getWalletDataRevision).toHaveBeenCalledWith('wallet-1')
  })
})
