import { describe, expect, it } from 'vitest'
import { WalletSyncPhase } from '../../src/renderer/src/enums/WalletSyncPhase'
import { shouldOfferP2pSwitch } from '../../src/renderer/src/utils/walletSync'

describe('shouldOfferP2pSwitch', () => {
  it('offers P2P after the selected RPC wallet finishes synchronization', () => {
    expect(shouldOfferP2pSwitch('rpc', WalletSyncPhase.Synced, 'wallet-1', 'wallet-1', false)).toBe(true)
  })

  it('does not offer P2P when P2P is already selected', () => {
    expect(shouldOfferP2pSwitch('p2p', WalletSyncPhase.Synced, 'wallet-1', 'wallet-1', false)).toBe(false)
  })

  it.each([
    WalletSyncPhase.Idle,
    WalletSyncPhase.Connecting,
    WalletSyncPhase.SyncingHeaders,
    WalletSyncPhase.SyncingCfilters,
    WalletSyncPhase.Stopped,
  ])('does not offer P2P during the %s phase', (phase) => {
    expect(shouldOfferP2pSwitch('rpc', phase, 'wallet-1', 'wallet-1', false)).toBe(false)
  })

  it('does not offer P2P for synchronization belonging to another wallet', () => {
    expect(shouldOfferP2pSwitch('rpc', WalletSyncPhase.Synced, 'wallet-2', 'wallet-1', false)).toBe(false)
  })

  it('does not offer P2P after the selected wallet dismissed the prompt', () => {
    expect(shouldOfferP2pSwitch('rpc', WalletSyncPhase.Synced, 'wallet-1', 'wallet-1', true)).toBe(false)
  })

  it('does not offer P2P without a selected wallet', () => {
    expect(shouldOfferP2pSwitch('rpc', WalletSyncPhase.Synced, 'wallet-1', null, false)).toBe(false)
  })
})
