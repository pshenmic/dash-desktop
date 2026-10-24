import { RegistrationReturnTarget } from '@renderer/enums/RegistrationReturnTarget'
import { enumParam } from './searchParams'

export function registrationReturnTarget(raw: string | null): RegistrationReturnTarget {
  return enumParam(RegistrationReturnTarget, raw, RegistrationReturnTarget.Identities)
}
