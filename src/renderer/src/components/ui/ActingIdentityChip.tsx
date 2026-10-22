import { Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import { ACTING_IDENTITY_CHIP_CLASS, ACTING_IDENTITY_CHIP_COPY } from '@renderer/constants/identitySelect'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { ActingIdentityChipProps } from '@renderer/types/ActingIdentityChip'
import { identityLabel } from '@renderer/utils/identifierFormat'

export default function ActingIdentityChip({ identity }: ActingIdentityChipProps): React.JSX.Element {
  const name = identityLabel(identity)
  return (
    <Tooltip label={ACTING_IDENTITY_CHIP_COPY.tooltip} side={'bottom'}>
      <div role={'img'} aria-label={`${ACTING_IDENTITY_CHIP_COPY.actingAs} ${name}`} className={ACTING_IDENTITY_CHIP_CLASS}>
        <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xs} />
        <Text reset size={12} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{name}</Text>
      </div>
    </Tooltip>
  )
}
