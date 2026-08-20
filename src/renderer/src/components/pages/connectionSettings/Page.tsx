import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowIcon, PlusIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useConnectionModeContext } from '@renderer/contexts/ConnectionModeContext'
import { CONNECTION_SETTINGS_TABS, RPC_CONNECTION_NAME } from '@renderer/constants/connection'

export default function ConnectionSettings(): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const { desired, ready, setDesired } = useConnectionModeContext()
  const [activeTab, setActiveTab] = useState('core')
  const sync = status?.walletSync

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

      <section className="overflow-hidden rounded-[1.5rem] dash-card-base shadow-[0_8px_48px_rgba(12,28,51,0.08)]">
        <div className="px-6 pt-5">
          <div className="flex gap-7 border-b border-dash-primary-dark-blue/15 dark:border-white/15">
            {CONNECTION_SETTINGS_TABS.map((tab) => {
              const active = activeTab === tab.value
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`
                    relative pb-3 text-[1.5rem] font-medium tracking-[-0.03em]
                    cursor-pointer transition-colors
                    ${active
                      ? 'text-dash-primary-dark-blue dark:text-white'
                      : 'text-dash-primary-dark-blue/40 dark:text-white/40'}
                  `}
                >
                  {tab.label}
                  {active && <span className="absolute inset-x-0 -bottom-px h-px bg-dash-brand dark:bg-dash-mint" />}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'core' ? (
          <div className="px-6 pb-7 pt-6">
            <Text as="h2" size={14} weight="medium" color="brand" opacity={50} className="mb-4">
              Connection Mode
            </Text>

            <div className="grid grid-cols-2 gap-5">
              <div className="flex min-h-16 items-center justify-between rounded-[1.25rem] dash-block px-5 py-3">
                <Text size={14} weight="medium" color="brand">Enable P2P Mode</Text>
                <button
                  type="button"
                  role="switch"
                  aria-checked={desired === 'p2p'}
                  disabled={!ready}
                  onClick={() => desired !== 'p2p' && setDesired('p2p')}
                  className={`
                    flex h-7 w-14 items-center rounded-full p-0.5 transition-colors
                    disabled:cursor-wait disabled:opacity-50
                    ${desired === 'p2p'
                      ? 'justify-end bg-dash-brand/35 dark:bg-dash-mint/25'
                      : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
                  `}
                >
                  <span className={`size-6 rounded-full shadow-sm ${desired === 'p2p' ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}`} />
                </button>
              </div>

              <div className="flex min-h-16 items-center justify-between rounded-[1.25rem] dash-block px-5 py-3">
                <Text size={14} weight="medium" color="brand">Enable RPC Mode</Text>
                <button
                  type="button"
                  role="switch"
                  aria-checked={desired === 'rpc'}
                  disabled={!ready}
                  onClick={() => desired !== 'rpc' && setDesired('rpc')}
                  className={`
                    flex h-7 w-14 items-center rounded-full p-0.5 transition-colors
                    disabled:cursor-wait disabled:opacity-50
                    ${desired === 'rpc'
                      ? 'justify-end bg-dash-brand/35 dark:bg-dash-mint/25'
                      : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
                  `}
                >
                  <span className={`size-6 rounded-full shadow-sm ${desired === 'rpc' ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}`} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-5">
              <div>
                <Text as="h2" size={14} weight="medium" color="brand" opacity={50} className="mb-3">
                  RPC Connection
                </Text>
                <div
                  className={`
                    flex h-16 w-full items-center rounded-[1.25rem]
                    border border-dash-primary-dark-blue/25 dark:border-white/25
                    px-5
                  `}
                >
                  <Text size={14} weight="medium" color="brand">{RPC_CONNECTION_NAME}</Text>
                </div>
              </div>

              <div>
                <Text as="h2" size={14} weight="medium" color="brand" opacity={50} className="mb-3">
                  Peer Settings
                </Text>
                <div className="flex h-16 items-center justify-between rounded-[1.25rem] dash-block px-5">
                  <div className="flex flex-col">
                    <Text size={14} weight="medium" color="brand">Use Static Peers</Text>
                    <Text size={10} weight="medium" color="brand" opacity={40}>Coming in a later iteration</Text>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked="false"
                    disabled
                    className="flex h-7 w-14 cursor-not-allowed items-center justify-start rounded-full bg-dash-primary-dark-blue/15 p-0.5 opacity-60 dark:bg-white/15"
                  >
                    <span className="size-6 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Text size={14} weight="medium" color="brand" opacity={50}>Peers List</Text>
                  <span className="rounded-full dash-block px-3 py-1 text-xs font-medium dash-text-default">
                    Active {sync?.peerCount ?? 0}
                  </span>
                  <Text size={12} weight="medium" color="brand" opacity={30}>Banned</Text>
                  <Text size={12} weight="medium" color="brand" opacity={30}>Static</Text>
                </div>
                <button
                  type="button"
                  disabled
                  className="flex cursor-not-allowed items-center gap-2 rounded-[.625rem] dash-block-accent-10 px-3 py-2 opacity-60 text-dash-brand dark:text-dash-mint"
                >
                  <PlusIcon size={12} className="text-current" />
                  <Text size={12} weight="medium" className="text-current!">Add Peer</Text>
                </button>
              </div>

              <div className="overflow-hidden rounded-[1.25rem] dash-block">
                <div className="grid grid-cols-[1.2fr_.7fr_1.5fr] gap-4 border-b border-dash-primary-dark-blue/10 px-5 py-3 dark:border-white/10">
                  <Text size={12} weight="medium" color="brand" opacity={40}>Pool</Text>
                  <Text size={12} weight="medium" color="brand" opacity={40}>Connected</Text>
                  <Text size={12} weight="medium" color="brand" opacity={40}>Details</Text>
                </div>
                <div className="grid grid-cols-[1.2fr_.7fr_1.5fr] gap-4 border-b border-dash-primary-dark-blue/10 px-5 py-4 dark:border-white/10">
                  <Text size={14} weight="medium" color="brand">Wallet synchronization</Text>
                  <Text size={14} weight="medium" color="brand">{sync?.peerCount ?? 0}</Text>
                  <Text size={14} weight="medium" color="brand" opacity={50}>
                    {sync?.filterCapablePeerCount ?? 0} filter-capable
                  </Text>
                </div>
                <div className="grid grid-cols-[1.2fr_.7fr_1.5fr] gap-4 px-5 py-4">
                  <Text size={14} weight="medium" color="brand">InstantSend and ChainLocks</Text>
                  <Text size={14} weight="medium" color="brand">{sync?.lockPeerCount ?? 0}</Text>
                  <Text size={14} weight="medium" color="brand" opacity={50}>Always connected</Text>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[26rem] items-center justify-center px-6 pb-8">
            <div className="flex max-w-md flex-col items-center gap-2 text-center">
              <Text size={18} weight="medium" color="brand">Platform connection settings</Text>
              <Text size={14} weight="medium" color="brand" opacity={40}>
                Platform connection options are coming soon.
              </Text>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
