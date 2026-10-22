import { useNavigate } from 'react-router-dom'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { KEY_SHORTFALL_COPY, KEYS_TOP_UP_HREF } from '@renderer/constants/dashPayKeys'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { KeysShortfallKind } from '@renderer/enums/DashPay'
import type { KeysShortfallProps } from '@renderer/types/DashPayKeys'
import { keysShortfallMessage } from '@renderer/utils/dashPayKeySetup'
import { identityLabel } from '@renderer/utils/identifierFormat'

export default function KeysShortfall({ shortfall, identity, onRetryFee }: KeysShortfallProps): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className={"flex items-center justify-between gap-3 px-1"}>
      <Text size={12} weight={"medium"} color={"red"} className={"min-w-0 break-words"}>
        {keysShortfallMessage(shortfall, identityLabel(identity))}
      </Text>
      {shortfall.kind === KeysShortfallKind.FeeError && (
        <button type={"button"} className={CHIP_ACTION} onClick={onRetryFee}>{KEY_SHORTFALL_COPY.retry}</button>
      )}
      {shortfall.kind === KeysShortfallKind.Balance && (
        <button type={"button"} className={CHIP_ACTION} onClick={() => navigate(KEYS_TOP_UP_HREF)}>{KEY_SHORTFALL_COPY.topUp}</button>
      )}
    </div>
  )
}
