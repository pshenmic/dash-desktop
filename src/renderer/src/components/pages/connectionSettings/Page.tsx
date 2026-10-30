import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import {CONNECTION_SETTINGS_TABS} from '@renderer/constants/connection'
import {PAGE_HEADERS} from '@renderer/constants/pageHeaders'
import {SURFACE_PANEL} from '@renderer/constants/surfaces'
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

      <section className={`overflow-hidden ${SURFACE_PANEL}`}>
        <PageTabs
          items={tabItems}
          value={activeTab}
          onValueChange={handleTabChange}
        />
      </section>
    </div>
  )
}
