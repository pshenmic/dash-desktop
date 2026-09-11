import { DestinationKind } from '../enums/DestinationKind'
import type { DropdownFieldOption } from '../types/DropdownField'
import type { OwnRecipientInventory } from '../types/SendRecipients'
import { creditsToDash, davToDash } from './balance'

export function ownRecipientOptions(kind: DestinationKind, inventory: OwnRecipientInventory): DropdownFieldOption[] {
  let options: DropdownFieldOption[]
  switch (kind) {
    case DestinationKind.CoreAddress:
      options = [...inventory.receiving, ...inventory.change].map(address => ({
        value: address.address,
        label: address.address,
        metadata: [`${davToDash(address.balance)} Dash`, `Tx count: ${address.txCount}`],
        description: [address.isChange ? 'Your change address' : 'Your receiving address', address.label].filter(Boolean).join(' · '),
      }))
      break
    case DestinationKind.PlatformAddress:
      options = inventory.platformAddresses.map(address => ({
        value: address.platformAddress,
        label: address.platformAddress,
        metadata: [`${creditsToDash(address.balanceCredits)} Dash`, `Nonce: ${address.nonce}`],
      }))
      break
    case DestinationKind.Shielded:
      options = inventory.shieldedAddresses.map(address => ({
        value: address,
        label: address,
        metadata: [inventory.shieldedBalances === null ? 'Balance unknown' : `${creditsToDash(inventory.shieldedBalances.get(address) ?? 0n)} Dash`],
      }))
      break
    case DestinationKind.Identity:
      options = inventory.identities.map(identity => ({
        value: identity.identifier,
        label: identity.identifier,
        description: identity.alias ?? undefined,
        metadata: [`${creditsToDash(identity.balance.amount)} Dash`],
      }))
      break
    default:
      return []
  }
  return Array.from(new Map(options.map(option => [option.value, option])).values())
}
