import { ENABLE_DASHPAY_COPY } from '@renderer/constants/dashPayKeys'

export function enableDashPayDescription(name: string): string {
  return `${ENABLE_DASHPAY_COPY.descriptionLead} ${name} ${ENABLE_DASHPAY_COPY.descriptionTail}`
}

export function dashPayEnabledHeadline(name: string): string {
  return `${ENABLE_DASHPAY_COPY.doneLead} ${name}`
}
