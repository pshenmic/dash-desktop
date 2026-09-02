import { useNavigate } from 'react-router-dom'
import { ArrowIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import type { SettingsDetailHeaderProps } from '@renderer/types/Settings'

export default function SettingsDetailHeader({
  primary,
  secondary,
}: SettingsDetailHeaderProps): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <header className="flex items-center gap-[1.125rem] px-12 pt-2">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="flex size-12 items-center justify-center rounded-[.9375rem] dash-block cursor-pointer dash-text-default dash-black-border transition-colors hover:bg-dash-primary-dark-blue/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-brand dark:hover:bg-white/8"
        aria-label="Back to settings"
        title="Back to settings"
      >
        <ArrowIcon size={12} className="dash-text-default" />
      </button>
      <Text as="h1" size={40} weight="medium" color="brand" className="leading-[125%] tracking-[-0.03em]">
        {primary} <span className="opacity-50">{secondary}</span>
      </Text>
    </header>
  )
}
