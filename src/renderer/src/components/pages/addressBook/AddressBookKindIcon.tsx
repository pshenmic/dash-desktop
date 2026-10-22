import { DashLogo } from 'dash-ui-kit/react'
import { CreditsIcon, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import { IDENTITY_AVATAR_CIRCLE, IDENTITY_AVATAR_SIZES } from '@renderer/constants/identityAvatar'
import { DestinationKind } from '@renderer/enums/DestinationKind'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import type { AddressBookKindIconProps } from '@renderer/types/AddressBook'

export default function AddressBookKindIcon({ kind, address }: AddressBookKindIconProps): React.JSX.Element {
  if (kind === DestinationKind.Identity) return <IdentityAvatar identifier={address} size={IdentityAvatarSize.Sm} />

  let icon: React.JSX.Element
  if (kind === DestinationKind.CoreAddress) icon = <DashLogo size={14} containerClassName={'w-fit shrink-0'} />
  else if (kind === DestinationKind.PlatformAddress) icon = <CreditsIcon size={14} />
  else if (kind === DestinationKind.Shielded) icon = <ShieldSmallIcon size={14} className={'text-dash-brand dark:text-dash-mint'} />
  else icon = <ExclamationIcon size={14} color={'currentColor'} className={'text-dash-red'} />

  return (
    <span aria-hidden={'true'} className={`${IDENTITY_AVATAR_CIRCLE} ${IDENTITY_AVATAR_SIZES[IdentityAvatarSize.Sm].circle}`}>
      {icon}
    </span>
  )
}
