import { useMemo, useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import NoResults from '@renderer/components/ui/NoResults'
import { IDENTITY_KEY_TABLE_GRID, IDENTITY_KEYS_COPY, KEYS_TABLE_HEADERS } from '@renderer/constants/identityKeys'
import { CHIP_ACTION, SURFACE_PANEL, SURFACE_SECTION } from '@renderer/constants/surfaces'
import type { IdentityKeysSectionProps, PendingKeyAction } from '@renderer/types/IdentityKeys'
import { sortedIdentityKeys } from '@renderer/utils/identityKeySetup'
import KeyTableRow from './KeyTableRow'
import PrivateKeysModal from './PrivateKeysModal'
import UpdateKeyModal from './UpdateKeyModal'

export default function IdentityKeysSection({ walletId, identity }: IdentityKeysSectionProps): React.JSX.Element {
  const keys = useMemo(() => sortedIdentityKeys(identity.keys), [identity.keys])
  const [pending, setPending] = useState<PendingKeyAction | null>(null)
  const [privateKeysOpen, setPrivateKeysOpen] = useState(false)

  return (
    <section className={`flex flex-col gap-5 ${SURFACE_PANEL}`}>
      <div className={'flex items-center gap-2 px-1'}>
        <DashboardHeading as={'h2'}>{IDENTITY_KEYS_COPY.title}</DashboardHeading>
        <CustomBadge variant={'muted'} text={String(keys.length)} />
        {keys.length > 0 && (
          <button type={'button'} className={`ml-auto ${CHIP_ACTION}`} onClick={() => setPrivateKeysOpen(true)}>
            {IDENTITY_KEYS_COPY.privateKeys}
          </button>
        )}
      </div>
      {keys.length === 0 ? (
        <NoResults noResults={IDENTITY_KEYS_COPY.empty} />
      ) : (
        <div className={`overflow-x-auto ${SURFACE_SECTION}`}>
          <div className={'min-w-[46rem]'}>
            <div className={`grid items-center gap-3 px-2.5 pb-3 ${IDENTITY_KEY_TABLE_GRID}`}>
              {KEYS_TABLE_HEADERS.map(header => (
                <Text key={header} size={12} weight={'normal'} color={'brand'} opacity={50}>{header}</Text>
              ))}
            </div>
            {keys.map(key => <KeyTableRow key={key.keyId} identityKey={key} onAction={(identityKey, action) => setPending({ identityKey, action })} />)}
          </div>
        </div>
      )}
      <UpdateKeyModal walletId={walletId} identity={identity} pending={pending} onClose={() => setPending(null)} />
      <PrivateKeysModal open={privateKeysOpen} onClose={() => setPrivateKeysOpen(false)} walletId={walletId} identity={identity} />
    </section>
  )
}
