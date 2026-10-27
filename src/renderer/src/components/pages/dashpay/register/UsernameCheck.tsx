import { CheckIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import Alert from '@renderer/components/ui/Alert'
import RetryButton from '@renderer/components/ui/RetryButton'
import Spinner from '@renderer/components/ui/Spinner'
import { USERNAME_AVAILABILITY_BLOCKING, USERNAME_CHECK_COPY } from '@renderer/constants/dashPayUsernames'
import { DPNS_LABEL_MESSAGES, VOTE_POLL_DURATION_LABEL } from '@renderer/constants/dpns'
import { AlertTone } from '@renderer/enums/AlertTone'
import { DpnsLabelKind, UsernameAvailability } from '@renderer/enums/DashPay'
import type { UsernameCheckProps } from '@renderer/types/DashPayUsernames'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'

function AvailabilityLine({ check, availability, ownerName, onRetry }: Omit<UsernameCheckProps, 'network'>): React.JSX.Element | null {
  const name = fullDpnsName(check.label)
  switch (availability) {
    case UsernameAvailability.Checking:
      return (
        <span role={"status"} className={"flex items-center gap-1.5"}>
          <Spinner size={12} />
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{USERNAME_CHECK_COPY.checking}</Text>
        </span>
      )
    case UsernameAvailability.Available:
      return (
        <span className={"flex items-center gap-1.5 text-dash-green"}>
          <CheckIcon size={12} color={"currentColor"} className={"[&_circle]:hidden"} />
          <Text size={12} weight={"medium"} className={"text-inherit!"}>
            {`${USERNAME_CHECK_COPY.available} · ${check.kind === DpnsLabelKind.Contested ? USERNAME_CHECK_COPY.contested : USERNAME_CHECK_COPY.instant}`}
          </Text>
        </span>
      )
    case UsernameAvailability.Taken:
      return <Text size={12} weight={"medium"} color={"red"}>{`${name} ${USERNAME_CHECK_COPY.taken}`}</Text>
    case UsernameAvailability.Owned:
      return <Text size={12} weight={"medium"} color={"red"}>{`${USERNAME_CHECK_COPY.owned} ${name}`}</Text>
    case UsernameAvailability.OwnedByWallet:
      return <Text size={12} weight={"medium"} color={"red"} className={"wrap-anywhere"}>{`${ownerName ?? ''} ${USERNAME_CHECK_COPY.ownedByWallet}`.trim()}</Text>
    case UsernameAvailability.InContest:
      return <Text size={12} weight={"medium"} color={"red"}>{`${USERNAME_CHECK_COPY.inContest} ${name}`}</Text>
    case UsernameAvailability.InWalletContest:
      return <Text size={12} weight={"medium"} color={"red"} className={"wrap-anywhere"}>{`${ownerName ?? ''} ${USERNAME_CHECK_COPY.inWalletContest}`.trim()}</Text>
    case UsernameAvailability.Error:
      return (
        <span className={"flex items-center gap-2"}>
          <Text size={12} weight={"medium"} className={"text-dash-orange!"}>{USERNAME_CHECK_COPY.error}</Text>
          <RetryButton onRetry={onRetry} />
        </span>
      )
    default:
      return null
  }
}

export default function UsernameCheck({ check, network, availability, ownerName, onRetry }: UsernameCheckProps): React.JSX.Element | null {
  if (check.label === '') return null
  if (check.issue != null) {
    return <Text size={12} weight={"medium"} color={"red"}>{DPNS_LABEL_MESSAGES[check.issue]}</Text>
  }

  const contested = check.kind === DpnsLabelKind.Contested && !USERNAME_AVAILABILITY_BLOCKING.includes(availability)
  const contestedDescription = network == null
    ? `${USERNAME_CHECK_COPY.contestedLead} ${USERNAME_CHECK_COPY.contestedTail}`
    : `${USERNAME_CHECK_COPY.contestedLead} ${USERNAME_CHECK_COPY.contestedFor} ${VOTE_POLL_DURATION_LABEL[network]} ${USERNAME_CHECK_COPY.contestedTail}`

  return (
    <div className={"flex flex-col gap-3"}>
      <div className={"flex flex-col gap-1"}>
        <AvailabilityLine check={check} availability={availability} ownerName={ownerName} onRetry={onRetry} />
        {check.normalized !== check.label.toLowerCase() && (
          <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
            {`${USERNAME_CHECK_COPY.savedAs} ${check.normalized} — ${USERNAME_CHECK_COPY.homographHint}`}
          </Text>
        )}
      </div>
      {contested && (
        <Alert
          tone={AlertTone.Warning}
          icon={<ExclamationIcon size={16} color={"currentColor"} />}
          title={USERNAME_CHECK_COPY.contestedTitle}
          description={contestedDescription}
        />
      )}
    </div>
  )
}
