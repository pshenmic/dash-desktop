import type { Ref } from 'react'

export interface ShowMoreButtonProps {
  remaining: number
  onClick: () => void
  ref?: Ref<HTMLButtonElement>
}
