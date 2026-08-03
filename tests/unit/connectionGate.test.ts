import { describe, it, expect } from 'vitest'
import { connectionGate } from '../../src/renderer/src/utils/connectionGate'
import { WalletSyncPhase } from '../../src/renderer/src/enums/WalletSyncPhase'

const NOT_SYNCED: WalletSyncPhase[] = Object.values(WalletSyncPhase).filter(p => p !== WalletSyncPhase.Synced)

describe('connectionGate', () => {
  it('never gates in rpc mode, whatever the sync phase', () => {
    for (const phase of [...NOT_SYNCED, WalletSyncPhase.Synced, undefined]) {
      expect(connectionGate('rpc', phase)).toEqual({
        actionsGated: false,
        dataIncomplete: false,
        dataSourceLabel: 'Insight API',
      })
    }
  })

  it('does not gate in p2p mode once synced', () => {
    expect(connectionGate('p2p', WalletSyncPhase.Synced)).toEqual({
      actionsGated: false,
      dataIncomplete: false,
      dataSourceLabel: 'Local P2P',
    })
  })

  it('gates in p2p mode for every non-synced phase', () => {
    for (const phase of NOT_SYNCED) {
      expect(connectionGate('p2p', phase)).toEqual({
        actionsGated: true,
        dataIncomplete: true,
        dataSourceLabel: 'Local P2P (syncing)',
      })
    }
  })

  it('gates in p2p mode when the phase is unknown', () => {
    expect(connectionGate('p2p', undefined)).toEqual({
      actionsGated: true,
      dataIncomplete: true,
      dataSourceLabel: 'Local P2P (syncing)',
    })
  })
})
