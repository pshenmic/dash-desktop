import { useState } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { DemoBadge, DemoCard, DemoEmptyState, DemoModal, DemoNotice } from '../dashpay/shared'
import { MASTERNODE_ROLE_LABELS, MASTERNODE_SOURCE_LABELS } from '@renderer/constants/masternodesDemo'
import type { ConnectedMasternodesProps, DemoMasternode } from '@renderer/types/masternodesDemo'
import { canMasternodeVote } from '@renderer/utils/masternodesDemo'

export default function ConnectedNodes({ nodes, votes, onConnect, onRemove, onVoting }: ConnectedMasternodesProps): React.JSX.Element {
  const [removing, setRemoving] = useState<DemoMasternode | null>(null)
  const [registration, setRegistration] = useState(false)
  const votingCount = nodes.filter(canMasternodeVote).length

  return (
    <>
      <DemoCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Text as="h2" reset size={20} weight="bold" color="brand">Connected nodes</Text>
            <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2 leading-relaxed">Manage the nodes linked to your wallet and their voting access.</Text>
          </div>
          {nodes.length > 0 && <Button size="sm" onClick={onConnect}>Connect nodes</Button>}
        </div>
        {nodes.length === 0 ? (
          <DemoEmptyState
            title="Bring your nodes together"
            description="Discover sample nodes from a wallet, preview Dash Core, or connect a synthetic voting key."
            action={<Button size="sm" onClick={onConnect}>Connect nodes</Button>}
          />
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 dash-block-3">
              <div className="flex flex-wrap items-center gap-3">
                <DemoBadge tone={votingCount ? 'mint' : 'amber'}>{votingCount} of {nodes.length} voting ready</DemoBadge>
                <Text size={12} color="brand" opacity={60}>An available voting key is required to participate.</Text>
              </div>
              <Button size="xs" colorScheme="primary-light" onClick={onVoting}>View name contests</Button>
            </div>
            <div className="mt-2 divide-y divide-dash-primary-dark-blue/8 dark:divide-white/10">
              {nodes.map((node) => {
                const ready = canMasternodeVote(node)
                const voteCount = votes.filter((vote) => vote.nodeId === node.id).length
                return (
                  <article key={node.id} className="py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <Text as="h3" reset size={16} weight="bold" color="brand">{node.label}</Text>
                          <DemoBadge tone={ready ? 'mint' : 'amber'}>{ready ? 'Voting ready' : node.availability === 'offline' ? 'Node unavailable' : 'Voting key missing'}</DemoBadge>
                        </div>
                        <Text as="p" reset size={12} color="brand" opacity={50} className="mt-2">{MASTERNODE_SOURCE_LABELS[node.source]}</Text>
                      </div>
                      <Button size="xs" colorScheme="danger-light" aria-label={`Remove ${node.label}`} onClick={() => setRemoving(node)}>Remove</Button>
                    </div>
                    <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="min-w-0">
                        <dt><Text size={10} color="brand" opacity={50}>Node identifier</Text></dt>
                        <dd className="mt-1 break-all"><Text size={12} color="brand" className="font-mono">{node.proTxHash}</Text></dd>
                      </div>
                      <div>
                        <dt><Text size={10} color="brand" opacity={50}>Service address</Text></dt>
                        <dd className="mt-1"><Text size={12} color="brand" className="font-mono">{node.address}</Text></dd>
                      </div>
                      <div>
                        <dt><Text size={10} color="brand" opacity={50}>Roles</Text></dt>
                        <dd className="mt-1"><Text size={12} color="brand">{node.roles.map((role) => MASTERNODE_ROLE_LABELS[role]).join(' · ')}</Text></dd>
                      </div>
                      <div>
                        <dt><Text size={10} color="brand" opacity={50}>Collateral & activity</Text></dt>
                        <dd className="mt-1"><Text size={12} color="brand">{node.collateralOwned ? 'Owned collateral' : 'Delegated access'} · {voteCount} demo {voteCount === 1 ? 'vote' : 'votes'}</Text></dd>
                      </div>
                    </dl>
                  </article>
                )
              })}
            </div>
          </>
        )}
        <div className="mt-4 border-t border-dash-primary-dark-blue/8 pt-5 dark:border-white/10">
          <DemoNotice tone="neutral">Voting delegation grants voting access. Ownership of collateral and an operator role alone do not provide voting authority.</DemoNotice>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Text size={12} color="brand" opacity={50}>Setting up a new node?</Text>
            <Button size="xs" colorScheme="primary-light" onClick={() => setRegistration(true)}>About registration</Button>
          </div>
        </div>
      </DemoCard>
      {removing && (
        <DemoModal title={`Remove ${removing.label}?`} description="Disconnect this sample node from this demo session." onClose={() => setRemoving(null)}>
          <DemoNotice>Removing a node does not revoke its voting key or change its collateral. Its recorded demo votes remain visible if you reconnect it.</DemoNotice>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button size="xs" colorScheme="primary-light" onClick={() => setRemoving(null)}>Keep node</Button>
            <Button size="sm" colorScheme="red" onClick={() => { onRemove(removing.id); setRemoving(null) }}>Remove node</Button>
          </div>
        </DemoModal>
      )}
      {registration && (
        <DemoModal title="Register a new masternode" description="A future setup flow, outside this preview." onClose={() => setRegistration(false)}>
          <Text as="p" reset size={14} color="brand" opacity={60} className="leading-relaxed">New masternode registration will guide you through collateral, node configuration, operator and voting roles, and transaction review. This demo explores connecting existing nodes and name voting.</Text>
          <div className="mt-6 flex justify-end"><Button size="sm" onClick={() => setRegistration(false)}>Got it</Button></div>
        </DemoModal>
      )}
    </>
  )
}
