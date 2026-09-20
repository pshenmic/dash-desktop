import { ChevronIcon } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyableError from '@renderer/components/ui/CopyableError'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import HashField from '@renderer/components/ui/HashField'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { PLATFORM_TX_STATUS_VARIANTS } from '@renderer/constants/platformTransactions'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useRipple } from '@renderer/hooks/useRipple'
import type { PlatformTransactionDetailProps } from '@renderer/types/WalletTransaction'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { platformParticipantUrl, platformTransactionDate, platformTransactionStatus, platformTransactionTitle } from '@renderer/utils/platformTransactions'

export default function PlatformTransactionDetail({ transaction, onBack }: PlatformTransactionDetailProps): React.JSX.Element {
  const { status } = useAuth()
  const { isBalanceVisible } = useBalanceVisibility()
  const hoverNotification = useRipple()
  const network = status?.network

  return (
    <div className={'flex flex-col gap-4 px-12 pb-8'}>
      <div className={'flex items-center gap-4.5 mb-5'}>
        <button
          type={'button'}
          onClick={onBack}
          aria-label={'Back to transactions'}
          onMouseEnter={hoverNotification.onMouseEnter}
          onMouseMove={hoverNotification.onMouseMove}
          onMouseLeave={hoverNotification.onMouseLeave}
          className={'relative overflow-hidden flex size-12 shrink-0 items-center justify-center rounded-[.9375rem] dash-block dash-black-border hover:opacity-70 transition-opacity cursor-pointer'}
        >
          <ChevronIcon size={17} className={'dash-text-default rotate-90'} />
        </button>
        <Text size={40} weight={'medium'} color={'brand'} className={'tracking-[-0.03em]'}>
          <span className={'opacity-50'}>Platform:</span> {platformTransactionTitle(transaction.type)}
        </Text>
      </div>

      <div className={'flex flex-col gap-5 p-[.9375rem] rounded-[.9375rem] dash-card-base shadow-[0_0_50px_0_rgba(0,0,0,0.1)]'}>
        <HashField hash={transaction.hash} explorerUrl={network ? platformTransactionUrl(transaction.hash, network) : undefined} />
        <div className={'flex flex-wrap items-center justify-between gap-3'}>
          <Text size={14} weight={'medium'} color={'brand'}>Status</Text>
          <CustomBadge
            text={platformTransactionStatus(transaction.status)}
            variant={PLATFORM_TX_STATUS_VARIANTS[transaction.status ?? 'unknown']}
          />
        </div>
        {transaction.error && <CopyableError message={transaction.error} />}
        <div className={'flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl dash-block'}>
          <Text size={14} weight={'medium'} color={'brand'}>Date</Text>
          <Text size={14} weight={'medium'} color={'brand'}>{platformTransactionDate(transaction.date, true)}</Text>
        </div>
        {transaction.blockHeight !== null && (
          <div className={'flex items-center justify-between gap-3 p-3 rounded-xl dash-block'}>
            <Text size={14} weight={'medium'} color={'brand'}>Block height</Text>
            <Text size={14} weight={'medium'} color={'brand'}>{transaction.blockHeight}</Text>
          </div>
        )}
        <div className={'flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl dash-block'}>
          <Text size={14} weight={'medium'} color={'brand'}>Platform balance change</Text>
          <SensitiveValue hidden={!isBalanceVisible} size={'card'}>
            <span className={`inline-flex items-baseline ${transaction.netCredits > 0n ? 'dash-text-primary' : 'dash-text-default'}`}>
              <CreditsAmount credits={transaction.netCredits} prefix={transaction.netCredits > 0n ? '+' : ''} exact align={'end'} />
            </span>
          </SensitiveValue>
        </div>
        <div className={'flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl dash-block'}>
          <Text size={14} weight={'medium'} color={'brand'}>Transition fee</Text>
          <SensitiveValue hidden={!isBalanceVisible} size={'card'}>
            <CreditsAmount credits={transaction.gasCredits} exact align={'end'} className={'dash-text-default'} />
          </SensitiveValue>
        </div>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
          Balance change is the net change across this wallet’s Platform addresses and identities. The transition fee may be paid by another participant.
        </Text>
        {transaction.subject && (
          <HashField
            label={'Wallet address or identity'}
            hash={transaction.subject}
            explorerUrl={network ? platformParticipantUrl(transaction.subject, network) : undefined}
          />
        )}
        {transaction.counterparty && (
          <HashField
            label={'Counterparty'}
            hash={transaction.counterparty}
            explorerUrl={network ? platformParticipantUrl(transaction.counterparty, network) : undefined}
          />
        )}
      </div>
    </div>
  )
}
