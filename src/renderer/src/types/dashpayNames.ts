export type DashpayRegistrationStage = 'choose' | 'review' | 'submitting' | 'complete'

export interface DashpayRegistrationOperation {
  identityId: string
  label: string
}
