import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {Tabs} from 'dash-ui-kit/react'
import {ArrowIcon} from '@renderer/components/dash-ui-kit-enxtended/icons'
import {Text} from '@renderer/components/dash-ui-kit-enxtended'
import CoreTab from './CoreTab'

export default function ConnectionSettings(): React.JSX.Element {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('core')
  const tabItems = [
    {
      value: 'core',
      label: 'Core',
      content: <CoreTab />,
    },
    {
      value: 'platform',
      label: 'Platform',
      content: (
        <div className="flex min-h-[26rem] items-center justify-center px-6 pb-8">
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <Text size={18} weight="medium" color="brand">Platform connection settings</Text>
            <Text size={14} weight="medium" color="brand" opacity={40}>
              Platform connection options are coming soon.
            </Text>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="w-full px-12 pb-12">
      <div className="mb-8">
        <div className="mb-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`
              flex size-9 items-center justify-center rounded-[.625rem]
              dash-block cursor-pointer dash-text-default
              hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/8
            `}
            title="Go back"
          >
            <ArrowIcon size={11} className="dash-text-default" />
          </button>
          <Text as="h1" size={32} weight="medium" color="brand" className="tracking-[-0.03em]">
            Connection Settings
          </Text>
        </div>
        <Text as="p" size={14} weight="medium" color="brand" opacity={50} className="max-w-[65rem] leading-[1.35]">
          Choose how wallet data is synchronized. P2P keeps synchronization local, while RPC uses Dashscan and is available immediately.
        </Text>
      </div>

      <section className="overflow-hidden rounded-[1.5rem] dash-card-base p-[.9375rem] shadow-[0_8px_48px_rgba(12,28,51,0.08)]">
        <Tabs
          items={tabItems}
          value={activeTab}
          onValueChange={setActiveTab}
          size="xl"
          triggerClassName={
            'data-[state=active]:text-dash-primary-dark-blue ' +
            'data-[state=inactive]:text-dash-primary-dark-blue/35 ' +
            'dark:data-[state=active]:text-white ' +
            'dark:data-[state=inactive]:text-white/35 ' +
            'font-medium tracking-[-0.03em]'
          }
        />
      </section>
    </div>
  )
}
