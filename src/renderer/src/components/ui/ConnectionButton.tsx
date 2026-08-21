import { useNavigate } from 'react-router-dom'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ConnectionIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useRipple } from '@renderer/hooks/useRipple'
import {CONNECTION_STATUS_DISPLAY} from '@renderer/constants/connection'

export default function ConnectionButton(): React.JSX.Element {
  const navigate = useNavigate()
  const hover = useRipple()
  const { status } = useAuth()
  const display = CONNECTION_STATUS_DISPLAY[status?.connectionStatus ?? 'unavailable']

  return (
    <button
      type="button"
      onClick={() => navigate('/connection-settings')}
      onMouseEnter={hover.onMouseEnter}
      onMouseMove={hover.onMouseMove}
      onMouseLeave={hover.onMouseLeave}
      className={`
        relative overflow-hidden
        flex h-12 items-center gap-2.5 px-4 py-2
        rounded-[.9375rem] dash-block-3 dash-black-border
        cursor-pointer focus:outline-none
        hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5
      `}
      title="Open connection settings"
    >
      <ConnectionIcon
        width={10}
        height={10}
        className={`${display.textColor} shrink-0`}
        style={{ filter: `drop-shadow(0 0 5px ${display.shadowColor})` }}
        aria-hidden="true"
      />
      <span className="flex min-w-0 flex-col items-start">
        <Text size={14} weight="medium" color="brand" className="leading-4">
          Connection
        </Text>
        <Text size={10} weight="medium" className={`leading-[.875rem] ${display.textColor}`}>
          {display.label}
        </Text>
      </span>
    </button>
  )
}
