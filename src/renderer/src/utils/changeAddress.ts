import type { WalletAddressDto } from '../api/types'
import type { CoreSendChangeParams } from '../types/ChangeAddress'
import { TransferOperation } from '../enums/TransferOperation'
import { receiveCoreAddresses } from './receiveDefaults'

export function suggestedChangeAddress(change: WalletAddressDto[]): string | null {
  return receiveCoreAddresses(change)[0]?.address ?? null
}

export function selectedChangeAddress(change: WalletAddressDto[], selected?: string): string | null {
  return selected ?? suggestedChangeAddress(change)
}

export function hasUnallocatedCoreFunds(amountDuffs: bigint, maxDuffs: bigint | null): boolean {
  return amountDuffs > 0n && maxDuffs !== null && amountDuffs < maxDuffs
}

export function coreSendChangeTo({advanced, customChangeEnabled, operation, amountDuffs, maxDuffs, change, selected}: CoreSendChangeParams): string | undefined {
  if (!advanced || !customChangeEnabled || operation !== TransferOperation.CoreSend || !hasUnallocatedCoreFunds(amountDuffs, maxDuffs)) return undefined
  return selectedChangeAddress(change, selected)?.trim() || undefined
}
