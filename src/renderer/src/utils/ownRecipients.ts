import { DestinationKind } from '../enums/DestinationKind'
import type { DropdownFieldOption } from '../types/DropdownField'
import type { OwnRecipientInventory } from '../types/SendRecipients'
import { creditsToDash, davToDash } from './balance'

export function ownRecipientOptions(kind: DestinationKind, inventory: OwnRecipientInventory): DropdownFieldOption[] {
  let options: DropdownFieldOption[]
  switch (kind) {
    case DestinationKind.CoreAddress:
      options = [...inventory.receiving, ...inventory.change]
        .filter(address => !address.isUsed && address.balance === 0n && address.txCount === 0)
        .map(address => ({
          value: address.address,
          label: address.address,
          metadata: [`${davToDash(address.balance)} Dash`, `Tx count: ${address.txCount}`],
          description: [address.isChange ? 'Your change address' : 'Your receiving address', address.label].filter(Boolean).join(' · '),
        }))
      break
    case DestinationKind.PlatformAddress:
      options = inventory.platformAddresses
        .filter(address => address.balanceCredits === 0n && address.nonce === 0)
        .map(address => ({
          value: address.platformAddress,
          label: address.platformAddress,
          metadata: [`${creditsToDash(address.balanceCredits)} Dash`, `Nonce: ${address.nonce}`],
        }))
      break
    case DestinationKind.Shielded: {
      if (inventory.shieldedNotes === null) return []
      const usedAddresses = new Set(inventory.shieldedNotes.map(note => note.address))
      options = inventory.shieldedAddresses.filter(address => !usedAddresses.has(address)).map(address => ({
        value: address,
        label: address,
        metadata: ['0 Dash'],
      }))
      break
    }
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
