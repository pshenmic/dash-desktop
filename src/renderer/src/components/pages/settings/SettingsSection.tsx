import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import type { SettingsSectionProps } from '@renderer/types/Settings'

export default function SettingsSection({
  title,
  children,
}: SettingsSectionProps): React.JSX.Element {
  return (
    <section className="mt-6 first:mt-0">
      <Text as="h2" reset size={14} weight="medium" color="brand" opacity={50} className="mb-3">
        {title}
      </Text>
      <div className="overflow-hidden rounded-[1.25rem] border border-dash-primary-dark-blue/12 bg-dash-primary-dark-blue/3 dark:border-white/12 dark:bg-white/3">
        {children}
      </div>
    </section>
  )
}
