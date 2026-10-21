import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Tabs} from 'dash-ui-kit/react'
import PageHeader from '@renderer/components/ui/PageHeader'
import {CONNECTION_SETTINGS_TABS} from '@renderer/constants/connection'
import {PAGE_HEADERS} from '@renderer/constants/pageHeaders'
import type {ConnectionSettingsTab} from '@renderer/types/connection'
import CoreTab from './CoreTab'
import PlatformTab from './PlatformTab'

export default function ConnectionSettings(): React.JSX.Element {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ConnectionSettingsTab>('core')
  const tabItems = CONNECTION_SETTINGS_TABS.map((tab) => ({
    ...tab,
    content: tab.value === 'core' ? <CoreTab /> : <PlatformTab />,
  }))

  const handleTabChange = (value: string): void => {
    if (value === 'core' || value === 'platform') setActiveTab(value)
  }

  return (
    <div className="w-full px-12 pb-12">
      <PageHeader
        title={PAGE_HEADERS.connectionSettings.title}
        subtitle={PAGE_HEADERS.connectionSettings.subtitle}
        onBack={() => navigate(-1)}
        backLabel={PAGE_HEADERS.connectionSettings.back}
      />

      <section className="overflow-hidden rounded-[1.5rem] dash-card-base p-[.9375rem] shadow-[0_8px_48px_rgba(12,28,51,0.08)]">
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={handleTabChange}
          size="xl"
          triggerClassName={
            'data-[state=active]:text-dash-primary-dark-blue ' +
            'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
            'dark:data-[state=active]:text-white ' +
            'dark:data-[state=inactive]:text-white/35 ' +
            'font-medium'
          }
        />
      </section>
    </div>
  )
}
