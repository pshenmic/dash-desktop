import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { DemoBadge } from '../dashpay/shared'
import ConnectedNodes from './ConnectedNodes'
import ImportNodes from './ImportNodes'
import NameVoting from './NameVoting'
import type { DemoMasternode, DemoNodeVote, MasternodesTab } from '@renderer/types/masternodesDemo'
import { mergeDemoMasternodes } from '@renderer/utils/masternodesDemo'
import { DEMO_TABS_TRIGGER_CLASS } from '@renderer/constants/dashpayDemo'

export default function Masternodes(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const [nodes, setNodes] = useState<DemoMasternode[]>([])
  const [votes, setVotes] = useState<DemoNodeVote[]>([])
  const [connecting, setConnecting] = useState(false)
  const tab: MasternodesTab = params.get('tab') === 'voting' ? 'voting' : 'nodes'

  function selectTab(next: string): void {
    if (next !== 'nodes' && next !== 'voting') return
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set('tab', next)
      return updated
    }, { replace: true })
  }

  const tabItems = [
    {
      value: 'nodes',
      label: `Connected nodes (${nodes.length})`,
      content: (
        <ConnectedNodes
          nodes={nodes}
          votes={votes}
          onConnect={() => setConnecting(true)}
          onRemove={(id) => setNodes((current) => current.filter((node) => node.id !== id))}
          onVoting={() => selectTab('voting')}
        />
      ),
    },
    {
      value: 'voting',
      label: 'Name voting',
      content: <NameVoting nodes={nodes} votes={votes} onVotes={setVotes} onConnect={() => setConnecting(true)} />,
    },
  ]

  return (
    <div className="w-full space-y-8 px-12 pb-12 dash-text-default">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Text as="h1" reset size={40} weight="medium" color="brand" className="leading-[125%] tracking-[-0.03em]">Masternodes</Text>
          <Text as="p" reset size={12} weight="medium" color="brand" opacity={50} className="max-w-xl leading-relaxed">Connect your nodes and take part in DPNS name decisions.</Text>
        </div>
        <DemoBadge tone="amber">Demo · No transactions sent</DemoBadge>
      </div>
      <section className="relative min-w-0 rounded-3xl dash-card-base p-[.9375rem] shadow-[8px_0_64px_0_rgba(12,28,51,0.08)]">
        <Tabs
          items={tabItems}
          value={tab}
          onValueChange={selectTab}
          size="xl"
          triggerClassName={DEMO_TABS_TRIGGER_CLASS}
        />
      </section>
      <Text as="p" reset size={12} color="brand" opacity={40} className="text-center">Sample data for this visit · Nothing is saved</Text>
      {connecting && (
        <ImportNodes
          connectedIds={nodes.map((node) => node.id)}
          onClose={() => setConnecting(false)}
          onImport={(incoming) => {
            setNodes((current) => mergeDemoMasternodes(current, incoming))
            setConnecting(false)
          }}
        />
      )}
    </div>
  )
}
