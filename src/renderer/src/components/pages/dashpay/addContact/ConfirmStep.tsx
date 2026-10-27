import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { ADD_CONTACT_COPY, ADD_CONTACT_FACT_ROW_CLASS, ADD_CONTACT_FACT_VALUE_CLASS } from '@renderer/constants/dashPayAddContact'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { AddContactCreditsProps, AddContactPartyProps, ConfirmStepProps } from '@renderer/types/DashPayAddContact'
import { identityName } from '@renderer/utils/identifierFormat'

function Credits({ credits }: AddContactCreditsProps): React.JSX.Element {
  return (
    <Text size={14} weight={"medium"} color={"brand"} className={"text-right"}>
      {credits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={credits} exact showFiat={false} align={"end"} />}
    </Text>
  )
}

function Party({ identifier, name }: AddContactPartyProps): React.JSX.Element {
  return (
    <span className={ADD_CONTACT_FACT_VALUE_CLASS}>
      <IdentityAvatar identifier={identifier} size={IdentityAvatarSize.Xs} />
      <span className={"flex min-w-0 flex-col items-end gap-0.5"}>
        {name != null && <Text reset size={14} weight={"medium"} color={"brand"} className={"max-w-full truncate"}>{name}</Text>}
        <HighlightedIdentifier className={`${ADDRESS_ROW_IDENTIFIER_CLASS} text-right`}>{identifier}</HighlightedIdentifier>
      </span>
    </span>
  )
}

export default function ConfirmStep({ identity, target, fee, shortfall }: ConfirmStepProps): React.JSX.Element {
  const balance = identity.balance.amount
  return (
    <>
      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={ADD_CONTACT_FACT_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{ADD_CONTACT_COPY.from}</Text>
          <Party identifier={identity.identifier} name={identityName(identity)} />
        </div>
        <div className={ADD_CONTACT_FACT_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{ADD_CONTACT_COPY.to}</Text>
          <Party identifier={target.identifier} name={target.name} />
        </div>
        <div className={ADD_CONTACT_FACT_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{ADD_CONTACT_COPY.fee}</Text>
          <Credits credits={fee.credits} />
        </div>
        <div className={"h-px bg-dash-primary-dark-blue/10 dark:bg-white/10"} />
        <div className={ADD_CONTACT_FACT_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{ADD_CONTACT_COPY.balanceAfter}</Text>
          <Credits credits={fee.credits == null || shortfall != null ? null : balance - fee.credits} />
        </div>
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1"}>{ADD_CONTACT_COPY.note}</Text>
      {shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />}
    </>
  )
}
