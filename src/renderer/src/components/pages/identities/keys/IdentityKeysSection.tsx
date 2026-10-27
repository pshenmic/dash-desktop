import { useMemo } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import NoResults from '@renderer/components/ui/NoResults'
import { IDENTITY_KEY_TABLE_GRID, IDENTITY_KEYS_COPY, KEYS_TABLE_HEADERS, KEYS_TABLE_INNER_CLASS } from '@renderer/constants/identityKeys'
import { SECTION_TABLE_HEADER, SECTION_TABLE_WRAPPER } from '@renderer/constants/sectionTable'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import type { IdentityKeysSectionProps } from '@renderer/types/IdentityKeys'
import { sortedIdentityKeys } from '@renderer/utils/identityKeySetup'
import KeyTableRow from './KeyTableRow'

export default function IdentityKeysSection({ identity }: IdentityKeysSectionProps): React.JSX.Element {
  const keys = useMemo(() => sortedIdentityKeys(identity.keys), [identity.keys])

  return (
    <section className={`flex flex-col gap-5 ${SURFACE_PANEL}`}>
      <div className={'flex items-center gap-2 px-1'}>
        <DashboardHeading as={'h2'}>{IDENTITY_KEYS_COPY.title}</DashboardHeading>
        <CustomBadge variant={'muted'} text={String(keys.length)} />
      </div>
      {keys.length === 0 ? (
        <NoResults noResults={IDENTITY_KEYS_COPY.empty} />
      ) : (
        <div className={SECTION_TABLE_WRAPPER}>
          <div className={KEYS_TABLE_INNER_CLASS}>
            <div className={`${SECTION_TABLE_HEADER} ${IDENTITY_KEY_TABLE_GRID}`}>
              {KEYS_TABLE_HEADERS.map(header => (
                <Text key={header} size={12} weight={'normal'} color={'brand'} opacity={50}>{header}</Text>
              ))}
            </div>
            {keys.map(key => <KeyTableRow key={key.keyId} identityKey={key} />)}
          </div>
        </div>
      )}
    </section>
  )
}
