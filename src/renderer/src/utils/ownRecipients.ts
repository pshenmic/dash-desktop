import { DestinationKind } from '../enums/DestinationKind'
import type { DropdownFieldOption } from '../types/DropdownField'
import type { OwnRecipientInventory } from '../types/SendRecipients'

export function ownRecipientOptions(kind: DestinationKind, inventory: OwnRecipientInventory): DropdownFieldOption[] {
  let options: DropdownFieldOption[]
  switch (kind) {
    case DestinationKind.CoreAddress:
      options = [...inventory.receiving, ...inventory.change].map(address => ({
        value: address.address,
        label: address.address,
        description: [address.isChange ? 'Your change address' : 'Your receiving address', address.label].filter(Boolean).join(' · '),
      }))
      break
    case DestinationKind.PlatformAddress:
      options = inventory.platformAddresses.map(address => ({value: address.platformAddress, label: address.platformAddress}))
      break
    case DestinationKind.Shielded:
      options = inventory.shieldedAddresses.map(address => ({value: address, label: address}))
      break
    case DestinationKind.Identity:
      options = inventory.identities.map(identity => ({value: identity.identifier, label: identity.identifier, description: identity.alias ?? undefined}))
      break
    default:
      return []
  }
  return Array.from(new Map(options.map(option => [option.value, option])).values())
}
