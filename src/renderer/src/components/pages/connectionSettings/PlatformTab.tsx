import {useState} from 'react'
import {InfoTooltip, Text} from '@renderer/components/dash-ui-kit-enxtended'
import DropdownField from '@renderer/components/ui/DropdownField'
import {
  CONNECTION_SETTINGS_TOOLTIPS,
  PLATFORM_EXPLORER_CONNECTION_NAME,
  PLATFORM_EXPLORER_CONNECTION_OPTIONS,
  PLATFORM_ROW_LABELS,
} from '@renderer/constants/connection'

function SectionTitle({
  label,
  tooltip,
  className = '',
}: {
  label: string
  tooltip: string
  className?: string
}): React.JSX.Element {
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`}>
      <Text as="h2" size={14} weight="medium" color="brand" opacity={50}>
        {label}
      </Text>
      <InfoTooltip content={tooltip} />
    </div>
  )
}

function SwitchControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      className={`
        flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors
        ${checked
          ? 'justify-end bg-dash-brand/30 dark:bg-dash-mint/25'
          : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
      `}
    >
      <span
        className={`
          size-6 rounded-full shadow-sm transition-colors
          ${checked ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}
        `}
      />
    </button>
  )
}

function SettingsRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-h-[3.75rem] items-center justify-between gap-5 rounded-[1.25rem] dash-block px-4 py-3 sm:px-5">
      <Text size={14} weight="medium" color="brand" className="min-w-0">
        {label}
      </Text>
      {children}
    </div>
  )
}

export default function PlatformTab(): React.JSX.Element {
  const [dapiEnabled, setDapiEnabled] = useState(true)
  const [explorerEnabled, setExplorerEnabled] = useState(true)
  const [explorerConnection, setExplorerConnection] = useState(PLATFORM_EXPLORER_CONNECTION_NAME)

  return (
    <div className="px-1 pb-2">
      <SectionTitle label="DAPI Connection" tooltip={CONNECTION_SETTINGS_TOOLTIPS.dapi} />
      <div className="max-w-[24rem]">
        <SettingsRow label={PLATFORM_ROW_LABELS.dapi}>
          <SwitchControl
            checked={dapiEnabled}
            label={PLATFORM_ROW_LABELS.dapi}
            onChange={() => setDapiEnabled((current) => !current)}
          />
        </SettingsRow>
      </div>

      <SectionTitle
        label="Platform Explorer Connection"
        tooltip={CONNECTION_SETTINGS_TOOLTIPS.platformExplorer}
        className="mt-7"
      />
      <div className="grid max-w-[24rem] gap-4">
        <DropdownField
          options={PLATFORM_EXPLORER_CONNECTION_OPTIONS}
          value={explorerConnection}
          onChange={setExplorerConnection}
          ariaLabel="Platform explorer connection"
          triggerClassName="h-[3.75rem] rounded-[1.25rem] border border-dash-primary-dark-blue/25 px-5 dark:border-white/25"
        />
        <SettingsRow label={PLATFORM_ROW_LABELS.explorer}>
          <SwitchControl
            checked={explorerEnabled}
            label={PLATFORM_ROW_LABELS.explorer}
            onChange={() => setExplorerEnabled((current) => !current)}
          />
        </SettingsRow>
      </div>
    </div>
  )
}
