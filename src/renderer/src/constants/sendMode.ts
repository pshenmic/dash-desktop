import { SendMode } from '../enums/SendMode'
import type { SegmentOption } from '../types/SegmentedControl'

export const SEND_MODE_OPTIONS: SegmentOption<SendMode>[] = [
  { value: SendMode.Simple, label: 'Simple' },
  { value: SendMode.Advanced, label: 'Advanced' },
]

export const SEND_MODE_LABEL = 'Send mode'
