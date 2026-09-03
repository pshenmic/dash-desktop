import { describe, expect, it } from 'vitest'
import { PLATFORM_INPUT_LIMIT } from '../../src/renderer/src/constants/platform'
import { SHIELDED_NOTE_LIMIT } from '../../src/renderer/src/constants/shielded'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import type { CoinControlInventory, CoinControlSelection } from '../../src/renderer/src/types/CoinControl'
import {
  automaticCoinControl,
  coinControlSourceKind,
  normalizeCoinControlSelection,
  toCoreSpendSource,
  toPlatformSpendSource,
  toShieldedSpendSource,
} from '../../src/renderer/src/utils/coinControl'

const inventory: CoinControlInventory = {
  coreAddresses: ['core-a'],
  coreOutpoints: ['tx-a:0', 'tx-b:1'],
  platformBalances: {'platform-a': 5_000_000n, 'platform-b': 7_000_000n},
  shieldedAddresses: ['shielded-a'],
  shieldedNoteIndexes: [4, 8],
}

describe('coin control', () => {
  it.each([
    [TransferOperation.CoreSend, SourceKind.Core],
    [TransferOperation.AssetLockFunding, SourceKind.Core],
    [TransferOperation.AssetLockShield, SourceKind.Core],
    [TransferOperation.IdentityRegister, SourceKind.Core],
    [TransferOperation.IdentityTopUpL1, SourceKind.Core],
    [TransferOperation.AddressFundsTransfer, SourceKind.PlatformAddress],
    [TransferOperation.AddressWithdrawal, SourceKind.PlatformAddress],
    [TransferOperation.IdentityCreate, SourceKind.PlatformAddress],
    [TransferOperation.IdentityTopUp, SourceKind.PlatformAddress],
    [TransferOperation.ShieldedTransfer, SourceKind.Shielded],
    [TransferOperation.Unshield, SourceKind.Shielded],
    [TransferOperation.ShieldedWithdrawal, SourceKind.Shielded],
    [TransferOperation.IdentityToAddress, null],
    [TransferOperation.IdentityToIdentity, null],
    [TransferOperation.IdentityWithdrawal, null],
    [TransferOperation.Shield, null],
    [TransferOperation.IdentityCreateFromShielded, null],
  ])('maps %s to the source selection supported by its backend contract', (operation, expected) => {
    expect(coinControlSourceKind(operation)).toBe(expected)
  })

  it('converts Core address and outpoint selections', () => {
    expect(toCoreSpendSource({kind: 'coreAddress', address: 'core-a'}, [])).toEqual({
      kind: 'address',
      address: 'core-a',
    })
    expect(toCoreSpendSource({kind: 'coreOutpoints', outpoints: ['tx-b:1']}, [
      {txid: 'tx-a', vout: 0, satoshis: 1n, address: 'core-a', height: 1},
      {txid: 'tx-b', vout: 1, satoshis: 2n, address: 'core-a', height: 1},
    ])).toEqual({kind: 'outpoints', outpoints: [{txid: 'tx-b', vout: 1}]})
  })

  it('converts Platform inputs with their caps and fee payer', () => {
    expect(toPlatformSpendSource({
      kind: 'platformInputs',
      inputs: [
        {address: 'platform-a', credits: 2_000_000n},
        {address: 'platform-b', credits: 3_000_000n},
      ],
      feeAddress: 'platform-b',
    })).toEqual({
      kind: 'inputs',
      inputs: [
        {address: 'platform-a', credits: 2_000_000n},
        {address: 'platform-b', credits: 3_000_000n},
      ],
      feeStrategy: [{kind: 'deductFromInput', address: 'platform-b'}],
    })
  })

  it('converts a shielded address to its notes and preserves explicit notes', () => {
    const notes = [
      {index: 4, amount: 1n, spent: false, address: 'shielded-a'},
      {index: 8, amount: 2n, spent: false, address: 'shielded-a'},
      {index: 9, amount: 3n, spent: false, address: 'shielded-b'},
    ]
    expect(toShieldedSpendSource({kind: 'shieldedAddress', address: 'shielded-a'}, notes)).toEqual({
      kind: 'address',
      noteIndexes: [4, 8],
    })
    expect(toShieldedSpendSource({kind: 'shieldedNotes', noteIndexes: [8]}, notes)).toEqual({
      kind: 'notes',
      noteIndexes: [8],
    })
  })

  it('resets an incompatible route or disappeared input to automatic', () => {
    const core: CoinControlSelection = {kind: 'coreOutpoints', outpoints: ['tx-a:0']}
    expect(normalizeCoinControlSelection(core, TransferOperation.AddressFundsTransfer, inventory)).toEqual(automaticCoinControl())
    expect(normalizeCoinControlSelection(
      {kind: 'shieldedNotes', noteIndexes: [99]},
      TransferOperation.ShieldedTransfer,
      inventory,
    )).toEqual(automaticCoinControl())
  })

  it('rejects selections beyond route limits and invalid Platform input caps', () => {
    const platformInputs = Array.from({length: PLATFORM_INPUT_LIMIT + 1}, (_, index) => ({
      address: `platform-${index}`,
      credits: 1n,
    }))
    const platformInventory = {
      ...inventory,
      platformBalances: Object.fromEntries(platformInputs.map(input => [input.address, 1n])),
    }
    expect(normalizeCoinControlSelection({
      kind: 'platformInputs',
      inputs: platformInputs,
      feeAddress: platformInputs[0].address,
    }, TransferOperation.AddressFundsTransfer, platformInventory)).toEqual(automaticCoinControl())

    expect(normalizeCoinControlSelection({
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 5_000_001n}],
      feeAddress: 'platform-a',
    }, TransferOperation.AddressFundsTransfer, inventory)).toEqual(automaticCoinControl())

    expect(normalizeCoinControlSelection({
      kind: 'shieldedNotes',
      noteIndexes: Array.from({length: SHIELDED_NOTE_LIMIT + 1}, (_, index) => index),
    }, TransferOperation.ShieldedTransfer, {
      ...inventory,
      shieldedNoteIndexes: Array.from({length: SHIELDED_NOTE_LIMIT + 1}, (_, index) => index),
    })).toEqual(automaticCoinControl())
  })
})
