import { useEffect, useState } from 'react'
import { Identifier, useTheme, TimeDelta, ChevronIcon, DashLogo } from 'dash-ui-kit/react'
import { cva } from 'class-variance-authority'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
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
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import AddressQrModal from '@renderer/components/modal/AddressQrModal'
import { transactionsPage } from '@renderer/constants'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import { useRipple } from '@renderer/hooks/useRipple'
import { davToDash } from '@renderer/utils/balance'
import { useFiat } from '@renderer/hooks/useFiat'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { transactionUrl, addressUrl, openExternal } from '@renderer/utils/explorer'
import { ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Network } from '@renderer/api/types'
import { API } from '@renderer/api'
import { mapWalletTransaction } from '@renderer/utils/walletTransactions'

const cardStyles = cva(
  'flex flex-col gap-5 p-[.9375rem] rounded-[.9375rem] dash-card-base shadow-[0_0_50px_0_rgba(0,0,0,0.1)]'
)

const detailTokenStyles = cva(
  'flex flex-1 items-center justify-between p-3 rounded-xl dash-block'
)

const iconCircleStyles = cva(
  'flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12',
)

interface TransactionDetailProps {
  transaction: WalletTxItem
  onBack: () => void
}

function DetailToken({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subValue?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={detailTokenStyles()}>
      <div className={"flex items-center gap-[.625rem]"}>
        <span className={iconCircleStyles()}>
          {icon}
        </span>
        <Text size={14} weight={"medium"} color={"brand"}>
          {label}
        </Text>
      </div>
      <div className={"flex flex-col items-end gap-[.3125rem]"}>
        <div>{value}</div>
        {subValue && (
          <Text size={10} weight={"medium"} color={"brand"} opacity={30}>
            {subValue}
          </Text>
        )}
      </div>
    </div>
  )
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
  const [qrAddress, setQrAddress] = useState<string | null>(null)
  const [resolvedTransaction, setResolvedTransaction] = useState(transaction)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const isIncoming = resolvedTransaction.direction === 'in'
  const hoverNotification = useRipple()
  const { format: formatFiat, rateReady } = useFiat()
  const { isBalanceVisible } = useBalanceVisibility()

  useEffect(() => {
    setResolvedTransaction(transaction)
    setDetailsError(null)

    if (network == null) {
      setDetailsLoading(false)
      return
    }

    let active = true
    setDetailsLoading(true)

    API.getTransactionByHash(transaction.id, network)
      .then((raw) => {
        if (active) setResolvedTransaction(mapWalletTransaction(raw))
      })
      .catch((error) => {
        console.error('[transaction detail] fetch failed:', error)
        if (active) setDetailsError('Could not load complete transaction details. Showing cached data.')
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
    <div className={"flex flex-col gap-4 px-12 pb-8"}>
      <div className={"flex items-center gap-4.5 mb-5"}>
        <button
          onClick={onBack}
          onMouseEnter={hoverNotification.onMouseEnter}
          onMouseMove={hoverNotification.onMouseMove}
          onMouseLeave={hoverNotification.onMouseLeave}
          className={"relative overflow-hidden flex size-12 shrink-0 items-center justify-center rounded-[.9375rem] dash-block dash-black-border hover:opacity-70 transition-opacity cursor-pointer"}
        >
          <ChevronIcon
            size={17}
            className={`
            dash-text-default
            rotate-90
          `}/>
        </button>
        <Text size={40} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
          <span className={"opacity-50"}>{detail.titlePrefix}</span>
          {' '}{resolvedTransaction.title}
        </Text>
      </div>

      {detailsLoading && (
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>
          Loading complete transaction details...
        </Text>
      )}
      {detailsError && (
        <Text size={14} weight={"medium"} color={"brand"}>
          {detailsError}
        </Text>
      )}

      <div className={cardStyles()}>
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
            {resolvedTransaction.id}
          </Identifier>
          <CopyButton text={resolvedTransaction.id} />
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

      <div className={cardStyles()}>
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
              subValue={rateReady || !isBalanceVisible ? (
                <SensitiveValue hidden={!isBalanceVisible} size={"subtext"} label={"Fiat amount hidden"}>
                  {rateReady ? `~ ${formatFiat(resolvedTransaction.amount)}` : null}
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

      <div className={cardStyles()}>
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
                <Identifier className={"font-mono opacity-40 dark:opacity-100"}>
                  {input.addr}
                </Identifier>
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

      <div className={cardStyles()}>
        <div className={"flex items-center gap-2"}>
          <Text size={14} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
            {detail.outputs}:
          </Text>
          <CustomBadge text={resolvedTransaction.vout.length.toString()} variant={"muted"} size={"xs"} />
        </div>
        <div className={"flex flex-col gap-3"}>
          {resolvedTransaction.vout.map((output, i) => (
            <div key={`output-${i}`} className={"flex w-max min-w-full items-center gap-2 justify-between"}>
              <div className={"flex items-center gap-2"}>
                {
                  output.address ? (
                    <>
                      <Identifier linesAdjustment={false} className={"whitespace-nowrap"}>{output.address}</Identifier>
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

      {qrAddress && <AddressQrModal address={qrAddress} title={detail.qrTitle} onClose={() => setQrAddress(null)} />}
    </div>
  )
}
