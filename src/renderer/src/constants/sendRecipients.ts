import { TransferOperation } from '../enums/TransferOperation'

export const SEND_RECIPIENT_LIMITS: Partial<Record<TransferOperation, number>> = {
  [TransferOperation.CoreSend]: 1_000,
  [TransferOperation.AddressFundsTransfer]: 128,
  [TransferOperation.ShieldedTransfer]: 5,
}

export const CORE_RECIPIENT_MIN_DUFFS = 546n
export const PLATFORM_RECIPIENT_MIN_CREDITS = 500_000n
export const SEND_AMOUNT_PATTERN = /^\d*\.?\d{0,8}$/
export const PLATFORM_ADDRESS_TYPE_BYTES: Record<number, number> = {0xb0: 0, 0x80: 1}
