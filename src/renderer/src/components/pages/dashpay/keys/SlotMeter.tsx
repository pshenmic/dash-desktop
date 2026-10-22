import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { SLOT_METER_TRACK_WRAPPER_CLASS } from '@renderer/constants/dashPayKeys'
import { PROGRESS_FILL, PROGRESS_TRACK } from '@renderer/constants/progressBar'
import type { SlotMeterProps } from '@renderer/types/DashPayKeys'
import { keySlotPercent, keySlotsLeftAfterLabel, keySlotsUsedLabel } from '@renderer/utils/dashPayKeySetup'

export default function SlotMeter({ used, leftAfter, action }: SlotMeterProps): React.JSX.Element {
  return (
    <div className={"flex items-center gap-3"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"whitespace-nowrap"}>
        {keySlotsUsedLabel(used)}
      </Text>
      <div className={SLOT_METER_TRACK_WRAPPER_CLASS}>
        <div className={PROGRESS_TRACK}>
          <div className={PROGRESS_FILL} style={{ width: `${keySlotPercent(used)}%` }} />
        </div>
      </div>
      {leftAfter !== undefined && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"whitespace-nowrap"}>
          {keySlotsLeftAfterLabel(leftAfter)}
        </Text>
      )}
      {action && <div className={"ml-auto shrink-0"}>{action}</div>}
    </div>
  )
}
