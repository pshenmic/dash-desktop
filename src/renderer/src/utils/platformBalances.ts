import type { PlatformAddressDto } from '../api/types'
import type { IdentityApiDto } from '../hooks/useIdentities'
import { duffsToCredits } from './balance'

export function totalIdentityCredits(identities: Pick<IdentityApiDto, 'balance'>[]): bigint {
  return identities.reduce((sum, identity) => sum + identity.balance.amount, 0n)
}

export function totalPlatformAddressCredits(addresses: Pick<PlatformAddressDto, 'balanceCredits'>[]): bigint {
  return addresses.reduce((sum, address) => sum + address.balanceCredits, 0n)
}

export function totalWalletCredits(coreDuffs: bigint, layerCredits: (bigint | undefined)[]): bigint {
  return layerCredits.reduce<bigint>((sum, credits) => sum + (credits ?? 0n), duffsToCredits(coreDuffs))
}
