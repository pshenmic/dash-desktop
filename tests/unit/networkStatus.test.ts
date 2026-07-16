import { describe, it, expect } from 'vitest'
import { describeDataSource, describeNetworkStatus, formatChange24h } from '../../src/renderer/src/utils/networkStatus'
import { WalletSyncPhase, WalletSyncStatus } from '../../src/renderer/src/api/types'

function sync(overrides: Partial<WalletSyncStatus>): WalletSyncStatus {
  return {
    phase: 'synced',
    network: 'mainnet',
    walletId: 'w1',
    tipHeight: 100,
    tipHash: null,
    estimatedChainHeight: 100,
    cfheadersHeight: 100,
    cfilterScanHeight: 100,
    matchedBlocksPending: 0,
    peerCount: 4,
    filterCapablePeerCount: 4,
    phaseEtaMs: null,
    lastError: null,
    updatedAt: 0,
    ...overrides
  }
}

describe('describeNetworkStatus', () => {
  it('is operational when no sync status exists', () => {
    expect(describeNetworkStatus(undefined)).toEqual({ label: 'Operational', tone: 'ok' })
  })

  it('is operational when synced', () => {
    expect(describeNetworkStatus(sync({ phase: 'synced' }))).toEqual({ label: 'Operational', tone: 'ok' })
  })

  it('is operational when sync is stopped or idle (rpc fallback serves data)', () => {
    expect(describeNetworkStatus(sync({ phase: 'stopped' })).tone).toBe('ok')
    expect(describeNetworkStatus(sync({ phase: 'idle' })).tone).toBe('ok')
  })

  it('is syncing during any active phase', () => {
    const active: WalletSyncPhase[] = [
      'connecting',
      'syncing-headers',
      'synced-headers',
      'syncing-cfcheckpt',
      'syncing-cfheaders',
      'syncing-cfilters'
    ]
    for (const phase of active) {
      expect(describeNetworkStatus(sync({ phase }))).toEqual({ label: 'Syncing', tone: 'busy' })
    }
  })

  it('is degraded when the sync reports an error', () => {
    expect(describeNetworkStatus(sync({ lastError: 'peer timeout' }))).toEqual({ label: 'Degraded', tone: 'warn' })
  })
})

describe('describeDataSource', () => {
  it('reports local p2p only when desired and synced', () => {
    expect(describeDataSource('p2p', 'synced')).toBe('Local P2P')
  })

  it('reports insight otherwise', () => {
    expect(describeDataSource('p2p', 'syncing-headers')).toBe('Insight API')
    expect(describeDataSource('p2p', undefined)).toBe('Insight API')
    expect(describeDataSource('rpc', 'synced')).toBe('Insight API')
  })
})

describe('formatChange24h', () => {
  it('formats gains with an up arrow', () => {
    expect(formatChange24h(1.412)).toBe('↑1.41%')
  })

  it('formats losses with a down arrow and no sign', () => {
    expect(formatChange24h(-2.5)).toBe('↓2.50%')
  })

  it('treats zero as up', () => {
    expect(formatChange24h(0)).toBe('↑0.00%')
  })
})
