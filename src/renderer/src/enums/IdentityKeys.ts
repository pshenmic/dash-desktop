export enum IdentityKeyPurpose {
  Authentication = 'AUTHENTICATION',
  Encryption = 'ENCRYPTION',
  Decryption = 'DECRYPTION',
  Transfer = 'TRANSFER',
}

export enum IdentityKeySecurityLevel {
  Master = 'MASTER',
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

export enum IdentityKeyAction {
  Disable = 'disable',
  ReplaceMaster = 'replace-master',
}

export enum IdentityKeyDashPayImpact {
  StopsDashPay = 'stops-dashpay',
  ContactRequests = 'contact-requests',
}
