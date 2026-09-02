import { useNavigate } from 'react-router-dom'
import { Heading, Text } from '@renderer/components/dash-ui-kit-enxtended'
import {
  ChevronIcon,
  ConnectionIcon,
  InfoCircleIcon,
  SettingsIcon,
  ShieldSmallIcon,
  WalletIcon,
} from '@renderer/components/dash-ui-kit-enxtended/icons'
import { SETTINGS_HUB_SECTIONS } from '@renderer/constants/settingsPage'
import type { SettingsHubIconProps } from '@renderer/types/Settings'

function HubIcon({ icon }: SettingsHubIconProps): React.JSX.Element {
  if (icon === 'general') return <WalletIcon size={17} color="currentColor" />
  if (icon === 'preferences') return <SettingsIcon size={17} color="currentColor" />
  if (icon === 'connection') return <ConnectionIcon width={17} height={17} />
  if (icon === 'security') return <ShieldSmallIcon size={16} color="currentColor" />
  return <InfoCircleIcon size={17} color="currentColor" />
}

export default function Settings(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col pb-12">
      <Heading as="h1" size="xl40" weight="medium" color="brand-white" className="px-12 leading-[125%] tracking-[-0.03em]">
        Settings
      </Heading>

      <div className="mt-8 px-12">
        <div className="max-w-[42rem]">
          {SETTINGS_HUB_SECTIONS.map((section, sectionIndex) => (
            <section key={section.label} className={sectionIndex === 0 ? '' : 'mt-6'}>
              <Text as="h2" reset size={14} weight="medium" color="brand" opacity={50} className="mb-3">
                {section.label}
              </Text>
              <div className="overflow-hidden rounded-[.9375rem] border border-dash-primary-dark-blue/12 bg-dash-primary-dark-blue/3 divide-y divide-dash-primary-dark-blue/10 dark:border-white/12 dark:bg-white/3 dark:divide-white/10">
                {section.items.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => navigate(item.to)}
                    className="group flex h-14 w-full cursor-pointer items-center gap-4 px-[.875rem] text-left transition-colors hover:bg-dash-primary-dark-blue/6 focus-visible:bg-dash-primary-dark-blue/6 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dash-brand dark:hover:bg-white/6 dark:focus-visible:bg-white/6"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-dash-primary-dark-blue/5 dash-text-default transition-colors group-hover:bg-dash-brand/12 group-hover:text-dash-brand dark:bg-white/5 dark:group-hover:bg-dash-mint/12 dark:group-hover:text-dash-mint">
                      <HubIcon icon={item.icon} />
                    </span>
                    <Text size={14} weight="medium" color="brand">{item.title}</Text>
                    <ChevronIcon size={16} color="currentColor" className="ml-auto -rotate-90 dash-text-default transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
