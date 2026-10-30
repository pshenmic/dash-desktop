import { ArrowIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import {
  CONTACTS_SUMMARY_ROW_CLASS,
  OVERVIEW_COPY,
} from '@renderer/constants/dashPayOverview'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { ContactSegment, DashPayTab } from '@renderer/enums/DashPay'
import type { ContactsSummaryProps, ContactsSummaryRowProps } from '@renderer/types/DashPayOverview'

function SummaryRow({ label, value, loading, attention = false, onClick }: ContactsSummaryRowProps): React.JSX.Element {
  return (
    <button type={'button'} onClick={onClick} className={CONTACTS_SUMMARY_ROW_CLASS}>
      <span className={'flex min-w-0 items-center gap-2'}>
        <span className={attention ? 'size-1.5 shrink-0 rounded-full bg-dash-orange' : 'size-1.5 shrink-0'} />
        <Text reset size={12} weight={'medium'} color={'brand'} className={'truncate'}>{label}</Text>
      </span>
      <span className={'flex shrink-0 items-center gap-2.5'}>
        {loading
          ? <span className={'h-4 w-6 rounded animate-pulse bg-dash-primary-dark-blue/8 dark:bg-white/8'} />
          : <Text reset size={14} weight={'bold'} color={'brand'} className={'tabular-nums'}>{value}</Text>}
        <ArrowIcon size={9} color={'currentColor'} className={'rotate-180 dash-text-primary'} />
      </span>
    </button>
  )
}

export default function ContactsSummary({ counts, usernames, keys, loading, onOpenSection, onOpenKeys }: ContactsSummaryProps): React.JSX.Element {
  const requests = counts[ContactSegment.Requests]
  return (
    <section className={`flex flex-col gap-1 ${SURFACE_SECTION}`} aria-label={OVERVIEW_COPY.contacts}>
      <header className={'flex min-h-[1.875rem] items-center px-2'}>
        <DashboardHeading as={'h3'}>{OVERVIEW_COPY.contacts}</DashboardHeading>
      </header>
      <SummaryRow
        label={OVERVIEW_COPY.requests}
        value={requests}
        loading={loading}
        attention={!loading && requests > 0}
        onClick={() => onOpenSection(DashPayTab.Contacts, ContactSegment.Requests)}
      />
      <SummaryRow
        label={OVERVIEW_COPY.contacts}
        value={counts[ContactSegment.Contacts]}
        loading={loading}
        onClick={() => onOpenSection(DashPayTab.Contacts, ContactSegment.Contacts)}
      />
      <SummaryRow
        label={OVERVIEW_COPY.sent}
        value={counts[ContactSegment.Sent]}
        loading={loading}
        onClick={() => onOpenSection(DashPayTab.Contacts, ContactSegment.Sent)}
      />
      <div className={'my-1 h-px bg-dash-primary-dark-blue/8 dark:bg-white/8'} />
      <button type={'button'} onClick={() => onOpenSection(DashPayTab.Usernames)} className={CONTACTS_SUMMARY_ROW_CLASS}>
        <span className={'flex min-w-0 items-center gap-2'}>
          <span className={'size-1.5 shrink-0'} />
          <Text reset size={12} weight={'medium'} color={'brand'} className={'truncate'}>
            {OVERVIEW_COPY.usernames}
            <span className={'font-bold tabular-nums'}>{` ${usernames.total}`}</span>
            {usernames.inVote > 0 && <span className={'opacity-50'}>{` · ${usernames.inVote} ${OVERVIEW_COPY.inVote}`}</span>}
          </Text>
        </span>
        <ArrowIcon size={9} color={'currentColor'} className={'shrink-0 rotate-180 dash-text-primary'} />
      </button>
      <button type={'button'} onClick={onOpenKeys} className={CONTACTS_SUMMARY_ROW_CLASS}>
        <span className={'flex min-w-0 items-center gap-2'}>
          <span className={'size-1.5 shrink-0'} />
          <Text reset size={12} weight={'medium'} color={'brand'} className={'truncate'}>
            {OVERVIEW_COPY.keys}
            <span className={'font-bold tabular-nums'}>{` ${keys}`}</span>
          </Text>
        </span>
        <ArrowIcon size={9} color={'currentColor'} className={'shrink-0 rotate-180 dash-text-primary'} />
      </button>
    </section>
  )
}
