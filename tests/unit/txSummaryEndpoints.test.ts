import { describe, it, expect } from 'vitest'
import {
  coreRecipientEndpoints,
  destinationEndpoint,
  recipientEndpoints,
  shieldedSpendEndpoints,
  sourceEndpoint,
} from '../../src/renderer/src/utils/txSummaryEndpoints'
import { AUTOMATIC_SOURCE_LABELS } from '../../src/renderer/src/constants/sendPages'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { ShieldedSpendKind } from '../../src/renderer/src/enums/ShieldedSpendKind'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { TxEndpointKind } from '../../src/renderer/src/enums/TxEndpointKind'

describe('sourceEndpoint', () => {
  it('shows an identity id as an address', () => {
    expect(sourceEndpoint(SourceKind.Identity, { kind: 'automatic' }, 'Automatic', 'identity-id'))
      .toEqual({ value: 'identity-id', kind: TxEndpointKind.Address })
  })

  it('shows a coin-control Core or Platform address as an address', () => {
    expect(sourceEndpoint(SourceKind.Core, { kind: 'coreAddress', address: 'yCore' }, 'One Core address'))
      .toEqual({ value: 'yCore', kind: TxEndpointKind.Address })
    expect(sourceEndpoint(SourceKind.PlatformAddress, { kind: 'platformAddress', address: 'tdash1abc' }, 'One Platform address'))
      .toEqual({ value: 'tdash1abc', kind: TxEndpointKind.Address })
  })

  it('shows a coin-control shielded address as a shielded endpoint', () => {
    expect(sourceEndpoint(SourceKind.Shielded, { kind: 'shieldedAddress', address: 'shielded1' }, 'One shielded address'))
      .toEqual({ value: 'shielded1', kind: TxEndpointKind.Shielded })
  })

  it('labels an automatic selection by its source', () => {
    for (const source of [SourceKind.Core, SourceKind.PlatformAddress, SourceKind.Shielded] as const) {
      expect(sourceEndpoint(source, { kind: 'automatic' }, 'Automatic'))
        .toEqual({ value: AUTOMATIC_SOURCE_LABELS[source], kind: TxEndpointKind.Label })
    }
  })

  it('labels a multi-input selection with its coin-control summary', () => {
    expect(sourceEndpoint(SourceKind.Core, { kind: 'coreOutpoints', outpoints: ['tx:0', 'tx:1'] }, '2 UTXOs · 0.5 Dash'))
      .toEqual({ value: '2 UTXOs · 0.5 Dash', kind: TxEndpointKind.Label })
    expect(sourceEndpoint(SourceKind.PlatformAddress, {
      kind: 'platformInputs',
      inputs: [{ address: 'a', credits: 1n }, { address: 'b', credits: 2n }],
      feeAddress: 'a',
    }, '2 inputs · 0.5 Dash')).toEqual({ value: '2 inputs · 0.5 Dash', kind: TxEndpointKind.Label })
    expect(sourceEndpoint(SourceKind.Shielded, { kind: 'shieldedNotes', noteIndexes: [1] }, '1 note · 0.1 Dash'))
      .toEqual({ value: '1 note · 0.1 Dash', kind: TxEndpointKind.Label })
  })
})

describe('destinationEndpoint', () => {
  it('labels a new identity', () => {
    expect(destinationEndpoint(DestinationKind.NewIdentity, 'New identity'))
      .toEqual({ value: 'New identity', kind: TxEndpointKind.Label })
  })

  it('marks a shielded destination', () => {
    expect(destinationEndpoint(DestinationKind.Shielded, 'shielded1'))
      .toEqual({ value: 'shielded1', kind: TxEndpointKind.Shielded })
  })

  it('shows Core, Platform and identity destinations as addresses', () => {
    for (const kind of [DestinationKind.CoreAddress, DestinationKind.PlatformAddress, DestinationKind.Identity]) {
      expect(destinationEndpoint(kind, 'dest')).toEqual({ value: 'dest', kind: TxEndpointKind.Address })
    }
  })
})

describe('recipientEndpoints', () => {
  const recipients = [
    { address: 'tdash1a', amountCredits: 100n },
    { address: 'tdash1b', amountCredits: 200n },
  ]

  it('maps every recipient with its amount and no fee payer by default', () => {
    expect(recipientEndpoints(recipients)).toEqual([
      { value: 'tdash1a', kind: TxEndpointKind.Address, amount: 100n, paysFee: false },
      { value: 'tdash1b', kind: TxEndpointKind.Address, amount: 200n, paysFee: false },
    ])
  })

  it('flags the fee-paying output', () => {
    expect(recipientEndpoints(recipients, 1).map(endpoint => endpoint.paysFee)).toEqual([false, true])
  })

  it('flags nothing when the fee recipient is not found', () => {
    expect(recipientEndpoints(recipients, -1).map(endpoint => endpoint.paysFee)).toEqual([false, false])
  })
})

describe('coreRecipientEndpoints', () => {
  it('maps every Core recipient with its duffs amount', () => {
    expect(coreRecipientEndpoints([
      { address: 'yA', amountDuffs: 100n },
      { address: 'yB', amountDuffs: 200n },
    ])).toEqual([
      { value: 'yA', kind: TxEndpointKind.Address, amount: 100n },
      { value: 'yB', kind: TxEndpointKind.Address, amount: 200n },
    ])
  })
})

describe('shieldedSpendEndpoints', () => {
  it('maps shielded transfer recipients as shielded endpoints with amounts', () => {
    expect(shieldedSpendEndpoints(ShieldedSpendKind.Transfer, '', [{ address: 'shielded1', amountCredits: 500n }]))
      .toEqual([{ value: 'shielded1', kind: TxEndpointKind.Shielded, amount: 500n }])
  })

  it('labels the identity a create makes', () => {
    expect(shieldedSpendEndpoints(ShieldedSpendKind.IdentityCreate, 'New Platform identity with 6 keys'))
      .toEqual([{ value: 'New Platform identity with 6 keys', kind: TxEndpointKind.Label }])
  })

  it('shows an unshield or withdrawal destination as an address', () => {
    for (const kind of [ShieldedSpendKind.Unshield, ShieldedSpendKind.Withdrawal]) {
      expect(shieldedSpendEndpoints(kind, 'dest')).toEqual([{ value: 'dest', kind: TxEndpointKind.Address }])
    }
  })
})
