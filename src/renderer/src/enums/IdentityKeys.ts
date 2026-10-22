export enum IdentityKeyPurpose {
  Authentication = 'AUTHENTICATION',
  Encryption = 'ENCRYPTION',
  Decryption = 'DECRYPTION',
  Transfer = 'TRANSFER',
}

export enum IdentityKeySecurityLevel {
  Critical = 'CRITICAL',
  High = 'HIGH',
  Medium = 'MEDIUM',
}

export enum IdentityKeyVariant {
  AuthCritical = 'auth-critical',
  AuthHigh = 'auth-high',
  AuthMedium = 'auth-medium',
  EncDashPay = 'enc-dashpay',
  DecDashPay = 'dec-dashpay',
  Enc = 'enc',
  Dec = 'dec',
  Transfer = 'transfer',
}
