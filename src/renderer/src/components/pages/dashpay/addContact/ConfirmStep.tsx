import { useNavigate } from 'react-router-dom'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import {
  ADD_CONTACT_CHIP_CLASS,
  ADD_CONTACT_COPY,
  ADD_CONTACT_FACT_ROW_CLASS,
  ADD_CONTACT_FACT_VALUE_CLASS,
  ADD_CONTACT_TOP_UP_HREF,
} from '@renderer/constants/dashPayAddContact'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { AddContactCreditsProps, AddContactShortfallProps, ConfirmStepProps } from '@renderer/types/DashPayAddContact'
import { creditsToDash } from '@renderer/utils/balance'
import { resultRowLabel } from '@renderer/utils/dashPayAddContact'
import { identityLabel, shortIdentifier } from '@renderer/utils/identifierFormat'

export function ContactRequestShortfall({ identity, fee, shortfall }: AddContactShortfallProps): React.JSX.Element | null {
  const navigate = useNavigate()
  if (fee.err != null) {
    return (
      <div className={"flex items-center gap-2 px-1"}>
        <Text size={12} weight={"medium"} color={"red"}>{ADD_CONTACT_COPY.feeError}</Text>
        <button type={"button"} className={ADD_CONTACT_CHIP_CLASS} onClick={fee.retry}>{ADD_CONTACT_COPY.retry}</button>
      </div>
    )
  }
  if (shortfall == null) return null
  return (
    <div className={"flex items-center gap-2 px-1"}>
      <Text size={12} weight={"medium"} color={"red"} className={"min-w-0"}>
        {`${identityLabel(identity)} ${ADD_CONTACT_COPY.needs} ${creditsToDash(shortfall)} ${ADD_CONTACT_COPY.dashMore}`}
      </Text>
      <button type={"button"} className={ADD_CONTACT_CHIP_CLASS} onClick={() => navigate(ADD_CONTACT_TOP_UP_HREF)}>{ADD_CONTACT_COPY.topUp}</button>
    </div>
  )
}

function Credits({ credits }: AddContactCreditsProps): React.JSX.Element {
  return (
    <Text size={14} weight={"medium"} color={"brand"} className={"text-right"}>
      {credits == null ? TX_SUMMARY_PENDING_VALUE : <CreditsAmount credits={credits} exact showFiat={false} align={"end"} />}
    </Text>
  )
}

export default function ConfirmStep({ identity, target, fee, shortfall }: ConfirmStepProps): React.JSX.Element {
  const balance = identity.balance.amount
  return (
    <>
      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={ADD_CONTACT_FACT_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{ADD_CONTACT_COPY.from}</Text>
          <span className={ADD_CONTACT_FACT_VALUE_CLASS}>
            <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xs} />
            <Text reset size={14} weight={"medium"} color={"brand"} className={"min-w-0 truncate"}>{identityLabel(identity)}</Text>
          </span>
        </div>
        <div className={ADD_CONTACT_FACT_ROW_CLASS}>
          <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{ADD_CONTACT_COPY.to}</Text>
          <span className={ADD_CONTACT_FACT_VALUE_CLASS}>
            <IdentityAvatar identifier={target.identifier} size={IdentityAvatarSize.Xs} />
            <Text reset size={14} weight={"medium"} color={"brand"} className={"min-w-0 truncate"}>{resultRowLabel(target)}</Text>
            {target.name != null && (
              <Text reset size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{shortIdentifier(target.identifier)}</Text>
            )}
          </span>
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
      <ContactRequestShortfall identity={identity} fee={fee} shortfall={shortfall} />
    </>
  )
}
