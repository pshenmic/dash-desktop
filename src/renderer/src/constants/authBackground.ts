import stack from '@renderer/assets/images/pageAuthorization/waveAuth.png'
import flower from '@renderer/assets/images/pageAuthorization/auth-bg-flower.png'
import wave from '@renderer/assets/images/pageAuthorization/wave.png'
import createLight from '@renderer/assets/images/pageAuthorization/Frame 717779 (1).png'
import createDark from '@renderer/assets/images/pageAuthorization/Frame 717781 (1).png'
import loginLight from '@renderer/assets/images/pageAuthorization/bg-light.svg'
import loginDark from '@renderer/assets/images/pageAuthorization/bg-dark.svg'

export const AUTH_BACKGROUNDS = {
  welcome: { artwork: flower, height: 1238, viewBox: '0 0 2048 860', light: createLight, dark: createDark },
  create: { artwork: stack, height: 720, viewBox: '0 0 2048 553', light: createLight, dark: createDark },
  login: { artwork: wave, height: 1536, viewBox: '0 0 2048 600', light: loginLight, dark: loginDark },
} as const
