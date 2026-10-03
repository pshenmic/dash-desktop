import { describe, expect, it } from 'vitest'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import type { OwnRecipientInventory } from '../../src/renderer/src/types/SendRecipients'
import { ownRecipientOptions } from '../../src/renderer/src/utils/ownRecipients'

function inventory(): OwnRecipientInventory {
  const address = {walletId: 'wallet', accountId: 0, derivationPath: '', index: 0, isUsed: false, balance: 0n, txCount: 0, label: null, usdBalance: null}
  return {
    receiving: [
      {...address, address: 'receive-empty', isChange: 0, label: 'Savings'},
      {...address, address: 'receive-funded', isChange: 0, balance: 10n, txCount: 3},
      {...address, address: 'receive-spent', isChange: 0, txCount: 4},
      {...address, address: 'receive-used', isChange: 0, isUsed: true},
      {...address, address: 'receive-funded-no-history', isChange: 0, balance: 1n},
    ],
    change: [{...address, address: 'change-empty', isChange: 1}],
    platformAddresses: [
      {platformAddress: 'platform-empty', balanceCredits: 0n, nonce: 0},
      {platformAddress: 'platform-funded', balanceCredits: 20n, nonce: 1},
      {platformAddress: 'platform-spent', balanceCredits: 0n, nonce: 2},
      {platformAddress: 'platform-funded-no-nonce', balanceCredits: 1n, nonce: 0},
    ],
    shieldedAddresses: ['shielded-saved'],
    shieldedNotes: [],
    identities: [{identityIndex: 0, identifier: 'identity-empty', alias: 'Personal', balance: {amount: 0n, usdAmount: '0'}, derivationPath: '', assetLockTxid: null}],
  }
}

describe('own recipient options', () => {
  it('only includes unused empty receiving and change addresses and their labels', () => {
    expect(ownRecipientOptions(DestinationKind.CoreAddress, inventory())).toEqual([
      {value: 'receive-empty', label: 'receive-empty', description: 'Your receiving address · Savings', metadata: ['0 Dash', 'Tx count: 0']},
      {value: 'change-empty', label: 'change-empty', description: 'Your change address', metadata: ['0 Dash', 'Tx count: 0']},
    ])
  })

  it('only includes empty Platform addresses with zero nonce', () => {
    expect(ownRecipientOptions(DestinationKind.PlatformAddress, inventory())).toEqual([
      {value: 'platform-empty', label: 'platform-empty', metadata: ['0 Dash', 'Nonce: 0']},
    ])
  })

  it('keeps identity aliases and balances without inventing a transaction count or nonce', () => {
    const recipients = inventory()
    recipients.identities[0].balance.amount = 100_000_000_001n
    expect(ownRecipientOptions(DestinationKind.Identity, recipients)).toEqual([
      {value: 'identity-empty', label: 'identity-empty', description: 'Personal', metadata: ['1.00000000001 Dash']},
    ])
  })

  it('only includes Shielded addresses without any received notes, including spent notes', () => {
    const recipients = inventory()
    recipients.shieldedAddresses.push('shielded-funded', 'shielded-spent')
    recipients.shieldedNotes = [
      {index: 0, address: 'shielded-funded', amount: 50n, spent: false},
      {index: 1, address: 'shielded-spent', amount: 50n, spent: true},
    ]
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients).map(option => option.value)).toEqual(['shielded-saved'])
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients)[0].metadata).toEqual(['0 Dash'])
    recipients.shieldedNotes = null
    expect(ownRecipientOptions(DestinationKind.Shielded, recipients)).toEqual([])
  })

  it.each([
    [DestinationKind.PlatformAddress, ['platform-empty']],
    [DestinationKind.Shielded, ['shielded-saved']],
    [DestinationKind.Identity, ['identity-empty']],
    [DestinationKind.NewIdentity, []],
  ])('only offers the selected destination type %s, including zero balances', (kind, values) => {
    expect(ownRecipientOptions(kind, inventory()).map(option => option.value)).toEqual(values)
  })

  it('deduplicates persisted addresses and handles wallets without any revealed addresses', () => {
    const addresses = inventory()
    addresses.shieldedAddresses.push('shielded-saved')
    expect(ownRecipientOptions(DestinationKind.Shielded, addresses)).toHaveLength(1)
    addresses.shieldedAddresses = []
    expect(ownRecipientOptions(DestinationKind.Shielded, addresses)).toEqual([])
  })
})
