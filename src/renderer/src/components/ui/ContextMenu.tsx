import {cloneElement, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {CloseIcon, Text} from '@renderer/components/dash-ui-kit-extended'
import {POPOVER, POPOVER_OPTION} from '@renderer/constants/surfaces'
import type {
  ContextMenuProps,
  ContextMenuTriggerProps,
} from '@renderer/types/ContextMenu'

export function ContextMenu({
  title,
  items,
  children,
  className = '',
}: ContextMenuProps): React.JSX.Element {
  const [position, setPosition] = useState<{x: number; y: number} | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const childProps = children.props

  const close = (): void => setPosition(null)

  useLayoutEffect(() => {
    if (!position || !menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const x = Math.max(8, Math.min(position.x, window.innerWidth - rect.width - 8))
    const y = Math.max(8, Math.min(position.y, window.innerHeight - rect.height - 8))
    if (x !== position.x || y !== position.y) setPosition({x, y})
  }, [position])

  useEffect(() => {
    if (!position) return

    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) close()
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      close()
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [position])

  const trigger = cloneElement(children, {
    'aria-haspopup': 'menu',
    onContextMenu: (event) => {
      childProps.onContextMenu?.(event)
      if (event.defaultPrevented) return

      event.preventDefault()
      triggerRef.current = event.currentTarget
      const rect = event.currentTarget.getBoundingClientRect()
      setPosition({
        x: event.clientX || rect.left + 12,
        y: event.clientY || rect.top + 12,
      })
    },
  } satisfies ContextMenuTriggerProps)

  return (
    <>
      {trigger}
      {position && createPortal(
        <div
          ref={menuRef}
          style={{left: position.x, top: position.y}}
          className={`fixed z-[1000] w-[10.25rem] ${POPOVER} ${className}`}
        >
          <div className="flex items-center justify-between gap-2 pl-[.625rem] pb-1">
            <Text size={12} weight="medium" color="brand" opacity={50}>
              {title}
            </Text>
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={close}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full dash-text-default hover:bg-dash-primary-dark-blue/8 dark:hover:bg-white/8"
            >
              <CloseIcon size={8} color="currentColor" />
            </button>
          </div>
          <div role="menu" aria-label={title}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onSelect?.()
                  close()
                }}
                className={`
                  flex w-full items-center gap-3 text-left ${POPOVER_OPTION}
                  ${item.tone === 'danger' ? 'text-dash-red' : 'dash-text-default'}
                `}
              >
                <span className="flex size-2.5 shrink-0 items-center justify-center" aria-hidden="true">
                  {item.icon}
                </span>
                <Text size={12} weight="medium" color="brand" className={item.tone === 'danger' ? '!text-dash-red' : ''}>
                  {item.label}
                </Text>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export type {ContextMenuItem, ContextMenuProps} from '@renderer/types/ContextMenu'
export default ContextMenu
