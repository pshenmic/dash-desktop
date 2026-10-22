import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AddIcon, Button, Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import { DASHPAY_PARAMS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { KEYS_TAB_COPY, KEYS_TABLE_HEADERS, KEYS_TABLE_INNER_CLASS } from '@renderer/constants/dashPayKeys'
import { IDENTITY_KEY_TABLE_GRID } from '@renderer/constants/identityKeys'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { KeysTabProps } from '@renderer/types/DashPayScreens'
import { sortedIdentityKeys } from '@renderer/utils/dashPayKeySetup'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { withParams } from '@renderer/utils/searchParams'
import EnableDashPayModal from './EnableDashPayModal'
import KeyTableRow from './KeyTableRow'
import ReadinessAlert from './ReadinessAlert'
import SlotMeter from './SlotMeter'

export default function KeysTab({ identity, onSwitchIdentity }: KeysTabProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [enableOpen, setEnableOpen] = useState(false)
  const readiness = useMemo(() => dashPayReadiness(identity), [identity])
  const keys = useMemo(() => sortedIdentityKeys(identity.keys), [identity.keys])
  const noSlots = readiness.slotsLeft === 0

  const openAddKeys = (): void => {
    const state: DashPayNavigationState = { returnTo: location.pathname + location.search }
    navigate(`${DASHPAY_ROUTES.addKeys}?${withParams('', { [DASHPAY_PARAMS.identity]: identity.identifier })}`, { state })
  }

  const addKeysButton = (
    <Button type={"button"} size={"compact"} colorScheme={"lightBlue-mint"} className={"gap-2 normal-case!"} disabled={noSlots} onClick={openAddKeys}>
      <AddIcon size={12} color={"currentColor"} />
      {KEYS_TAB_COPY.addKeys}
    </Button>
  )

  return (
    <div className={"flex flex-col gap-4"}>
      {!readiness.canSend && (
        <ReadinessAlert
          identity={identity}
          readiness={readiness}
          onEnable={() => setEnableOpen(true)}
          onSwitchIdentity={onSwitchIdentity}
        />
      )}
      <SlotMeter
        used={readiness.slotsUsed}
        action={noSlots
          ? <Tooltip label={KEYS_TAB_COPY.noSlots}><span className={"inline-flex"}>{addKeysButton}</span></Tooltip>
          : addKeysButton}
      />
      <div className={SECTION_TABLE_WRAPPER}>
        <div className={KEYS_TABLE_INNER_CLASS}>
          <div className={`${SECTION_TABLE_HEADER} ${IDENTITY_KEY_TABLE_GRID}`}>
            {KEYS_TABLE_HEADERS.map(header => (
              <Text key={header} size={12} weight={"normal"} color={"brand"} opacity={50}>{header}</Text>
            ))}
          </div>
          {keys.map(key => <KeyTableRow key={key.keyId} identityKey={key} />)}
        </div>
      </div>
      <EnableDashPayModal open={enableOpen} onClose={() => setEnableOpen(false)} identity={identity} />
    </div>
  )
}
