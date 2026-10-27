import { useEffect, useMemo, useState } from 'react'
import { Identifier, useTheme, TimeDelta, DashLogo } from 'dash-ui-kit/react'
import { cva } from 'class-variance-authority'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import {
  BoxIcon,
  CalendarIconHighlighted,
  CheckIcon,
  DocumentIcon,
} from '@renderer/components/dash-ui-kit-enxtended/icons'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import CopyButton from '@renderer/components/ui/CopyButton'
import QrButton from '@renderer/components/ui/QrButton'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import PageHeader from '@renderer/components/ui/PageHeader'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import Spinner from '@renderer/components/ui/Spinner'
import StatusChip from '@renderer/components/ui/StatusChip'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import { TRANSACTION_DETAIL_CARD_CLASS, TRANSACTION_DETAIL_IDENTIFIER_CLASS, transactionsPage } from '@renderer/constants'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import { davToDash } from '@renderer/utils/balance'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { useFiat } from '@renderer/hooks/useFiat'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { transactionUrl, addressUrl, openExternal } from '@renderer/utils/explorer'
import { ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Network } from '@renderer/api/types'
import { API } from '@renderer/api'
import { mapWalletTransaction } from '@renderer/utils/walletTransactions'
import { coreOwnedAddresses } from '@renderer/utils/ownedAddresses'
import { useAdresses } from '@renderer/hooks/useAdresses'
import { BALANCE_REFRESH_MS } from '@renderer/constants'
import DetailToken from './TransactionDetailToken'

const iconCircleStyles = cva(
  'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12',
)

interface TransactionDetailProps {
  transaction: WalletTxItem
  onBack: () => void
}

function AddressActions({
  address,
  network,
  onShowQr,
}: {
  address: string
  network: Network | null
  onShowQr: (address: string) => void
}): React.JSX.Element {
  return (
    <>
      <CopyButton text={address} />
      <QrButton onClick={() => onShowQr(address)} />
      {network && (
        <button
          onClick={() => openExternal(addressUrl(address, network))}
          title={"Open in explorer"}
          className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
        >
          <ExternalLinkIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
        </button>
      )}
    </>
  )
}

export default function TransactionDetail({ transaction, onBack }: TransactionDetailProps): React.JSX.Element {
  const { detail } = transactionsPage
  const { theme } = useTheme()
  const { status: appStatus } = useAuth()
  const network = appStatus?.network ?? null
  const walletId = appStatus?.selectedWalletId ?? undefined
  const { receiving, change } = useAdresses(walletId, BALANCE_REFRESH_MS)
  const ownedAddresses = useMemo(() => coreOwnedAddresses(walletId, { receiving, change }), [walletId, receiving, change])
  const [qrAddress, setQrAddress] = useState<string | null>(null)
  const [resolvedTransaction, setResolvedTransaction] = useState(transaction)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsFailed, setDetailsFailed] = useState(false)
  const isIncoming = resolvedTransaction.direction === 'in'
  const displayedId = resolvedTransaction.id.toLowerCase()
  const { format: formatFiat, rateReady } = useFiat()
  const { isBalanceVisible } = useBalanceVisibility()

  useEffect(() => {
    setResolvedTransaction(transaction)
    setDetailsFailed(false)

    if (network == null) {
      setDetailsLoading(false)
      return
    }

    let active = true
    setDetailsLoading(true)

    API.getTransactionByHash(transaction.id, network)
      .then((raw) => {
        if (!active) return
        const mapped = mapWalletTransaction(raw)
        setResolvedTransaction(transaction.internalTransfer ? {
          ...mapped,
          internalTransfer: true,
          internalTransferFee: transaction.internalTransferFee,
        } : mapped)
      })
      .catch((error) => {
        console.error('[transaction detail] fetch failed:', error)
        if (active) setDetailsFailed(true)
      })
      .finally(() => {
        if (active) setDetailsLoading(false)
      })

    return () => {
      active = false
    }
  }, [network, transaction])

  function trimTrailingZeros(value: string): string {
    return value
      .replace(/(\.\d*?[1-9])0+$/, '$1')
      .replace(/\.0+$/, '')
  }

  return (
    <div className={"px-12 pb-8"}>
      <PageHeader
        title={<><span className={"opacity-50"}>{detail.titlePrefix}</span>{' '}{resolvedTransaction.title}</>}
        onBack={onBack}
        backLabel={detail.backButton}
        titleAddon={<>
          {resolvedTransaction.internalTransfer && <CustomBadge text={detail.internalTransfer} className={"shrink-0 whitespace-nowrap"} />}
          {detailsLoading && (
            <span role={"status"} className={"flex shrink-0"}>
              <Spinner size={20} className={"text-dash-brand dark:text-dash-mint"} />
              <span className={"sr-only"}>{detail.loadingDetails}</span>
            </span>
          )}
        </>}
      />

      <div className={"flex flex-col gap-4"}>
        {detailsFailed && <StatusChip>{detail.cachedDetails}</StatusChip>}

        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={"flex items-center gap-[.625rem]"}>
            <span className={iconCircleStyles()}>
              <DocumentIcon size={14} color={"currentColor"} className={"dash-text-primary"} />
            </span>
            <Text size={14} weight={"medium"} color={"brand"}>
              {detail.transactionId}:
            </Text>
          </div>
          <div className={"flex items-center gap-[.3125rem]"}>
            <Identifier className={"font-mono font-extrabold!"} >
              {displayedId}
            </Identifier>
            <CopyButton text={displayedId} />
            {network && (
              <button
                onClick={() => openExternal(transactionUrl(resolvedTransaction.id, network))}
                title={"Open in explorer"}
                className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
              >
                <ExternalLinkIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
              </button>
            )}
          </div>
        </div>

        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={"flex items-center justify-between"}>
            <Text size={14} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
              {detail.details}:
            </Text>
            <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"tracking-[-0.03em]"}>
              {detail.size}: {resolvedTransaction.size} {detail.bytes}
            </Text>
          </div>

          <div className={"flex flex-col gap-3"}>
            <div className={"flex gap-3"}>
              <DetailToken
                icon={<CalendarIconHighlighted size={14} color={"currentColor"} className={"dash-text-primary"} />}
                label={`${detail.fields.date}:`}
                value={
                  <Text size={14} weight={"extrabold"} color={"brand"}>
                      {formatCreationDate(resolvedTransaction.date)} <span className={"font-medium"}>{timePart(resolvedTransaction.date)}</span>
                  </Text>
                }
                subValue={<TimeDelta endDate={resolvedTransaction.date} />}
              />
              <DetailToken
                icon={<DashLogo size={14} color={theme === 'light' ? 'var(--color-dash-brand)' : 'var(--color-dash-mint)'} className={"dash-text-primary"} />}
                label={`${detail.fields.amount}:`}
                value={
                  <SensitiveValue hidden={!isBalanceVisible} size={"card"} tone={isIncoming ? 'accent' : 'default'}>
                    <Text size={14} weight={"medium"} color={"brand"}>
                      <span className={`font-extrabold ${isIncoming ? 'dash-text-primary' : ''}`}>
                        {isIncoming ? '+ ' : '- '}
                        <DashBigNumber>{davToDash(resolvedTransaction.amount).toString()}</DashBigNumber>
                      </span>
                      {' Dash'}
                    </Text>
                  </SensitiveValue>
                }
                subValue={rateReady ? (
                  <SensitiveValue hidden={!isBalanceVisible} size={"subtext"} label={"Fiat amount hidden"}>
                    {formatApproxFiat(formatFiat(resolvedTransaction.amount))}
                  </SensitiveValue>
                ) : undefined}
              />
            </div>
            <div className={"flex gap-3 min-h-17"}>
              <DetailToken
                icon={<CheckIcon size={30} color={"currentColor"} className={"dash-text-primary [&_circle]:hidden"} />}
                label={`${detail.fields.confirmations}:`}
                value={
                  <Text size={14} weight={"medium"} color={"brand"}>
                    <DashBigNumber className={"gap-0!"}>{resolvedTransaction.confirmations}</DashBigNumber>
                  </Text>
                }
              />
              {resolvedTransaction.blockHeight && (
                <DetailToken
                  icon={<BoxIcon size={14} color={"currentColor"} className={"dash-text-primary"} />}
                  label={`${detail.fields.lockTime}:`}
                  value={
                    <Text size={14} weight={"medium"} color={"brand"}>
                      <DashBigNumber className={"gap-0!"}>{resolvedTransaction.blockHeight}</DashBigNumber>
                    </Text>
                  }
                  subValue={detail.fields.height}
                />
              )}
            </div>
          </div>
        </div>

        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={"flex items-center gap-2"}>
            <Text size={14} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
              {detail.inputs}:
            </Text>
            <CustomBadge text={resolvedTransaction.vin.length.toString()} variant={"muted"} size={"xs"} />
          </div>
          <div className={"flex flex-col gap-3"}>
            {resolvedTransaction.vin.map((input, i) => (
              <div key={`input-${i}`} className={"flex items-center gap-2 justify-between"}>
                <div className={"flex items-center gap-[.3125rem] flex-1 min-w-0"}>
                  <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>
                    {input.addr}
                  </HighlightedIdentifier>
                  {ownedAddresses.has(input.addr) && <CustomBadge text={'Your wallet'} className={'shrink-0 whitespace-nowrap'} />}
                  {input.addr && (
                    <AddressActions address={input.addr} network={network} onShowQr={setQrAddress} />
                  )}
                </div>
                <SensitiveValue hidden={!isBalanceVisible} size={"compact"}>
                  <Text size={14} weight={"medium"} color={"brand"} className={"shrink-0"}>
                    <span className={"font-extrabold"}>
                      <DashBigNumber>{input.value}</DashBigNumber>
                    </span>
                    {' Dash'}
                  </Text>
                </SensitiveValue>
              </div>
            ))}
          </div>
        </div>

        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={"flex items-center gap-2"}>
            <Text size={14} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
              {detail.outputs}:
            </Text>
            <CustomBadge text={resolvedTransaction.vout.length.toString()} variant={"muted"} size={"xs"} />
          </div>
          <div className={"flex flex-col gap-3"}>
            {resolvedTransaction.vout.map((output, i) => (
              <div key={`output-${i}`} className={"flex items-center gap-2 justify-between"}>
                <div className={"flex items-center gap-2 flex-1 min-w-0"}>
                  {
                    output.address ? (
                      <>
                        <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>{output.address}</HighlightedIdentifier>
                        {ownedAddresses.has(output.address) && <CustomBadge text={'Your wallet'} className={'shrink-0 whitespace-nowrap'} />}
                        <AddressActions address={output.address} network={network} onShowQr={setQrAddress} />
                      </>
                    ) : (
                      <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"shrink-0"}>
                        OP_RETURN
                      </Text>
                    )
                  }
                </div>
                <SensitiveValue hidden={!isBalanceVisible} size={"compact"}>
                  <Text size={14} weight={"medium"} color={"brand"} className={"shrink-0"}>
                    <span className={"font-extrabold"}>
                      <DashBigNumber>{trimTrailingZeros(output.value)}</DashBigNumber>
                    </span>
                    {' Dash'}
                  </Text>
                </SensitiveValue>
              </div>
            ))}
          </div>
        </div>
      </div>

      {qrAddress && <AddressQrModal address={qrAddress} title={detail.qrTitle} onClose={() => setQrAddress(null)} />}
    </div>
  )
}
