export enum AliasStatus {
  Pending = 'pending',
  Registered = 'registered',
  Voting = 'voting',
  Locked = 'locked',
  Taken = 'taken',
  Missing = 'missing',
}

export enum DashPayContactRelationship {
  Incoming = 'incoming',
  Outgoing = 'outgoing',
  Established = 'established',
}

export enum DashPayPaymentDirection {
  Sent = 'sent',
  Received = 'received',
}

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

export enum DashPayTab {
  Overview = 'overview',
  Contacts = 'contacts',
  Usernames = 'usernames',
  Keys = 'keys',
}

export enum ContactSegment {
  All = 'all',
  Contacts = 'contacts',
  Requests = 'requests',
  Sent = 'sent',
}

export enum ContactSort {
  Recent = 'recent',
  Name = 'name',
  Oldest = 'oldest',
}

export enum DashPayReadiness {
  Ready = 'ready',
  NeedsKeys = 'needs-keys',
  NoKeySlots = 'no-key-slots',
  NoUsername = 'no-username',
}

export enum DashPaySetupStep {
  Identity = 'identity',
  Username = 'username',
  Keys = 'keys',
}

export enum SetupStepState {
  Done = 'done',
  Todo = 'todo',
  Warning = 'warning',
}

export enum ActiveIdentitySource {
  Requested = 'requested',
  Stored = 'stored',
  Fallback = 'fallback',
  None = 'none',
}

export enum AliasPresentation {
  Registered = 'registered',
  Pending = 'pending',
  Voting = 'voting',
  Locked = 'locked',
  Taken = 'taken',
  Resumable = 'resumable',
  Missing = 'missing',
}

export enum DpnsLabelIssue {
  TooShort = 'too-short',
  TooLong = 'too-long',
  InvalidChars = 'invalid-chars',
  EdgeHyphen = 'edge-hyphen',
}

export enum DpnsLabelKind {
  Instant = 'instant',
  Contested = 'contested',
}

export enum UsernameAvailability {
  Idle = 'idle',
  Checking = 'checking',
  Available = 'available',
  Taken = 'taken',
  Owned = 'owned',
  OwnedByWallet = 'owned-by-wallet',
  Error = 'error',
}

export enum SearchResultState {
  Self = 'self',
  YourIdentity = 'your-identity',
  Contact = 'contact',
  Sent = 'sent',
  Incoming = 'incoming',
  None = 'none',
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

export enum OverviewBand {
  Requests = 'requests',
  Recent = 'recent',
}

export enum OverviewAction {
  CreateIdentity = 'create-identity',
  EnableDashPay = 'enable-dashpay',
  RegisterUsername = 'register-username',
  FindPeople = 'find-people',
}

export enum KeysShortfallKind {
  Slots = 'slots',
  FeeError = 'fee-error',
  Balance = 'balance',
}

export enum ContactAction {
  Accept = 'accept',
  Pay = 'pay',
}
