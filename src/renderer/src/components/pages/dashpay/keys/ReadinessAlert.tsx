import { useLocation, useNavigate } from 'react-router-dom'
import { Button, InfoCircleIcon, KeyIcon } from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import { DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { READINESS_ALERT_COPY } from '@renderer/constants/dashPayKeys'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { DashPayReadiness } from '@renderer/enums/DashPay'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { ReadinessAlertProps } from '@renderer/types/DashPayKeys'
import { dashPayHref } from '@renderer/utils/dashPayIdentity'

export default function ReadinessAlert({ identity, readiness, onEnable }: ReadinessAlertProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const location = useLocation()

  if (readiness.readiness === DashPayReadiness.NeedsKeys) {
    return (
      <Alert
        tone={AlertTone.Warning}
        icon={<KeyIcon size={16} color={"currentColor"} />}
        title={READINESS_ALERT_COPY.needsKeysTitle}
        description={READINESS_ALERT_COPY.needsKeysDescription}
        actions={
          <Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={onEnable}>
            {READINESS_ALERT_COPY.enable}
          </Button>
        }
      />
    )
  }

  if (readiness.readiness === DashPayReadiness.NoUsername) {
    const registerHref = dashPayHref(DASHPAY_ROUTES.registerUsername, identity.identifier)
    const navigationState: DashPayNavigationState = { returnTo: location.pathname + location.search }
    return (
      <Alert
        tone={AlertTone.Info}
        icon={<InfoCircleIcon size={16} color={"currentColor"} />}
        title={READINESS_ALERT_COPY.noUsernameTitle}
        description={READINESS_ALERT_COPY.noUsernameDescription}
        actions={
          <button type={"button"} className={CHIP_ACTION} onClick={() => navigate(registerHref, { state: navigationState })}>
            {READINESS_ALERT_COPY.register}
          </button>
        }
      />
    )
  }

  return null
}
