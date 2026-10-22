import { useMemo, useState } from 'react'
import { Identifier, DashLogo, TimeDelta, useTheme } from 'dash-ui-kit/react'
import { HighlightedIdentifier, Text, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { BoxIcon, CalendarIconHighlighted, DocumentIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import CopyButton from '@renderer/components/ui/CopyButton'
import QrButton from '@renderer/components/ui/QrButton'
import CopyableError from '@renderer/components/ui/CopyableError'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import PageHeader from '@renderer/components/ui/PageHeader'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { PLATFORM_TX_STATUS_VARIANTS } from '@renderer/constants/platformTransactions'
import { TRANSACTION_DETAIL_CARD_CLASS, TRANSACTION_DETAIL_IDENTIFIER_CLASS, transactionsPage } from '@renderer/constants/transactionsPage'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import type { PlatformTransactionDetailProps } from '@renderer/types/WalletTransaction'
import { openExternal, platformTransactionUrl } from '@renderer/utils/explorer'
import { platformParticipantUrl, platformTransactionDateValue, platformTransactionStatus, platformTransactionTitle } from '@renderer/utils/platformTransactions'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import { creditsToDuffs } from '@renderer/utils/balance'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { useFiat } from '@renderer/hooks/useFiat'
import { usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import { useIdentities } from '@renderer/hooks/useIdentities'
import { platformOwnedParticipants } from '@renderer/utils/ownedAddresses'
import DetailToken from './TransactionDetailToken'

export default function PlatformTransactionDetail({ transaction, onBack }: PlatformTransactionDetailProps): React.JSX.Element {
  const { status } = useAuth()
  const { isBalanceVisible } = useBalanceVisibility()
  const network = status?.network
  const { platformAddresses } = usePlatformAddresses(status?.selectedWalletId ?? undefined)
  const { identities } = useIdentities(status?.selectedWalletId ?? undefined)
  const ownedParticipants = useMemo(() => platformOwnedParticipants(platformAddresses, identities), [platformAddresses, identities])
  const [qrAddress, setQrAddress] = useState<string | null>(null)
  const { theme } = useTheme()
  const { format: formatFiat, rateReady } = useFiat()
  const date = platformTransactionDateValue(transaction.date)
  const displayedId = transaction.hash.toLowerCase()
  const { detail, platformDetail } = transactionsPage

  return (
    <div className={'px-12 pb-8'}>
      <PageHeader
        title={<><span className={'opacity-50'}>{platformDetail.titlePrefix}</span> {platformTransactionTitle(transaction.type)}</>}
        onBack={onBack}
        backLabel={detail.backButton}
        titleAddon={transaction.internalTransferFeeCredits !== undefined && <CustomBadge text={detail.internalTransfer} className={'shrink-0 whitespace-nowrap'} />}
      />

      <div className={'flex flex-col gap-4'}>
        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex items-center gap-[.625rem]'}>
            <span className={'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12'}>
              <DocumentIcon size={14} color={'currentColor'} className={'dash-text-primary'} />
            </span>
            <Text size={14} weight={'medium'} color={'brand'}>State transition hash:</Text>
          </div>
          <div className={'flex items-center gap-[.3125rem] min-w-0'}>
            <Identifier className={'font-mono font-extrabold!'}>{displayedId}</Identifier>
            <CopyButton text={displayedId} />
            {network && (
              <button
                type={'button'}
                onClick={() => openExternal(platformTransactionUrl(transaction.hash, network))}
                title={'Open in explorer'}
                className={'size-5 shrink-0 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer'}
              >
                <ExternalLinkIcon size={12} color={'currentColor'} className={'dash-text-default opacity-50'} />
              </button>
            )}
          </div>
        </div>

        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex items-center justify-between'}>
            <Text size={14} weight={'medium'} color={'brand'} className={'tracking-[-0.03em]'}>Details:</Text>
            <CustomBadge
              text={platformTransactionStatus(transaction.status)}
              variant={PLATFORM_TX_STATUS_VARIANTS[transaction.status ?? 'unknown']}
            />
          </div>
          {transaction.error && <CopyableError message={transaction.error} />}
          <div className={'grid grid-cols-1 lg:grid-cols-2 gap-3'}>
            <DetailToken
              icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={'dash-text-primary'} />}
              label={'Date:'}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>
                {date ? <>{formatCreationDate(date)} <span className={'font-medium'}>{timePart(date)}</span></> : 'Date unavailable'}
              </Text>}
              subValue={date ? <TimeDelta endDate={date} /> : undefined}
            />
            <DetailToken
              icon={<DashLogo size={14} color={theme === 'light' ? 'var(--color-dash-brand)' : 'var(--color-dash-mint)'} />}
              label={'Balance change:'}
              hint={platformDetail.balanceChangeHint}
              value={<SensitiveValue hidden={!isBalanceVisible} size={'card'}>
                <CreditsAmount credits={transaction.netCredits} prefix={transaction.netCredits > 0n ? '+ ' : ''} exact showFiat={false} align={'end'} amountClassName={'font-extrabold'} className={`text-sm ${transaction.netCredits > 0n ? 'dash-text-primary' : 'dash-text-default'}`} />
              </SensitiveValue>}
              subValue={rateReady || !isBalanceVisible ? <SensitiveValue hidden={!isBalanceVisible} size={'subtext'} label={'Fiat amount hidden'}>
                {rateReady ? formatApproxFiat(formatFiat(creditsToDuffs(transaction.netCredits))) : null}
              </SensitiveValue> : undefined}
            />
            <DetailToken
              icon={<DashLogo size={14} color={theme === 'light' ? 'var(--color-dash-brand)' : 'var(--color-dash-mint)'} />}
              label={'Transition fee:'}
              hint={platformDetail.feeHint}
              value={<SensitiveValue hidden={!isBalanceVisible} size={'card'}>
                <CreditsAmount credits={transaction.gasCredits} exact showFiat={false} align={'end'} amountClassName={'font-extrabold'} className={'text-sm dash-text-default'} />
              </SensitiveValue>}
              subValue={rateReady || !isBalanceVisible ? <SensitiveValue hidden={!isBalanceVisible} size={'subtext'} label={'Fiat amount hidden'}>
                {rateReady ? formatApproxFiat(formatFiat(creditsToDuffs(transaction.gasCredits))) : null}
              </SensitiveValue> : undefined}
            />
            <DetailToken
              icon={<BoxIcon size={14} color={'currentColor'} className={'dash-text-primary'} />}
              label={'Block height:'}
              value={<Text size={14} weight={'medium'} color={'brand'}>
                {transaction.blockHeight !== null ? <DashBigNumber className={'gap-0!'}>{transaction.blockHeight}</DashBigNumber> : 'Unavailable'}
              </Text>}
              subValue={transaction.blockHeight !== null ? 'Height' : undefined}
            />
          </div>
        </div>
        {(['sender', 'recipient'] as const).map(side => transaction[side].length > 0 && (
          <section key={side} className={TRANSACTION_DETAIL_CARD_CLASS} aria-label={side === 'sender' ? 'From' : 'To'}>
            <div className={'flex items-center gap-2'}>
              <Text size={14} weight={'medium'} color={'brand'} className={'tracking-[-0.03em]'}>
                {side === 'sender' ? 'From:' : 'To:'}
              </Text>
              <CustomBadge text={transaction[side].length.toString()} variant={'muted'} size={'xs'} />
            </div>
            <ul className={'flex flex-col gap-3'}>
              {transaction[side].map((participant, index) => {
                const explorerUrl = network ? platformParticipantUrl(participant.source, network) : null
                return (
                <li key={`${participant.source}-${index}`} className={'flex flex-wrap items-center gap-x-4 gap-y-2'}>
                  <div className={'flex items-center gap-[.3125rem] min-w-0 flex-1 basis-64'}>
                    <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>{participant.source}</HighlightedIdentifier>
                    {ownedParticipants.has(participant.source) && <CustomBadge text={'Your wallet'} className={'shrink-0 whitespace-nowrap'} />}
                    <CopyButton text={participant.source} />
                    <QrButton onClick={() => setQrAddress(participant.source)} />
                    {explorerUrl && (
                      <button
                        type={'button'}
                        onClick={() => openExternal(explorerUrl)}
                        title={'Open in explorer'}
                        className={'size-5 shrink-0 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer'}
                      >
                        <ExternalLinkIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
                      </button>
                    )}
                  </div>
                  <div className={'ml-auto shrink-0'}>
                    <SensitiveValue hidden={!isBalanceVisible} size={'compact'}>
                      <CreditsAmount credits={participant.amount} exact showFiat={false} align={'end'} className={'dash-text-default text-sm'} amountClassName={'font-extrabold'} />
                    </SensitiveValue>
                  </div>
                </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {qrAddress && <AddressQrModal address={qrAddress} title={'Participant'} onClose={() => setQrAddress(null)} />}
    </div>
  )
}
