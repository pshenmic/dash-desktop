import type { IdentityAvatarSize } from '../enums/IdentityAvatarSize'

export interface IdentityAvatarProps {
  identifier: string
  size: IdentityAvatarSize
}

export interface IdentityAvatarSizeClasses {
  circle: string
  avatar: string
}
