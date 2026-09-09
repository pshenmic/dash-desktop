import { describe, expect, it } from 'vitest'
import { PLATFORM_INPUT_LIMIT } from '../../src/renderer/src/constants/platform'
import { SHIELDED_NOTE_LIMIT } from '../../src/renderer/src/constants/shielded'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import type { CoinControlFunds, CoinControlInventory, CoinControlSelection } from '../../src/renderer/src/types/CoinControl'
import {
  automaticCoinControl,
  buildCoinControlInventory,
  coinControlSelectionSummary,
  coinControlSelectionTotals,
  coinControlSourceKind,
  coreSpendSourceKey,
  isCoinControlSelectionValid,
  normalizeCoinControlSelection,
  parsePlatformInputCredits,
  platformSpendSourceKey,
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

const funds: CoinControlFunds = {
  coreAddresses: [{
    walletId: 'wallet-a', accountId: 0, address: 'core-a', derivationPath: '', index: 0,
    isChange: 0, isUsed: true, balance: 100_000_000n, txCount: 1, label: null, usdBalance: null,
  }],
  utxos: [
    {txid: 'tx-a', vout: 0, satoshis: 1n, address: 'core-a', height: 1},
    {txid: 'tx-b', vout: 1, satoshis: 99_999_999n, address: 'core-a', height: 1},
  ],
  platformAddresses: [
    {platformAddress: 'platform-a', balanceCredits: 5_000_000n, nonce: 0},
    {platformAddress: 'platform-b', balanceCredits: 7_000_000n, nonce: 0},
  ],
  shieldedNotes: [
    {index: 4, address: 'shielded-a', amount: 1_000n, spent: false},
    {index: 8, address: 'shielded-a', amount: 1_999n, spent: false},
    {index: 99, address: 'shielded-spent', amount: 1_000_000n, spent: true},
  ],
}

describe('coin control', () => {
  it('preserves Core fee-cache keys for automatic, address and ordered outpoint sources', () => {
    expect(coreSpendSourceKey(null)).toBe('')
    expect(coreSpendSourceKey({kind: 'address', address: 'core-a'})).toBe('core-a')
    expect(coreSpendSourceKey({kind: 'outpoints', outpoints: [{txid: 'tx-b', vout: 1}, {txid: 'tx-a', vout: 0}]})).toBe('tx-b:1,tx-a:0')
  })

  it('preserves Platform fee-cache keys including exact caps and ordered fee strategies', () => {
    expect(platformSpendSourceKey(null)).toBe('')
    expect(platformSpendSourceKey({kind: 'address', address: 'platform-a'})).toBe('platform-a')
    expect(platformSpendSourceKey({
      kind: 'inputs',
      inputs: [{address: 'platform-b', credits: 9_007_199_254_740_993n}, {address: 'platform-a', credits: 1n}],
      feeStrategy: [{kind: 'reduceOutput', index: 0}, {kind: 'deductFromInput', address: 'platform-b'}],
    })).toBe('platform-b:9007199254740993,platform-a:1|0,platform-b')
  })

  it('builds validation inventory without spent notes and duplicate shielded addresses', () => {
    expect(buildCoinControlInventory(funds)).toEqual(inventory)
  })

  it('counts missing selections but never substitutes unselected Core funds into their total', () => {
    expect(coinControlSelectionTotals({kind: 'coreOutpoints', outpoints: ['tx-a:0', 'missing:1']}, funds)).toEqual({
      count: 2, duffs: 1n, credits: 1_000n,
    })
    expect(coinControlSelectionTotals({kind: 'coreAddress', address: 'core-a'}, funds)).toEqual({
      count: 1, duffs: 100_000_000n, credits: 100_000_000_000n,
    })
    expect(coinControlSelectionTotals({kind: 'coreAddress', address: 'missing'}, funds).duffs).toBe(0n)
  })

  it('totals Platform input caps exactly without replacing caps with address balances', () => {
    expect(coinControlSelectionTotals({
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 9_007_199_254_740_993n}, {address: 'platform-b', credits: 9n}],
      feeAddress: 'platform-b',
    }, funds)).toEqual({count: 2, credits: 9_007_199_254_741_002n, duffs: 9_007_199_254_741n})
    expect(coinControlSelectionTotals({kind: 'platformAddress', address: 'platform-a'}, funds).credits).toBe(5_000_000n)
  })

  it('retains sub-duff credits and excludes spent shielded notes from totals', () => {
    expect(coinControlSelectionTotals({kind: 'shieldedAddress', address: 'shielded-a'}, funds)).toEqual({
      count: 1, credits: 2_999n, duffs: 2n,
    })
    expect(coinControlSelectionTotals({kind: 'shieldedNotes', noteIndexes: [8, 99]}, funds)).toEqual({
      count: 2, credits: 1_999n, duffs: 1n,
    })
  })

  it('formats address summaries with the optional registration balance and input counts consistently', () => {
    const address: CoinControlSelection = {kind: 'coreAddress', address: 'core-a'}
    const totals = coinControlSelectionTotals(address, funds)
    expect(coinControlSelectionSummary(address, totals)).toBe('One Core address')
    expect(coinControlSelectionSummary(address, totals, true)).toBe('One Core address · 1 Dash')
    const inputs: CoinControlSelection = {kind: 'coreOutpoints', outpoints: ['tx-a:0', 'tx-b:1']}
    expect(coinControlSelectionSummary(inputs, coinControlSelectionTotals(inputs, funds))).toBe('2 UTXOs · 1 Dash')
    const automatic = automaticCoinControl()
    expect(coinControlSelectionSummary(automatic, coinControlSelectionTotals(automatic, funds))).toBe('Automatic')
  })

  it.each<[string, bigint]>([
    ['', 0n],
    ['0', 0n],
    ['000', 0n],
    ['00123', 123n],
    ['9007199254740993', 9_007_199_254_740_993n],
    ['9999999999999999999999999999999999999999', 9999999999999999999999999999999999999999n],
  ])('parses a whole credit limit %j without losing precision', (value, expected) => {
    expect(parsePlatformInputCredits(value)).toBe(expected)
  })

  it.each(['1.5', '.5', '1.', '-100', '+100', '1e3', '0x10', '1_000', '12abc', ' 12', '12 ', '12\n', '١٢'])(
    'rejects malformed credit limit %j instead of changing its meaning', value => {
      expect(parsePlatformInputCredits(value)).toBeNull()
    },
  )

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

  it('resets only an incompatible route to automatic', () => {
    const core: CoinControlSelection = {kind: 'coreOutpoints', outpoints: ['tx-a:0']}
    expect(normalizeCoinControlSelection(core, TransferOperation.AddressFundsTransfer)).toEqual(automaticCoinControl())
    expect(normalizeCoinControlSelection(core, TransferOperation.AssetLockFunding)).toBe(core)
    expect(normalizeCoinControlSelection(core, null)).toEqual(automaticCoinControl())
  })

  it('preserves manual UTXOs while inventory is empty and validates them again after reload', () => {
    const selection: CoinControlSelection = {kind: 'coreOutpoints', outpoints: ['tx-a:0']}
    const applied = normalizeCoinControlSelection(selection, TransferOperation.CoreSend)
    expect(applied).toBe(selection)
    expect(isCoinControlSelectionValid(applied, {...inventory, coreOutpoints: []})).toBe(false)
    expect(isCoinControlSelectionValid(applied, inventory)).toBe(true)
    expect(toCoreSpendSource(applied, [])).toEqual({kind: 'outpoints', outpoints: []})
  })

  it('preserves Platform caps when a balance decreases rather than authorizing automatic funding', () => {
    const selection: CoinControlSelection = {
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 5_000_000n}],
      feeAddress: 'platform-a',
    }
    const applied = normalizeCoinControlSelection(selection, TransferOperation.AddressFundsTransfer)
    expect(applied).toBe(selection)
    expect(isCoinControlSelectionValid(applied, inventory)).toBe(true)
    expect(isCoinControlSelectionValid(applied, {
      ...inventory,
      platformBalances: {'platform-a': 4_999_999n},
    })).toBe(false)
    expect(toPlatformSpendSource(applied)?.kind).toBe('inputs')
  })

  it.each<CoinControlSelection>([
    {kind: 'coreAddress', address: 'missing'},
    {kind: 'coreOutpoints', outpoints: ['tx-a:0', 'missing:1']},
    {kind: 'platformAddress', address: 'missing'},
    {kind: 'shieldedAddress', address: 'missing'},
    {kind: 'shieldedNotes', noteIndexes: [4, 99]},
    {kind: 'coreOutpoints', outpoints: ['tx-a:0', 'tx-a:0']},
    {kind: 'shieldedNotes', noteIndexes: [4, 4]},
    {kind: 'platformInputs', inputs: [{address: 'platform-a', credits: 1n}], feeAddress: 'platform-b'},
  ])('invalidates unavailable, duplicate, or incomplete manual selection $kind', selection => {
    expect(isCoinControlSelectionValid(selection, inventory)).toBe(false)
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
    expect(isCoinControlSelectionValid({
      kind: 'platformInputs',
      inputs: platformInputs,
      feeAddress: platformInputs[0].address,
    }, platformInventory)).toBe(false)

    expect(isCoinControlSelectionValid({
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 5_000_001n}],
      feeAddress: 'platform-a',
    }, inventory)).toBe(false)

    expect(isCoinControlSelectionValid({
      kind: 'shieldedNotes',
      noteIndexes: Array.from({length: SHIELDED_NOTE_LIMIT + 1}, (_, index) => index),
    }, {
      ...inventory,
      shieldedNoteIndexes: Array.from({length: SHIELDED_NOTE_LIMIT + 1}, (_, index) => index),
    })).toBe(false)
  })
})
