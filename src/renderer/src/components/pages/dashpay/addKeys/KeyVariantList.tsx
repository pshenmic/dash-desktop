import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import CheckRow from '@renderer/components/ui/CheckRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { ADD_KEYS_COPY, KEY_VARIANT_GROUPS, KEY_VARIANT_ROW_CLASS } from '@renderer/constants/dashPayKeys'
import { LIST_GROUP_LABEL_CLASS } from '@renderer/constants/listToolbar'
import type { KeyVariantListProps } from '@renderer/types/DashPayKeys'
import { keysOnIdentityLabel, keyVariantTitle } from '@renderer/utils/dashPayKeySetup'
import { keyRequestLabel, keysMatchingVariant, variantRequest } from '@renderer/utils/identityKeyRequests'

export default function KeyVariantList({ existing, selected, recommended, check, onToggle }: KeyVariantListProps): React.JSX.Element {
  const atLimit = selected.length >= check.slotsLeft
  return (
    <div className={"flex flex-col gap-2"}>
      {KEY_VARIANT_GROUPS.map(group => (
        <div key={group.label} className={"flex flex-col gap-2"}>
          <Text size={10} weight={"extrabold"} color={"brand"} opacity={50} className={LIST_GROUP_LABEL_CLASS}>{group.label}</Text>
          {group.definitions.map(definition => {
            const checked = selected.includes(definition.variant)
            const onIdentity = keysMatchingVariant(existing, definition.variant)
            return (
              <CheckRow
                key={definition.variant}
                label={keyRequestLabel(variantRequest(definition.variant))}
                checked={checked}
                disabled={!checked && atLimit}
                onChange={value => onToggle(definition.variant, value)}
              >
                <div className={KEY_VARIANT_ROW_CLASS}>
                  <Text size={14} weight={"medium"} color={"brand"} className={"truncate"}>{keyVariantTitle(definition)}</Text>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"truncate"}>{definition.caption}</Text>
                  <div className={"flex items-center justify-end gap-2"}>
                    {onIdentity > 0 && (
                      <Text size={10} weight={"medium"} color={"brand"} opacity={50} className={"whitespace-nowrap"}>{keysOnIdentityLabel(onIdentity)}</Text>
                    )}
                    {recommended.includes(definition.variant) && <CustomBadge variant={"accent"} text={ADD_KEYS_COPY.recommended} />}
                  </div>
                </div>
              </CheckRow>
            )
          })}
        </div>
      ))}
    </div>
  )
}
