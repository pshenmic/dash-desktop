import { useSyncExternalStore } from 'react'
import {
  getMasternodePreviewPreset,
  setMasternodePreviewPreset,
  subscribeMasternodePreviewPreset,
} from '@renderer/api/preview/previewStore'

export function useMasternodePreviewPreset() {
  const preset = useSyncExternalStore(subscribeMasternodePreviewPreset, getMasternodePreviewPreset)
  return { preset, setPreset: setMasternodePreviewPreset }
}
