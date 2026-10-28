import { ListNavigationKey } from '@renderer/enums/ListNavigationKey'

export function nextListIndex(current: number, key: string, length: number): number {
  if (length <= 0) return -1
  const outside = current < 0 || current >= length
  switch (key) {
    case ListNavigationKey.ArrowDown:
      return outside || current === length - 1 ? 0 : current + 1
    case ListNavigationKey.ArrowUp:
      return outside || current === 0 ? length - 1 : current - 1
    case ListNavigationKey.Home:
      return 0
    case ListNavigationKey.End:
      return length - 1
    default:
      return current
  }
}
