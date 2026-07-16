import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text, ArrowIcon, KeyIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import { dashboardPage } from '@renderer/constants'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useIdentities } from '@renderer/hooks/useIdentities'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { formatCompactCredits } from '@renderer/utils/balance'

function shortIdentifier(identifier: string): string {
  return identifier.length <= 12 ? identifier : `${identifier.slice(0, 6)}…${identifier.slice(-4)}`
}

export default function IdentitiesCard(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined

  const { identities } = useIdentities(walletId)
  const { isBalanceVisible } = useBalanceVisibility()
  const labels = dashboardPage.identities

  const totalCredits = useMemo(
    () => identities.reduce((sum, i) => sum + i.balance.amount, 0n),
    [identities]
  )
  const topIdentity = useMemo(
    () =>
      identities.reduce<(typeof identities)[number] | null>(
        (top, i) => (top === null || i.balance.amount > top.balance.amount ? i : top),
        null
      ),
    [identities]
  )

  const blur = isBalanceVisible ? '' : 'blur-sm select-none pointer-events-none'

  return (
    <div className={"relative overflow-hidden flex flex-col gap-3 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_0_rgba(12,28,51,0.14)]"}>
      <div className={"absolute -top-14 -right-8 size-36 rounded-full bg-dash-brand/8 dark:bg-dash-mint/6 blur-3xl pointer-events-none"} />
      <div className={"relative flex items-center justify-between"}>
        <div className={"flex items-center gap-2.5"}>
          <span className={"flex size-[1.875rem] shrink-0 items-center justify-center rounded-full bg-dash-brand/12 dark:bg-dash-mint/12 dash-text-primary"}>
            <KeyIcon size={14} color={"currentColor"} />
          </span>
          <Text size={14} weight={"medium"} color={"brand"}>
            {labels.title}
          </Text>
        </div>
        <button
          onClick={() => navigate('/identities')}
          className={"group flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity duration-200"}
        >
          <Text size={12} weight={"medium"} color={"blue-mint"}>
            {labels.viewAll}
          </Text>
          <ArrowIcon size={9} className={"dash-text-primary rotate-180 transition-transform duration-200 group-hover:translate-x-0.5"} color={"currentColor"} />
        </button>
      </div>

      <div className={"flex flex-col gap-1"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
          {labels.totalBalance}
        </Text>
        <Text size={20} weight={"extrabold"} color={"brand"} className={`leading-[140%] ${blur}`}>
          <CreditsAmount credits={totalCredits} compact />
        </Text>
      </div>

      {identities.length === 0 ? (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[150%]"}>
          {labels.empty}
          {' · '}
          <button
            onClick={() => navigate('/send?from=core&to=newIdentity')}
            className={"cursor-pointer hover:opacity-80 transition-opacity duration-200 text-dash-brand dark:text-dash-mint"}
          >
            {labels.register}
          </button>
        </Text>
      ) : (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={`leading-[150%] ${blur}`}>
          {identities.length} {identities.length === 1 ? labels.one : labels.many}
          {topIdentity !== null && (
            <>
              {' · '}
              {labels.top} {topIdentity.alias ?? shortIdentifier(topIdentity.identifier)}{' '}
              ({formatCompactCredits(topIdentity.balance.amount)} {labels.credits})
            </>
          )}
        </Text>
      )}
    </div>
  )
}
