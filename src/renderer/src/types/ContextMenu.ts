import type { MouseEventHandler, ReactElement, ReactNode } from 'react'

export interface ContextMenuTriggerProps {
  onContextMenu?: MouseEventHandler<HTMLElement>
  'aria-haspopup'?: 'menu'
}

export interface ContextMenuItem {
  id: string
  label: string
  icon?: ReactNode
  onSelect?: () => void
  tone?: 'default' | 'danger'
}

export interface ContextMenuProps {
  title: string
  items: ContextMenuItem[]
  children: ReactElement<ContextMenuTriggerProps>
  className?: string
}
