import { describe, expect, it } from 'vitest'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import type { OwnRecipientInventory } from '../../src/renderer/src/types/SendRecipients'
import { ownRecipientOptions } from '../../src/renderer/src/utils/ownRecipients'

function inventory(): OwnRecipientInventory {
  const address = {walletId: 'wallet', accountId: 0, derivationPath: '', index: 0, isUsed: false, balance: 0n, txCount: 0, label: null, usdBalance: null}
  return {
    receiving: [{...address, address: 'receive-empty', isChange: 0, label: 'Savings'}, {...address, address: 'receive-funded', isChange: 0, balance: 10n}],
    change: [{...address, address: 'change-empty', isChange: 1}],
    platformAddresses: [{platformAddress: 'platform-empty', balanceCredits: 0n, nonce: 0}, {platformAddress: 'platform-funded', balanceCredits: 20n, nonce: 1}],
    shieldedAddresses: ['shielded-saved'],
    identities: [{identityIndex: 0, identifier: 'identity-empty', alias: 'Personal', balance: {amount: 0n, usdAmount: '0'}, derivationPath: '', assetLockTxid: null}],
  }
}

describe('own recipient options', () => {
  it('includes unfunded receiving and change addresses and their labels', () => {
    expect(ownRecipientOptions(DestinationKind.CoreAddress, inventory())).toEqual([
      {value: 'receive-empty', label: 'receive-empty', description: 'Your receiving address · Savings'},
      {value: 'receive-funded', label: 'receive-funded', description: 'Your receiving address'},
      {value: 'change-empty', label: 'change-empty', description: 'Your change address'},
    ])
  })

  it.each([
    [DestinationKind.PlatformAddress, ['platform-empty', 'platform-funded']],
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
