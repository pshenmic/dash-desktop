import {describe, expect, it} from 'vitest'
import {WalletSyncPhase, type WalletSyncStatus} from '../../src/renderer/src/api/types'
import type {CompletedSyncSnapshot} from '../../src/renderer/src/types/connection'
import {isWalletSyncIncomplete, shouldShowWalletSyncWarning, shouldSuppressNearTipSyncProgress} from '../../src/renderer/src/utils/walletSync'

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

describe('shouldShowWalletSyncWarning', () => {
  it('hides one-block catch-up warnings while keeping operations gated until synced', () => {
    const catchingUp = sync()
    expect(shouldShowWalletSyncWarning('p2p', catchingUp, completed)).toBe(false)
    expect(isWalletSyncIncomplete('p2p', catchingUp.phase)).toBe(true)
  })

  it('shows warnings when more than one new block arrived', () => {
    expect(shouldShowWalletSyncWarning('p2p', sync({tipHeight: 102, estimatedChainHeight: 102}), completed)).toBe(true)
  })

  it('shows warnings during initial sync even if only one block remains', () => {
    expect(shouldShowWalletSyncWarning('p2p', sync(), null)).toBe(true)
  })

  it('shows warnings for a historical rescan, sync error, or different wallet', () => {
    expect(shouldShowWalletSyncWarning('p2p', sync({cfilterScanHeight: 50}), completed)).toBe(true)
    expect(shouldShowWalletSyncWarning('p2p', sync({lastError: 'peer failed'}), completed)).toBe(true)
    expect(shouldShowWalletSyncWarning('p2p', sync({walletId: 'wallet-2'}), completed)).toBe(true)
  })

  it('keeps warnings when P2P is stopped or status is unavailable', () => {
    expect(shouldShowWalletSyncWarning('p2p', sync({phase: WalletSyncPhase.Stopped}), completed)).toBe(true)
    expect(shouldShowWalletSyncWarning('p2p', undefined, completed)).toBe(true)
  })

  it('does not show P2P warnings in RPC mode or after sync completes', () => {
    expect(shouldShowWalletSyncWarning('rpc', sync({tipHeight: 102, estimatedChainHeight: 102}), completed)).toBe(false)
    expect(shouldShowWalletSyncWarning('p2p', sync({phase: WalletSyncPhase.Synced}), completed)).toBe(false)
  })
})
