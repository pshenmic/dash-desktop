import { RegistrationReturnTarget } from '@renderer/enums/RegistrationReturnTarget'
import type { RegistrationReturnDestination } from '@renderer/types/DashPay'
import { DASHPAY_ROUTES } from './dashPay'
import { DASHPAY_BACK_LABEL, PAGE_HEADERS } from './pageHeaders'

export const REGISTRATION_RETURN_PARAM = 'returnTo'

export const REGISTRATION_RETURN_TARGETS: Record<RegistrationReturnTarget, RegistrationReturnDestination> = {
  [RegistrationReturnTarget.Identities]: { path: '/identities', backLabel: PAGE_HEADERS.identityRegistration.back },
  [RegistrationReturnTarget.DashPay]: { path: DASHPAY_ROUTES.root, backLabel: DASHPAY_BACK_LABEL },
}
