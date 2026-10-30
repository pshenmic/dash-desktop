export enum UsernameStatus {
  Registered = 'registered',
  Voting = 'voting',
  Locked = 'locked',
  Taken = 'taken',
  Missing = 'missing',
}

export enum UsernameVoteOutcome {
  WonByIdentity = 'WonByIdentity',
  Locked = 'Locked',
  NoWinner = 'NoWinner',
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

export enum DashPayTab {
  Overview = 'overview',
  Contacts = 'contacts',
  Usernames = 'usernames',
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

export enum UsernamePresentation {
  Registered = 'registered',
  Voting = 'voting',
  Locked = 'locked',
  Taken = 'taken',
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
  InContest = 'in-contest',
  InWalletContest = 'in-wallet-contest',
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

export enum ShortfallKind {
  FeeError = 'fee-error',
  Balance = 'balance',
}

export enum ContactAction {
  Accept = 'accept',
  Pay = 'pay',
}
