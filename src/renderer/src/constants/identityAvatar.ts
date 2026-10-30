import { IdentityAvatarSize } from '../enums/IdentityAvatarSize'
import type { IdentityAvatarSizeClasses } from '../types/IdentityAvatar'

export const IDENTITY_AVATAR_SIZES: Record<IdentityAvatarSize, IdentityAvatarSizeClasses> = {
  [IdentityAvatarSize.Xs]: { circle: 'size-7', avatar: 'size-5' },
  [IdentityAvatarSize.Sm]: { circle: 'size-8', avatar: 'size-6' },
  [IdentityAvatarSize.Md]: { circle: 'size-10', avatar: 'size-7' },
  [IdentityAvatarSize.Lg]: { circle: 'size-12', avatar: 'size-8' },
  [IdentityAvatarSize.Xl]: { circle: 'size-16', avatar: 'size-11' },
}
