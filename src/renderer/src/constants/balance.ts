import type { SidebarBalanceVariant } from '../types/SidebarBalance'

export const DUFFS_PER_DASH = 100_000_000n
export const CREDITS_PER_DUFF = 1_000n
export const CREDITS_PER_DASH = 100_000_000_000n
export const DASH_CREDIT_DECIMALS = 11

export const DASH_UNIT = 'Dash'
export const UNKNOWN_BALANCE_LABEL = `— ${DASH_UNIT}`
export const FIAT_APPROX_PREFIX = '~ '
export const DASH_BIG_NUMBER_CLASS = 'text-inherit! [&&]:gap-[.125rem]'

export const SIDEBAR_BALANCE_LABELS: Record<SidebarBalanceVariant, string> = {
  total: 'Total balance:',
  dash: 'Core Balance:',
  credits: 'Platform addresses:',
  identities: 'Identities:',
  shielded: 'Shielded:',
}

export const SIDEBAR_BALANCE_COPY = {
  excludesShielded: 'Excludes the shielded balance until shielded notes are synced.',
} as const

export const SIDEBAR_BALANCE_BREAKDOWN_ID = 'sidebar-balance-breakdown'

export const SIDEBAR_BALANCE_BREAKDOWN = 'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none'

export const SIDEBAR_BALANCE_BREAKDOWN_OPEN = 'grid-rows-[1fr] opacity-100'

export const SIDEBAR_BALANCE_BREAKDOWN_CLOSED = 'grid-rows-[0fr] opacity-0'

export const SIDEBAR_BALANCE_ROWS = 'flex flex-col border-t border-dash-primary-dark-blue/8 divide-y divide-dash-primary-dark-blue/8 dark:border-white/12 dark:divide-white/12'

export const SIDEBAR_BALANCE_CHEVRON = 'shrink-0 dash-text-default transition-transform duration-300 ease-out motion-reduce:transition-none'

export const SIDEBAR_BALANCE_TOGGLE = 'flex w-full items-center gap-2 pr-[.9375rem] text-left cursor-pointer rounded-[.875rem] outline-none transition-colors hover:bg-dash-primary-dark-blue/3 dark:hover:bg-white/3 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40'

export const LS_BALANCE_BREAKDOWN_OPEN = 'wallet.balance.breakdownOpen'
