import {describe, expect, it} from 'vitest'
import {WalletSyncPhase, type WalletSyncStatus} from '../../src/renderer/src/api/types'
import type {CompletedSyncSnapshot} from '../../src/renderer/src/types/connection'
import {shouldSuppressNearTipSyncProgress} from '../../src/renderer/src/utils/walletSync'

const completed: CompletedSyncSnapshot = {
  walletId: 'wallet-1',
  tipHeight: 100,
  cfilterScanHeight: 99,
}

function sync(overrides: Partial<WalletSyncStatus> = {}): WalletSyncStatus {
  return {
    phase: WalletSyncPhase.SyncingCfilters,
    network: 'mainnet',
    walletId: 'wallet-1',
    tipHeight: 101,
    tipHash: null,
    estimatedChainHeight: 101,
    cfheadersHeight: 101,
    cfilterScanHeight: 99,
    matchedBlocksPending: 0,
    peerCount: 4,
    filterCapablePeerCount: 4,
    lockPeerCount: 4,
    peerMode: 'dynamic',
    phaseEtaMs: null,
    lastError: null,
    updatedAt: 0,
    ...overrides,
  }
}

describe('shouldSuppressNearTipSyncProgress', () => {
  it('suppresses a one-block catch-up after synchronization completed', () => {
    expect(shouldSuppressNearTipSyncProgress(sync(), completed)).toBe(true)
  })

  it('shows progress when more than one new block arrived', () => {
    expect(shouldSuppressNearTipSyncProgress(sync({
      tipHeight: 102,
      estimatedChainHeight: 102,
    }), completed)).toBe(false)
  })

  it('shows progress during the initial synchronization', () => {
    expect(shouldSuppressNearTipSyncProgress(sync(), null)).toBe(false)
  })

  it('shows progress for a historical filter rescan', () => {
    expect(shouldSuppressNearTipSyncProgress(sync({cfilterScanHeight: 50}), completed)).toBe(false)
  })

  it('does not hide a synchronization error', () => {
    expect(shouldSuppressNearTipSyncProgress(sync({lastError: 'peer failed'}), completed)).toBe(false)
  })
})
