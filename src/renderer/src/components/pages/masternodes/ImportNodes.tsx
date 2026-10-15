import { useState } from 'react'
import { Button, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import Checkbox from '@renderer/components/ui/Checkbox'
import DropdownField from '@renderer/components/ui/DropdownField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { DemoBadge, DemoModal, DemoNotice } from '../dashpay/shared'
import { MASTERNODE_CORE_PREVIEWS, MASTERNODE_DEMO_FIXTURES, MASTERNODE_IMPORT_SOURCES, MASTERNODE_MASKED_SAMPLE, MASTERNODE_ROLE_LABELS } from '@renderer/constants/masternodesDemo'
import type { MasternodeImportPreview, MasternodeImportProps, MasternodeSource } from '@renderer/types/masternodesDemo'
import { canMasternodeVote } from '@renderer/utils/masternodesDemo'

export default function ImportNodes({ connectedIds, onClose, onImport }: MasternodeImportProps): React.JSX.Element {
  const [source, setSource] = useState<MasternodeSource>('wallet')
  const [preview, setPreview] = useState<MasternodeImportPreview>('success')
  const [discovered, setDiscovered] = useState(false)
  const [sampleLoaded, setSampleLoaded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const candidates = MASTERNODE_DEMO_FIXTURES.filter((node) => node.source === source)
  const available = candidates.filter((node) => !connectedIds.includes(node.id))

  function chooseSource(next: MasternodeSource): void {
    setSource(next)
    setDiscovered(false)
    setSelected([])
    setSampleLoaded(false)
  }

  function discover(): void {
    setDiscovered(true)
    setSelected(available.map((node) => node.id))
  }

  return (
    <DemoModal title="Connect masternodes" description="Choose how to find your nodes. Every option uses sample data." onClose={onClose} wide>
      <SegmentedControl options={MASTERNODE_IMPORT_SOURCES} value={source} onChange={chooseSource} className="flex-wrap" />
      <Text as="p" reset size={12} color="brand" opacity={50} className="mt-3 leading-relaxed">{MASTERNODE_IMPORT_SOURCES.find((item) => item.value === source)?.detail}</Text>

      <div className="mt-5 space-y-4">
        {source === 'wallet' && <DemoNotice>Discover owner and voting roles from a sample wallet. No DashPay username or personal identity is needed.</DemoNotice>}
        {source === 'core' && (
          <>
            <Text as="p" reset size={14} weight="medium" color="brand">Connection preview</Text>
            <DropdownField ariaLabel="Connection preview" options={MASTERNODE_CORE_PREVIEWS} value={preview} onChange={(value) => { setPreview(value as MasternodeImportPreview); setDiscovered(false) }} triggerClassName="dash-block rounded-[.875rem] px-4 py-3.5" />
            <Text as="p" reset size={12} color="brand" opacity={50} className="leading-relaxed">This preview never connects to Core and does not ask for RPC credentials.</Text>
          </>
        )}
        {source === 'manual' && (
          <>
            <label htmlFor="sample-voting-key"><Text size={14} weight="medium" color="brand">Synthetic voting key</Text></label>
            <div className="flex flex-wrap gap-2">
              <Input id="sample-voting-key" readOnly value={sampleLoaded ? MASTERNODE_MASKED_SAMPLE : ''} placeholder="Load a demo sample" size="md" colorScheme="primary" variant="outlined" className="min-w-0 flex-1" />
              <Button colorScheme="primary-light" size="xs" onClick={() => { setSampleLoaded(true); setDiscovered(false) }}>Load sample</Button>
            </div>
            <Text as="p" reset size={12} color="brand" opacity={50} className="leading-relaxed">Sample only. Real private keys cannot be entered here. A voting key grants voting authority, not collateral ownership.</Text>
          </>
        )}
        {!discovered && <Button size="sm" onClick={discover} disabled={source === 'manual' && !sampleLoaded}>{source === 'wallet' ? 'Discover sample nodes' : source === 'core' ? 'Preview connection' : 'Find sample nodes'}</Button>}

        {discovered && source === 'core' && preview !== 'success' ? (
          <DemoNotice tone="amber">{preview === 'locked' ? 'Core wallet is locked in this preview. Choose the connected preview to make voting keys available.' : 'Core is unavailable in this preview. Choose the connected preview or try wallet discovery.'}</DemoNotice>
        ) : discovered && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2"><Text as="h3" reset size={14} weight="bold" color="brand">{candidates.length} sample nodes found</Text><DemoBadge tone="blue">Preview</DemoBadge></div>
            {candidates.map((node) => {
              const connected = connectedIds.includes(node.id)
              return (
                <Checkbox key={node.id} className={`items-start! gap-3! rounded-2xl border border-dash-primary-dark-blue/10 p-4 dark:border-white/10 ${connected ? 'cursor-default! opacity-50' : ''}`}
                  disabled={connected} checked={connected || selected.includes(node.id)} onChange={(checked) => setSelected((current) => checked ? [...current, node.id] : current.filter((id) => id !== node.id))}
                  label={<><span className="min-w-0 flex-1"><Text as="span" reset size={14} weight="bold" color="brand" className="block">{node.label}</Text><Text as="span" reset size={12} color="brand" opacity={50} className="mt-1 block break-all font-mono">{node.proTxHash}</Text><Text as="span" reset size={12} color="brand" opacity={60} className="mt-2 block">{node.roles.map((role) => MASTERNODE_ROLE_LABELS[role]).join(' · ')}</Text></span>
                  <DemoBadge tone={connected ? 'neutral' : canMasternodeVote(node) ? 'mint' : 'amber'}>{connected ? 'Connected' : canMasternodeVote(node) ? 'Can vote' : 'Key unavailable'}</DemoBadge>
                  </>} />
              )
            })}
            {source === 'core' && <DemoNotice tone="amber">Orbit includes a simulated first-vote timeout so you can explore partial results and retry.</DemoNotice>}
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-dash-primary-dark-blue/8 pt-5 dark:border-white/10">
        <Button size="xs" colorScheme="primary-light" onClick={onClose}>Cancel</Button>
        {discovered && (source !== 'core' || preview === 'success') && (
          <Button size="sm" disabled={selected.length === 0} onClick={() => onImport(candidates.filter((node) => selected.includes(node.id)))}>Connect {selected.length > 0 ? selected.length : ''} sample {selected.length === 1 ? 'node' : 'nodes'}</Button>
        )}
      </div>
    </DemoModal>
  )
}
