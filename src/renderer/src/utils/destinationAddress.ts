import type { Network } from '../api/types'
import { DestinationKind } from '../enums/DestinationKind'
import { isValidDashAddress } from './address'
import { isValidPlatformAddress } from './platformAddress'
import { isLikelyShieldedAddress } from './shieldedAddress'
import { isLikelyIdentityId } from './transferMatrix'

export function isValidDestinationAddress(destination: DestinationKind, address: string, network: Network | null): boolean {
  switch (destination) {
    case DestinationKind.CoreAddress:
      return isValidDashAddress(address.trim(), network ?? undefined)
    case DestinationKind.PlatformAddress:
      return isValidPlatformAddress(address, network ?? undefined)
    case DestinationKind.Identity:
      return isLikelyIdentityId(address)
    case DestinationKind.Shielded:
      return isLikelyShieldedAddress(address)
    case DestinationKind.NewIdentity:
      return false
  }
}
