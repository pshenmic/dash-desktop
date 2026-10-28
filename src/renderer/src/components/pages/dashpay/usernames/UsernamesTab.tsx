import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import ShowMoreButton from '@renderer/components/ui/ShowMoreButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { DASHPAY_USERNAMES_PAGE_SIZE } from '@renderer/constants/dashPay'
import { USERNAME_LIST_COPY } from '@renderer/constants/dashPayUsernames'
import { useAuth } from '@renderer/contexts/AuthContext'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshDashPayUsernames, useDashPayUsernames } from '@renderer/hooks/useDashPayUsernames'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { UsernamesTabProps } from '@renderer/types/DashPayScreens'
import type { UsernameRowModel } from '@renderer/types/Dpns'
import { primaryFirst, registerUsernameHref } from '@renderer/utils/dashPayUsernames'
import { mergeIdentityUsernames } from '@renderer/utils/usernames'
import UsernameDetailModal from './UsernameDetailModal'
import UsernameRow from './UsernameRow'

export default function UsernamesTab({ walletId, identity, readiness, now }: UsernamesTabProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useAuth()
  const network = status?.network ?? null
  const { usernames: walletUsernames, loading, err } = useDashPayUsernames(walletId)
  const [visibleCount, setVisibleCount] = useState(DASHPAY_USERNAMES_PAGE_SIZE)
  const [detail, setDetail] = useState<UsernameRowModel | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const rows = useMemo(
    () => primaryFirst(mergeIdentityUsernames(identity.usernames, walletUsernames, identity.identifier)),
    [identity.usernames, walletUsernames, identity.identifier]
  )

  const openRegister = (label: string | null): void => {
    const state: DashPayNavigationState = { returnTo: location.pathname + location.search }
    navigate(registerUsernameHref(identity.identifier, label), { state })
  }
  const openRow = (row: UsernameRowModel): void => {
    setDetail(row)
    setDetailOpen(true)
  }
  const registerRow = (row: UsernameRowModel): void => openRegister(row.label)

  const registerButton = (
    <Button
      type={"button"}
      size={"compact"}
      colorScheme={"primary"}
      disabled={!readiness.canRegister}
      onClick={() => openRegister(null)}
    >
      {USERNAME_LIST_COPY.register}
    </Button>
  )
  const registerAction = readiness.canRegister
    ? registerButton
    : <Tooltip label={USERNAME_LIST_COPY.needsKey}><span className={"inline-flex"}>{registerButton}</span></Tooltip>

  const waiting = walletUsernames.length === 0 && (loading || err != null)
  const empty = !waiting && rows.length === 0

  let body: React.JSX.Element
  if (loading && walletUsernames.length === 0) {
    body = <ListSkeleton rows={3} rowClassName={"h-13 rounded-[.875rem]"} />
  } else if (err != null && walletUsernames.length === 0) {
    body = (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={err}
        action={<RetryButton onRetry={() => refreshDashPayUsernames(walletId)} />}
      />
    )
  } else if (empty) {
    body = (
      <NoResults
        noResults={USERNAME_LIST_COPY.emptyTitle}
        description={USERNAME_LIST_COPY.emptyDescription}
        action={registerAction}
      />
    )
  } else {
    const visible = rows.slice(0, visibleCount)
    body = (
      <>
        <ul className={"flex flex-col gap-[.625rem]"}>
          {visible.map(row => (
            <UsernameRow
              key={row.normalizedLabel}
              row={row}
              now={now}
              onOpen={openRow}
              onRegister={registerRow}
            />
          ))}
        </ul>
        {rows.length > visible.length && (
          <ShowMoreButton
            remaining={rows.length - visible.length}
            onClick={() => setVisibleCount(count => count + DASHPAY_USERNAMES_PAGE_SIZE)}
          />
        )}
      </>
    )
  }

  return (
    <div className={"flex flex-col gap-4"}>
      <div className={"flex items-center justify-between gap-3"}>
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>
          {rows.length > 0 ? `${USERNAME_LIST_COPY.heading} · ${rows.length}` : USERNAME_LIST_COPY.heading}
        </Text>
        {!empty && registerAction}
      </div>
      {body}
      <UsernameDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        row={detail}
        identity={identity}
        now={now}
        network={network}
        onRegister={registerRow}
      />
    </div>
  )
}
