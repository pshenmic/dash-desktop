import type { DashpayContact, DashpayIdentity, DashpayName, DashpayPerson, DashpayScenario, DemoTone } from '@renderer/types/dashpayDemo'
import type { BadgeProps } from '@renderer/components/dash-ui-kit-enxtended/badge'

export const DASHPAY_IDENTITIES: DashpayIdentity[] = [
  { id: 'demo-alice', label: 'Personal identity', credits: 2480000000n },
  { id: 'demo-studio', label: 'Studio identity', credits: 950000000n },
]

export const DASHPAY_PEOPLE: DashpayPerson[] = [
  { id: 'demo-alice', username: 'alice2026', displayName: 'Alice Morgan', bio: 'A little more human. A little more Dash.' },
  { id: 'demo-studio', username: 'northstar-studio', displayName: 'Northstar Studio', bio: 'Independent design, built together.' },
  { id: 'demo-bob', username: 'bob2026', displayName: 'Bob Chen', bio: 'Coffee, open source, and good company.' },
  { id: 'demo-carol', username: 'carol', displayName: 'Carol Williams', bio: 'Making everyday payments feel effortless.' },
  { id: 'demo-dan', username: 'daniel42', displayName: 'Daniel Rivera', bio: 'Building things for the Dash community.' },
  { id: 'demo-erin', username: 'erin-design', displayName: 'Erin Park', bio: 'Designing for people, wherever they are.' },
  { id: 'demo-felix', username: 'felix88', displayName: 'Felix Martin', bio: 'Always up for a new idea.' },
]

export const DASHPAY_NAMES: DashpayName[] = [
  { id: 'demo-name-alice', identityId: 'demo-alice', label: 'alice2026', status: 'registered' },
  { id: 'demo-name-alice-pay', identityId: 'demo-alice', label: 'alice-pay', status: 'registered' },
  { id: 'demo-name-studio', identityId: 'demo-studio', label: 'northstar-studio', status: 'registered' },
]

export const DASHPAY_CONTACTS: DashpayContact[] = [
  { identityId: 'demo-alice', personId: 'demo-bob', status: 'contact' },
  { identityId: 'demo-alice', personId: 'demo-carol', status: 'contact' },
  { identityId: 'demo-alice', personId: 'demo-dan', status: 'incoming' },
  { identityId: 'demo-alice', personId: 'demo-erin', status: 'incoming' },
  { identityId: 'demo-alice', personId: 'demo-felix', status: 'outgoing' },
]

export const DASHPAY_SCENARIOS: { value: DashpayScenario; label: string }[] = [
  { value: 'ready', label: 'Ready to use' },
  { value: 'new', label: 'First visit' },
  { value: 'unnamed', label: 'Identity without a name' },
  { value: 'pending', label: 'Name awaiting votes' },
  { value: 'empty', label: 'No contacts yet' },
  { value: 'loading', label: 'Checking status' },
  { value: 'error', label: 'Connection error' },
]

export const DASHPAY_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'names', label: 'Names' },
  { value: 'contacts', label: 'Contacts' },
] as const

export const DEMO_BADGE_COLORS: Record<DemoTone, Pick<BadgeProps, 'colorLight' | 'colorDark'>> = {
  blue: { colorLight: 'blue', colorDark: 'turquoise' },
  mint: { colorLight: 'blue', colorDark: 'turquoise' },
  amber: { colorLight: 'orange', colorDark: 'orange' },
  red: { colorLight: 'red', colorDark: 'red' },
  neutral: { colorLight: 'gray', colorDark: 'white' },
}

export const DEMO_NOTICE_CLASS_NAMES: Record<DemoTone, string> = {
  blue: '!bg-dash-brand/5 dark:!bg-dash-mint/8',
  mint: '!bg-dash-brand/5 dark:!bg-dash-mint/8',
  amber: '!bg-dash-orange/8 dark:!bg-dash-orange/12',
  red: '!bg-dash-red/8 dark:!bg-dash-red/12',
  neutral: '!bg-dash-control-background dark:!bg-white/4',
}

export const DEMO_MODAL_CLASS_NAME = [
  'max-h-[calc(100dvh-2rem)] overflow-y-auto !rounded-3xl !p-6 !gap-0 !z-99',
  '!bg-white dark:!bg-white/12 dark:backdrop-blur-[2rem]',
  '[div:has(+&)]:!bg-black/64 [div:has(+&)]:!z-99',
  '[&>div:first-child]:!mb-2 [&>div:first-child>h2]:!font-extrabold [&>div:first-child>h2]:!tracking-normal',
  '[&>div:first-child>button]:!text-dash-primary-dark-blue dark:[&>div:first-child>button]:!text-white',
  '[&>div:first-child>button_svg]:!text-current',
].join(' ')

export const DEMO_LOCKED_NAMES = ['dash', 'support']
export const DEMO_OPERATION_DELAY_MS = 900
export const DEMO_CONTEST_END = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()
export const DEMO_TABS_TRIGGER_CLASS = 'data-[state=active]:text-dash-primary-dark-blue data-[state=inactive]:text-dash-primary-dark-blue/35 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-white/35 font-medium tracking-[-0.03em]'
