import { useTheme } from 'dash-ui-kit/react'
import { AUTH_BACKGROUNDS } from '@renderer/constants/authBackground'
import type { AuthBackgroundProps } from '@renderer/types/auth'

export default function AuthBackground({ variant }: AuthBackgroundProps): React.JSX.Element {
  const { theme } = useTheme()
  const background = AUTH_BACKGROUNDS[variant]

  return (
    <div aria-hidden="true" className="dash-auth-background">
      <img src={background[theme === 'dark' ? 'dark' : 'light']} alt="" className="dash-bg-image-auth" />
      <svg className={`absolute inset-0 size-full overflow-visible ${variant === 'welcome' ? 'translate-y-16' : ''}`} viewBox={background.viewBox} preserveAspectRatio="xMidYMax slice">
        <image href={background.artwork} width={2048} height={background.height} />
      </svg>
    </div>
  )
}
