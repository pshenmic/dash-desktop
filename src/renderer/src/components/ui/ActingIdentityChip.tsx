import { HighlightedIdentifier, Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import {
  ACTING_IDENTITY_CHIP_CLASS,
  ACTING_IDENTITY_CHIP_COPY,
  IDENTITY_SELECT_COMPACT_IDENTIFIER_CLASS,
} from '@renderer/constants/identitySelect'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { ActingIdentityChipProps } from '@renderer/types/ActingIdentityChip'
import { identityLabel, identityName } from '@renderer/utils/identifierFormat'

export default function ActingIdentityChip({ identity }: ActingIdentityChipProps): React.JSX.Element {
  const name = identityName(identity)
  return (
    <Tooltip label={ACTING_IDENTITY_CHIP_COPY.tooltip} side={'bottom'}>
      <div
        role={'img'}
        aria-label={`${ACTING_IDENTITY_CHIP_COPY.actingAs} ${identityLabel(identity)}`}
        className={name == null ? ACTING_IDENTITY_CHIP_CLASS : `${ACTING_IDENTITY_CHIP_CLASS} max-w-48`}
      >
        <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xs} />
        {name == null
          ? <HighlightedIdentifier className={IDENTITY_SELECT_COMPACT_IDENTIFIER_CLASS}>{identity.identifier}</HighlightedIdentifier>
          : <Text reset size={12} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{name}</Text>}
      </div>
    </Tooltip>
  )
}
