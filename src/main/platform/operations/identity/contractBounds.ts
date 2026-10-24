import {ContractBoundsWASM} from 'pshenmic-dpp'
import {IdentityKeyBounds} from '../../../src/types/IdentityKeys'

export function contractBoundsWASM(bounds: IdentityKeyBounds | null): ContractBoundsWASM | undefined {
  return bounds == null ? undefined : new ContractBoundsWASM(bounds.contractId, bounds.documentType ?? undefined)
}

// The shape the SDK's createStateTransition takes for a key's bounds.
export function sdkContractBounds(bounds: IdentityKeyBounds | null): {dataContractId: string; documentType?: string} | undefined {
  return bounds == null ? undefined : {dataContractId: bounds.contractId, documentType: bounds.documentType ?? undefined}
}
