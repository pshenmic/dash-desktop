import type { FC } from 'react'
import { IdenticonIcon, KeyIcon, SignIcon, type IconProps } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { DashPaySetupStep, OverviewAction, OverviewBand, SetupStepState } from '../enums/DashPay'
import { MasternodesTab } from '../enums/Masternodes'
import { RegistrationReturnTarget } from '../enums/RegistrationReturnTarget'
import type { CountForms } from '../types/CountForms'
import { MASTERNODE_PARAMS, MASTERNODES_ROUTE } from './masternodes'
import { REGISTRATION_RETURN_PARAM } from './registrationReturn'
import { CHIP_ACTION, ICON_CHIP, SURFACE_SECTION } from './surfaces'

export const DASHPAY_REGISTER_IDENTITY_HREF = `/identities/register?${REGISTRATION_RETURN_PARAM}=${RegistrationReturnTarget.DashPay}`

export const OVERVIEW_CONTESTS_HREF = `${MASTERNODES_ROUTE}?${MASTERNODE_PARAMS.tab}=${MasternodesTab.Contests}`

export const OVERVIEW_ORBIT_COUNT = 2

export const OVERVIEW_ROW_CLASS = 'grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,1fr)] gap-4'

export const OVERVIEW_BAND_CLASS = 'mt-4 flex flex-col gap-2'

export const OVERVIEW_ENTRY_GRID_CLASS = 'mt-4 grid grid-cols-1 gap-4 lg:grid-cols-none lg:grid-flow-col lg:auto-cols-fr'

export const OVERVIEW_SKELETON_CLASS = 'h-56 rounded-[.9375rem] animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const OVERVIEW_HERO_CLASS = 'relative overflow-hidden flex min-h-[14rem] flex-col gap-3 rounded-[.9375rem] dash-block-3 p-6'

export const OVERVIEW_HERO_CONTENT_CLASS = 'relative flex min-w-0 flex-col gap-3 lg:pr-40'

export const OVERVIEW_HERO_ACTIONS_CLASS = 'relative mt-auto flex flex-wrap gap-2'

export const OVERVIEW_HERO_ART = {
  frame: 'max-lg:hidden absolute right-6 top-1/2 -translate-y-1/2 size-36 pointer-events-none',
  ring: 'size-36 rounded-full border border-dashed border-dash-primary-dark-blue/15 dark:border-white/20',
  tile: 'absolute inset-0 m-auto size-[5.75rem] rounded-[1.75rem] dash-card-base -rotate-[9deg] shadow-[0_0_48px_0_rgba(76,126,255,0.22)] flex items-center justify-center',
  tileInner: 'rotate-[9deg]',
  chip: 'absolute size-9 rounded-xl dash-card-base flex items-center justify-center',
  chipEmpty: 'border border-dashed border-dash-primary-dark-blue/15 dark:border-white/20',
  positions: ['-top-1 -right-1', '-bottom-1 -left-1'],
} as const

export const OVERVIEW_FIAT_PILL_CLASS = 'flex items-center rounded-full px-3 py-1 bg-dash-brand/10 dark:bg-dash-mint/10'

export const OVERVIEW_EXPLORER_BUTTON_CLASS = 'size-5 shrink-0 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer'

export const SETUP_CHECKLIST_CLASS = `flex flex-col ${SURFACE_SECTION}`

export const SETUP_ROW_CLASS = 'flex items-center gap-3 py-2.5 border-t border-dash-primary-dark-blue/8 dark:border-white/8 first:border-t-0'

export const SETUP_ACTION_CLASS = `${CHIP_ACTION} whitespace-nowrap font-medium disabled:opacity-50 disabled:cursor-not-allowed`

const SETUP_TODO_ICON_CLASS = 'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full'

export const SETUP_ICON_CLASS: Record<SetupStepState, string> = {
  [SetupStepState.Done]: ICON_CHIP,
  [SetupStepState.Todo]: `${SETUP_TODO_ICON_CLASS} dash-block-5 dash-text-default`,
  [SetupStepState.Warning]: `${SETUP_TODO_ICON_CLASS} bg-dash-orange/10 text-dash-orange`,
}

export const SETUP_STEP_ICONS: Record<DashPaySetupStep, FC<IconProps>> = {
  [DashPaySetupStep.Identity]: IdenticonIcon,
  [DashPaySetupStep.Username]: SignIcon,
  [DashPaySetupStep.Keys]: KeyIcon,
}

export const SETUP_STEP_TITLES: Record<DashPaySetupStep, string> = {
  [DashPaySetupStep.Identity]: 'Identity',
  [DashPaySetupStep.Username]: 'Username',
  [DashPaySetupStep.Keys]: 'DashPay keys',
}

export const CONTACTS_SUMMARY_CLASS = `flex flex-col gap-1 ${SURFACE_SECTION}`

export const CONTACTS_SUMMARY_ROW_CLASS = 'flex w-full items-center justify-between gap-3 rounded-[.625rem] px-2 py-2 cursor-pointer text-left transition-colors hover:dash-block-accent-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40'

export const CONTACTS_SUMMARY_DIVIDER_CLASS = 'my-1 h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const CONTACTS_SUMMARY_VALUE_SKELETON = 'h-4 w-6 rounded animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8'

export const ATTENTION_DOT_CLASS = 'size-1.5 shrink-0 rounded-full bg-dash-orange'

export const ENTRY_CARD_CLASS = `group relative flex items-center gap-3 text-left cursor-pointer ${SURFACE_SECTION} transition-colors enabled:hover:dash-block-accent-5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40`

export const SECTION_HEADER_CLASS = 'flex items-center justify-between gap-3 px-1'

export const VIEW_ALL_CLASS = 'flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity'

export const SWITCHER_FOOTER_CLASS = 'flex w-full items-center gap-2'

export const OVERVIEW_COPY = {
  onboardingEyebrow: 'Meet DashPay',
  onboardingTitle: 'Make your wallet personal.',
  onboardingBody: 'Claim a .dash name, add contacts and pay them by name.',
  noIdentityBody: 'DashPay starts with a Platform identity.',
  actingAs: 'Acting as',
  identityBalance: 'Identity balance',
  addContact: 'Add contact',
  registerUsername: 'Register username',
  yourSetup: 'Your setup',
  of: 'of',
  stepReady: 'Ready',
  noCredits: 'No credits',
  switchIdentity: 'Switch',
  topUp: 'Top up',
  create: 'Create',
  register: 'Register',
  enable: 'Enable',
  registerNeedsKey: 'Needs an Authentication · High key',
  contacts: 'Contacts',
  requests: 'Requests',
  sent: 'Sent',
  usernames: 'Usernames',
  keys: 'Keys',
  inVote: 'in vote',
  viewAll: 'View all',
  findPeople: 'Find people',
  findPeopleCaption: 'Search by username or ID.',
  findPeopleDisabled: 'Enable DashPay first.',
  nameContests: 'Name contests',
  nameContestsCaption: 'Vote with your masternodes.',
  loadFailed: 'Failed to load identities',
  identityUnavailable: '**Identity unavailable** Showing',
  instead: 'instead.',
} as const

export const OVERVIEW_ACTION_LABELS: Record<OverviewAction, string> = {
  [OverviewAction.CreateIdentity]: 'Create identity',
  [OverviewAction.EnableDashPay]: 'Enable DashPay',
  [OverviewAction.RegisterUsername]: 'Register username',
  [OverviewAction.FindPeople]: 'Find people',
}

export const OVERVIEW_BAND_TITLES: Record<OverviewBand, string> = {
  [OverviewBand.Requests]: 'Requests',
  [OverviewBand.Recent]: 'Recent contacts',
}

export const REQUEST_COUNT_FORMS: CountForms = { one: 'request', other: 'requests' }

export const SWITCHER_COPY = {
  registerIdentity: 'Register new identity',
} as const
