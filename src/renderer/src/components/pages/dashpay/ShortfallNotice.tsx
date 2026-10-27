import { useNavigate } from 'react-router-dom'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { DASHPAY_TOP_UP_HREF, FEE_SHORTFALL_COPY } from '@renderer/constants/dashPay'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { ShortfallKind } from '@renderer/enums/DashPay'
import type { ShortfallNoticeProps } from '@renderer/types/DashPay'
import { shortfallMessage } from '@renderer/utils/dashPayShortfall'
import { identityLabel } from '@renderer/utils/identifierFormat'

export default function ShortfallNotice({ shortfall, identity, onRetry }: ShortfallNoticeProps): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className={"flex items-center justify-between gap-3 px-1"}>
      <Text size={12} weight={"medium"} color={"red"} className={"min-w-0 wrap-anywhere"}>
        {shortfallMessage(shortfall, identityLabel(identity))}
      </Text>
      {shortfall.kind === ShortfallKind.FeeError && (
        <button type={"button"} className={`${CHIP_ACTION} shrink-0`} onClick={onRetry}>{FEE_SHORTFALL_COPY.retry}</button>
      )}
      {shortfall.kind === ShortfallKind.Balance && (
        <button type={"button"} className={`${CHIP_ACTION} shrink-0`} onClick={() => navigate(DASHPAY_TOP_UP_HREF)}>{FEE_SHORTFALL_COPY.topUp}</button>
      )}
    </div>
  )
}
