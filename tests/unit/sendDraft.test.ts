import { afterEach, describe, expect, it } from 'vitest'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import type { CoinControlSelection } from '../../src/renderer/src/types/CoinControl'
import { isCoinControlSelectionValid } from '../../src/renderer/src/utils/coinControl'
import {
  clearSendDraft,
  createSendDraft,
  getOrCreateSendDraft,
  getAdvancedSendRoute,
  saveSendDraft,
  setSendAdvanced,
  resetCurrentSendRoute,
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

  it('seeds advanced recipients once and preserves them across mode toggles', () => {
    const simple = {...createSendDraft(), toValue: 'first-recipient', amount: '1.25'}
    const advanced = setSendAdvanced(simple, true)
    expect(getAdvancedSendRoute(advanced, TransferOperation.CoreSend).recipients).toEqual([
      {id: 'first', address: 'first-recipient', amount: '1.25'},
    ])
    const route = {
      recipients: [
        {id: 'first', address: 'first-recipient', amount: '0.75'},
        {id: 'second', address: 'second-recipient', amount: '0.5'},
      ],
      subtractFee: false,
      feeRecipientId: null,
    }
    const edited = {...advanced, advancedRoutes: {[TransferOperation.CoreSend]: route}}
    const toggled = setSendAdvanced({...setSendAdvanced(edited, false), toValue: 'simple-edit', amount: '9'}, true)
    expect(getAdvancedSendRoute(toggled, TransferOperation.CoreSend)).toEqual(route)
    expect(toggled).toMatchObject({advanced: true, toValue: 'simple-edit', amount: '9'})
    expect(simple.advancedRoutes).toEqual({})
  })

  it('preserves unfinished advanced recipients after sending in simple mode', () => {
    const route = {
      recipients: [
        {id: 'first', address: 'first-recipient', amount: '0.75'},
        {id: 'second', address: 'second-recipient', amount: '0.5'},
      ],
      subtractFee: true,
      feeRecipientId: 'second',
    }
    const advanced = {
      ...setSendAdvanced(createSendDraft(), true),
      advancedRoutes: {[TransferOperation.CoreSend]: route},
    }
    const simple = {
      ...setSendAdvanced(advanced, false),
      toValue: 'simple-recipient',
      amount: '3',
      acked: true,
    }

    const reset = resetCurrentSendRoute(simple)

    expect(reset).toMatchObject({advanced: false, toValue: '', amount: '', acked: false, coinControl: {kind: 'automatic'}})
    expect(getAdvancedSendRoute(setSendAdvanced(reset, true), TransferOperation.CoreSend)).toEqual(route)
    expect(simple.toValue).toBe('simple-recipient')
    expect(simple.advancedRoutes[TransferOperation.CoreSend]).toEqual(route)
  })

  it('clears only the sent route and preserves other unfinished recipients', () => {
    const draft = setSendAdvanced({...createSendDraft(), toValue: 'sent', amount: '1'}, true)
    const other = {recipients: [{id: 'other', address: 'unfinished', amount: '2'}], subtractFee: true, feeRecipientId: 'other'}
    const reset = resetCurrentSendRoute({...draft, advancedRoutes: {...draft.advancedRoutes, [TransferOperation.AddressFundsTransfer]: other}})
    expect(reset).toMatchObject({advanced: true, toValue: '', amount: '', coinControl: {kind: 'automatic'}})
    expect(reset.advancedRoutes[TransferOperation.CoreSend]).toBeUndefined()
    expect(reset.advancedRoutes[TransferOperation.AddressFundsTransfer]).toEqual(other)
    expect(draft.advancedRoutes[TransferOperation.CoreSend]?.recipients[0].address).toBe('sent')
  })

  it('keeps change address choices per route and wallet, across mode switches, until the route resets', () => {
    const core = setSendAdvanced(createSendDraft(), true)
    const draft = {
      ...core,
      advancedRoutes: {
        [TransferOperation.CoreSend]: {...getAdvancedSendRoute(core, TransferOperation.CoreSend), changeAddress: 'core-change'},
        [TransferOperation.AssetLockFunding]: {...getAdvancedSendRoute(core, TransferOperation.AssetLockFunding), changeAddress: 'lock-change'},
      },
    }
    saveSendDraft('wallet-a', setSendAdvanced(draft, false))
    const restored = setSendAdvanced(getOrCreateSendDraft('wallet-a', null, null), true)
    expect(getAdvancedSendRoute(restored, TransferOperation.CoreSend).changeAddress).toBe('core-change')
    expect(getAdvancedSendRoute(restored, TransferOperation.AssetLockFunding).changeAddress).toBe('lock-change')
    expect(getAdvancedSendRoute(getOrCreateSendDraft('wallet-b', null, null), TransferOperation.CoreSend).changeAddress).toBeUndefined()
    const reset = resetCurrentSendRoute(restored)
    expect(getAdvancedSendRoute(reset, TransferOperation.CoreSend).changeAddress).toBeUndefined()
    expect(getAdvancedSendRoute(reset, TransferOperation.AssetLockFunding).changeAddress).toBe('lock-change')
  })

  it('preserves independent advanced route drafts and payer selection across wallets', () => {
    const core = setSendAdvanced({...createSendDraft(), toValue: 'core-recipient', amount: '1'}, true)
    saveSendDraft('wallet-a', core)
    const platform = setSendAdvanced({
      ...getOrCreateSendDraft('wallet-a', SourceKind.PlatformAddress, DestinationKind.PlatformAddress),
      toValue: 'platform-recipient',
      amount: '2',
    }, true)
    const platformRoute = {
      ...getAdvancedSendRoute(platform, TransferOperation.AddressFundsTransfer),
      subtractFee: true,
      feeRecipientId: 'first',
    }
    saveSendDraft('wallet-a', {
      ...platform,
      advancedRoutes: {...platform.advancedRoutes, [TransferOperation.AddressFundsTransfer]: platformRoute},
    })
    expect(getOrCreateSendDraft('wallet-b', null, null)).toMatchObject({advanced: false, advancedRoutes: {}})
    const restored = getOrCreateSendDraft('wallet-a', SourceKind.Core, DestinationKind.CoreAddress)
    expect(restored.advanced).toBe(true)
    expect(getAdvancedSendRoute(restored, TransferOperation.CoreSend).recipients[0]).toMatchObject({address: 'core-recipient', amount: '1'})
    expect(getAdvancedSendRoute(restored, TransferOperation.AddressFundsTransfer)).toEqual(platformRoute)
    expect(getAdvancedSendRoute(restored, TransferOperation.ShieldedTransfer)).toEqual({
      recipients: [{id: 'first', address: '', amount: ''}], subtractFee: false, feeRecipientId: null,
    })
    clearSendDraft('wallet-a')
    expect(getOrCreateSendDraft('wallet-a', null, null).advancedRoutes).toEqual({})
  })
})
