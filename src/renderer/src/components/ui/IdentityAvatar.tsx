import { Avatar } from 'dash-ui-kit/react'
import { IDENTITY_AVATAR_SIZES } from '@renderer/constants/identityAvatar'
import type { IdentityAvatarProps } from '@renderer/types/IdentityAvatar'

export default function IdentityAvatar({ identifier, size }: IdentityAvatarProps): React.JSX.Element {
  const classes = IDENTITY_AVATAR_SIZES[size]
  return (
    <span aria-hidden={'true'} className={`flex shrink-0 items-center justify-center rounded-full dash-subtle ${classes.circle}`}>
      <Avatar username={identifier} className={classes.avatar} />
    </span>
  )
}
