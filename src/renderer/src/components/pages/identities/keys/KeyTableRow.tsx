import { Text } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import {
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEY_TABLE_GRID,
  IDENTITY_KEY_TYPE_LABELS,
  IDENTITY_KEY_UPDATE_COPY,
  IDENTITY_KEYS_COPY,
  KEY_TABLE_ROW_CLASS,
} from '@renderer/constants/identityKeys'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { KeyTableRowProps } from '@renderer/types/IdentityKeys'
import { isIdentityKeyActive } from '@renderer/utils/identities'
import { identityKeyAction } from '@renderer/utils/identityKeyActions'
import { keyBoundsLabel, keyLabel } from '@renderer/utils/identityKeyRequests'

export default function KeyTableRow({ identityKey, onAction }: KeyTableRowProps): React.JSX.Element {
  const active = isIdentityKeyActive(identityKey)
  const action = identityKeyAction(identityKey)
  const bounds = keyBoundsLabel(identityKey.contractBounds)
  let boundsCell = <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{IDENTITY_KEYS_COPY.unbound}</Text>
  if (bounds?.isDashPay) {
    boundsCell = <CustomBadge variant={"accent"} text={bounds.text} className={"max-w-full"} />
  } else if (bounds != null) {
    boundsCell = <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 font-mono break-all"}>{bounds.text}</Text>
  }

  return (
    <div className={`${KEY_TABLE_ROW_CLASS} ${IDENTITY_KEY_TABLE_GRID} ${active ? '' : 'opacity-50'}`}>
      <Text size={14} weight={"medium"} color={"brand"} className={"tabular-nums"}>{identityKey.keyId}</Text>
      <Text size={14} weight={"medium"} color={"brand"} className={"truncate"}>{keyLabel(identityKey.purpose, IDENTITY_KEY_PURPOSE_LABELS)}</Text>
      <Text size={14} weight={"medium"} color={"brand"} className={"truncate"}>{keyLabel(identityKey.securityLevel, IDENTITY_KEY_LEVEL_LABELS)}</Text>
      <Text size={14} weight={"medium"} color={"brand"} className={"truncate"}>{keyLabel(identityKey.keyType, IDENTITY_KEY_TYPE_LABELS)}</Text>
      <div className={"flex min-w-0 items-center"}>{boundsCell}</div>
      <div className={"flex justify-start"}>
        {active
          ? <StatusPill tone={StatusPillTone.Success}>{IDENTITY_KEYS_COPY.active}</StatusPill>
          : <StatusPill tone={StatusPillTone.Inactive}>{IDENTITY_KEYS_COPY.disabled}</StatusPill>}
      </div>
      <div className={"flex justify-end"}>
        {action != null && (
          <button type={"button"} className={CHIP_ACTION} onClick={() => onAction(identityKey, action)}>
            {IDENTITY_KEY_UPDATE_COPY[action].action}
          </button>
        )}
      </div>
    </div>
  )
}
