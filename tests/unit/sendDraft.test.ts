import { afterEach, describe, expect, it } from 'vitest'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import type { CoinControlSelection } from '../../src/renderer/src/types/CoinControl'
import { isCoinControlSelectionValid } from '../../src/renderer/src/utils/coinControl'
import {
  clearSendDraft,
  createSendDraft,
  getOrCreateSendDraft,
  saveSendDraft,
} from '../../src/renderer/src/utils/sendDraft'

describe('send drafts', () => {
  afterEach(() => {
    clearSendDraft('wallet-a')
    clearSendDraft('wallet-b')
  })

  it('uses valid URL endpoints only when creating a draft', () => {
    expect(createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress)).toMatchObject({
      fromKind: SourceKind.Identity,
      toKind: DestinationKind.PlatformAddress,
    })
    expect(createSendDraft('invalid', 'invalid')).toMatchObject({
      fromKind: SourceKind.Core,
      toKind: DestinationKind.CoreAddress,
      coinControl: {kind: 'automatic'},
    })
  })

  it('restores the complete form draft while applying valid URL endpoints', () => {
    const draft = {
      ...createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress),
      fromAddress: 'platform-source',
      fromIdentity: 'identity-source',
      toValue: 'recipient',
      amount: '1.25',
      acked: true,
    }
    saveSendDraft('wallet-a', draft)

    expect(getOrCreateSendDraft('wallet-a', SourceKind.Core, DestinationKind.CoreAddress)).toEqual({
      ...draft,
      fromKind: SourceKind.Core,
      toKind: DestinationKind.CoreAddress,
    })
  })

  it('only applies URL endpoints that are explicitly provided and valid', () => {
    const draft = createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress)
    saveSendDraft('wallet-a', draft)

    expect(getOrCreateSendDraft('wallet-a', null, DestinationKind.Shielded)).toMatchObject({
      fromKind: SourceKind.Identity,
      toKind: DestinationKind.Shielded,
    })
    expect(getOrCreateSendDraft('wallet-a', 'invalid', null)).toMatchObject({
      fromKind: SourceKind.Identity,
      toKind: DestinationKind.Shielded,
    })
  })

  it('keeps drafts isolated by wallet and removes a cleared draft', () => {
    const walletA = {
      ...createSendDraft(),
      toValue: 'wallet-a-recipient',
      coinControl: {kind: 'coreAddress', address: 'core-a'} as CoinControlSelection,
    }
    saveSendDraft('wallet-a', walletA)

    expect(getOrCreateSendDraft('wallet-b', SourceKind.Shielded, DestinationKind.Shielded)).toMatchObject({
      fromKind: SourceKind.Shielded,
      toKind: DestinationKind.Shielded,
      toValue: '',
      coinControl: {kind: 'automatic'},
    })

    clearSendDraft('wallet-a')
    expect(getOrCreateSendDraft('wallet-a', SourceKind.Core, DestinationKind.PlatformAddress)).toMatchObject({
      fromKind: SourceKind.Core,
      toKind: DestinationKind.PlatformAddress,
      toValue: '',
      coinControl: {kind: 'automatic'},
    })
  })

  it.each<{from: SourceKind; selection: CoinControlSelection}>([
    {from: SourceKind.Core, selection: {kind: 'coreAddress', address: 'core-a'}},
    {from: SourceKind.Core, selection: {kind: 'coreOutpoints', outpoints: ['tx-a:0', 'tx-b:1']}},
    {from: SourceKind.PlatformAddress, selection: {kind: 'platformAddress', address: 'platform-a'}},
    {
      from: SourceKind.PlatformAddress,
      selection: {
        kind: 'platformInputs',
        inputs: [{address: 'platform-a', credits: 9_007_199_254_740_993n}, {address: 'platform-b', credits: 3n}],
        feeAddress: 'platform-b',
      },
    },
    {from: SourceKind.Shielded, selection: {kind: 'shieldedAddress', address: 'shielded-a'}},
    {from: SourceKind.Shielded, selection: {kind: 'shieldedNotes', noteIndexes: [4, 8]}},
  ])('restores $selection.kind together with the recipient and amount', ({from, selection}) => {
    const draft = {
      ...createSendDraft(from, DestinationKind.CoreAddress),
      toValue: 'recipient',
      amount: '1.25',
      coinControl: selection,
    }
    saveSendDraft('wallet-a', draft)

    expect(getOrCreateSendDraft('wallet-a', null, null)).toEqual(draft)
  })

  it('retains a restored selection until its inventory can be validated', () => {
    const selection: CoinControlSelection = {kind: 'coreOutpoints', outpoints: ['tx-a:0']}
    saveSendDraft('wallet-a', {...createSendDraft(), coinControl: selection})

    const restored = getOrCreateSendDraft('wallet-a', null, null)
    expect(isCoinControlSelectionValid(restored.coinControl, {
      coreAddresses: [], coreOutpoints: [], platformBalances: {}, shieldedAddresses: [], shieldedNoteIndexes: [],
    })).toBe(false)
    expect(getOrCreateSendDraft('wallet-a', null, null).coinControl).toEqual(selection)
  })

  it('preserves compatible URL route changes and clears an incompatible selection', () => {
    const selection: CoinControlSelection = {kind: 'coreOutpoints', outpoints: ['tx-a:0']}
    saveSendDraft('wallet-a', {...createSendDraft(), coinControl: selection, amount: '1.25'})

    expect(getOrCreateSendDraft('wallet-a', null, DestinationKind.PlatformAddress).coinControl).toEqual(selection)
    expect(getOrCreateSendDraft('wallet-a', SourceKind.PlatformAddress, null)).toMatchObject({
      amount: '1.25',
      coinControl: {kind: 'automatic'},
    })
  })
})
