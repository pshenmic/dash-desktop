import type { DashpayContactStatus, DashpayNameStatus, DemoTone } from '@renderer/types/dashpayDemo'

export const DASHPAY_NAME_STATUS_LABELS: Record<DashpayNameStatus, string> = {
  registered: 'Registered',
  voting: 'Awaiting votes',
  locked: 'Locked',
  lost: 'Not awarded',
}

export const DASHPAY_NAME_STATUS_TONES: Record<DashpayNameStatus, DemoTone> = {
  registered: 'mint',
  voting: 'amber',
  locked: 'neutral',
  lost: 'red',
}

export const DASHPAY_NAME_CONTACT_LABELS: Record<DashpayContactStatus, string> = {
  contact: 'Contact',
  incoming: 'Request received',
  outgoing: 'Request sent',
}

export const DASHPAY_NAME_FEE_ESTIMATE = '0.0001 DASH'
export const DASHPAY_CONTEST_FEE_ESTIMATE = '0.2 DASH'
export const DASHPAY_TEXT_BUTTON_CLASS = 'cursor-pointer rounded-lg text-sm font-semibold text-dash-brand underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-dash-brand dark:text-dash-mint'
