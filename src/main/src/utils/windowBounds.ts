import {
  WINDOW_MAX_DEFAULT_HEIGHT,
  WINDOW_MAX_DEFAULT_WIDTH,
  WINDOW_MIN_VISIBLE_PX,
  WINDOW_WORKAREA_RATIO,
} from '../constants'
import { DisplayWorkArea, WindowSize, WindowState } from '../types/WindowState'

export function computeDefaultWindowSize(workArea: WindowSize): WindowSize {
  return {
    width: Math.min(WINDOW_MAX_DEFAULT_WIDTH, Math.round(workArea.width * WINDOW_WORKAREA_RATIO)),
    height: Math.min(WINDOW_MAX_DEFAULT_HEIGHT, Math.round(workArea.height * WINDOW_WORKAREA_RATIO)),
  }
}

export function parseWindowState(value: unknown): WindowState | null {
  if (typeof value !== 'object' || value === null) return null
  const { x, y, width, height, maximized } = value as Record<string, unknown>
  const numbers = [x, y, width, height]
  if (!numbers.every((n): n is number => typeof n === 'number' && Number.isFinite(n))) return null
  if ((width as number) <= 0 || (height as number) <= 0) return null
  return {
    x: x as number,
    y: y as number,
    width: width as number,
    height: height as number,
    maximized: maximized === true,
  }
}

export function isVisibleOnSomeDisplay(state: WindowState, workAreas: DisplayWorkArea[]): boolean {
  return workAreas.some((area) => {
    const overlapX = Math.min(state.x + state.width, area.x + area.width) - Math.max(state.x, area.x)
    const overlapY = Math.min(state.y + state.height, area.y + area.height) - Math.max(state.y, area.y)
    return overlapX >= WINDOW_MIN_VISIBLE_PX && overlapY >= WINDOW_MIN_VISIBLE_PX
  })
}

export function restoreWindowState(raw: unknown, workAreas: DisplayWorkArea[]): WindowState | null {
  const state = parseWindowState(raw)
  if (!state) return null
  return isVisibleOnSomeDisplay(state, workAreas) ? state : null
}
