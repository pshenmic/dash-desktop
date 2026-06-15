import { Identifier, BigNumber, useTheme, TimeDelta, ChevronIcon, DashLogo } from 'dash-ui-kit/react'
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
import { transactionsPage } from '@renderer/constants'
import { WalletTxItem } from '@renderer/hooks/useWalletTransactions'
import { formatCreationDate, timePart } from '@renderer/utils/date'
import { useRipple } from '@renderer/hooks/useRipple'
import { davToDash } from '@renderer/utils/balance'
import { useFiat } from '@renderer/hooks/useFiat'
import { transactionUrl, openExternal } from '@renderer/utils/explorer'
import { ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import QrButton from '@renderer/components/ui/QrButton'

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

export default function TransactionDetail({ transaction, onBack }: TransactionDetailProps): React.JSX.Element {
  const { detail } = transactionsPage
  const { theme } = useTheme()
  const { status: appStatus } = useAuth()
  const network = appStatus?.network ?? null
  const isIncoming = transaction.direction === 'in'
  const hoverNotification = useRipple()
  const { format: formatFiat, rateReady } = useFiat()

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
          {' '}{transaction.title}
        </Text>
      </div>

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
            {transaction.id}
          </Identifier>
          <CopyButton text={transaction.id} />
          {network && (
            <button
              onClick={() => openExternal(transactionUrl(transaction.id, network))}
              title={"Open in explorer"}
              className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
            >
              <ExternalLinkIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
            </button>
          )}
          <QrButton />
        </div>
      </div>

      <div className={cardStyles()}>
        <div className={"flex items-center justify-between"}>
          <Text size={14} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
            {detail.details}:
          </Text>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"tracking-[-0.03em]"}>
            {detail.size}: {transaction.size} {detail.bytes}
          </Text>
        </div>

        <div className={"flex flex-col gap-3"}>
          <div className={"flex gap-3"}>
            <DetailToken
              icon={<CalendarIconHighlighted size={14} color={"currentColor"} className={"dash-text-primary"} />}
              label={`${detail.fields.date}:`}
              value={
                <Text size={14} weight={"extrabold"} color={"brand"}>
                    {formatCreationDate(transaction.date)} <span className={"font-medium"}>{timePart(transaction.date)}</span>
                </Text>
              }
              subValue={<TimeDelta endDate={transaction.date} />}
            />
            <DetailToken
              icon={<DashLogo size={14} color={theme === 'light' ? 'var(--color-dash-brand)' : 'var(--color-dash-mint)'} className={"dash-text-primary"} />}
              label={`${detail.fields.amount}:`}
              value={
                <Text size={14} weight={"medium"} color={"brand"}>
                  <span className={`font-extrabold ${isIncoming ? 'dash-text-primary' : ''}`}>
                    {isIncoming ? '+ ' : '- '}
                    <BigNumber className={"text-inherit"}>{davToDash(transaction.amount).toString()}</BigNumber>
                  </span>
                  {' Dash'}
                </Text>
              }
              subValue={rateReady ? `~ ${formatFiat(transaction.amount)}` : undefined}
            />
          </div>
          <div className={"flex gap-3 min-h-17"}>
            <DetailToken
              icon={<CheckIcon size={30} color={"currentColor"} className={"dash-text-primary [&_circle]:hidden"} />}
              label={`${detail.fields.confirmations}:`}
              value={
                <Text size={14} weight={"medium"} color={"brand"}>
                  <BigNumber className={"gap-0!"}>{transaction.confirmations}</BigNumber>
                </Text>
              }
            />
            {transaction.blockHeight && (
              <DetailToken
                icon={<BoxIcon size={14} color={"currentColor"} className={"dash-text-primary"} />}
                label={`${detail.fields.lockTime}:`}
                value={
                  <Text size={14} weight={"medium"} color={"brand"}>
                    <BigNumber className={"gap-0!"}>{transaction.blockHeight}</BigNumber>
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
          <CustomBadge text={transaction.vin.length.toString()} variant={"muted"} size={"xs"} />
        </div>
        <div className={"flex flex-col gap-3"}>
           {transaction.vin.map((input, i) => (
            <div key={`input-${i}`} className={"flex items-center gap-2 justify-between"}>
              <Identifier className={"font-mono opacity-40 dark:opacity-100"}>
                {input.addr}
              </Identifier>
              <Text size={14} weight={"medium"} color={"brand"} className={"shrink-0"}>
                <span className={"font-extrabold"}>
                  <BigNumber>{input.value}</BigNumber>
                </span>
                {' Dash'}
              </Text>
            </div>
          ))}
        </div>
      </div>

      <div className={cardStyles()}>
        <div className={"flex items-center gap-2"}>
          <Text size={14} weight={"medium"} color={"brand"} className={"tracking-[-0.03em]"}>
            {detail.outputs}:
          </Text>
          <CustomBadge text={transaction.vout.length.toString()} variant={"muted"} size={"xs"} />
        </div>
        <div className={"flex flex-col gap-3"}>
          {transaction.vout.map((output, i) => (
            <div key={`output-${i}`} className={"flex items-center gap-2 justify-between"}>
              <div className={"flex items-center gap-2 flex-1 min-w-0"}>
                {
                  output.address ? (
                    <Identifier>{output.address}</Identifier>
                  ) : (
                    <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"shrink-0"}>
                      OP_RETURN
                    </Text>
                  )
                }
              </div>
              <Text size={14} weight={"medium"} color={"brand"} className={"shrink-0"}>
                <span className={"font-extrabold"}>
                  <BigNumber>{trimTrailingZeros(output.value)}</BigNumber>
                </span>
                {' Dash'}
              </Text>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
