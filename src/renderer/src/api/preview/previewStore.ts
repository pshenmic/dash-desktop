import { API } from '@renderer/api'
import type { AppStatus } from '@renderer/api/types'
import { DEFAULT_MASTERNODE_PREVIEW_PRESET, PREVIEW_DEFAULT_NETWORK } from '@renderer/constants/masternodePreview'
import type { MasternodePreviewPreset } from '@renderer/enums/Masternodes'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { PreviewSeedInput, PreviewUpdate, PreviewWalletState } from '@renderer/types/Preview'
import { buildPreviewWallet } from '@renderer/utils/masternodePreview'

let preset: MasternodePreviewPreset = DEFAULT_MASTERNODE_PREVIEW_PRESET
const presetListeners = new Set<() => void>()
const seedInputs = new Map<string, Promise<PreviewSeedInput>>()
const wallets = new Map<string, Promise<PreviewWalletState>>()

function forgetOnFailure<T>(map: Map<string, Promise<T>>, key: string, pending: Promise<T>): Promise<T> {
  map.set(key, pending)
  pending.catch(() => {
    if (map.get(key) === pending) map.delete(key)
  })
  return pending
}

export function getMasternodePreviewPreset(): MasternodePreviewPreset {
  return preset
}

export function setMasternodePreviewPreset(next: MasternodePreviewPreset): void {
  if (next === preset) return
  preset = next
  for (const listener of [...presetListeners]) listener()
}

export function subscribeMasternodePreviewPreset(listener: () => void): () => void {
  presetListeners.add(listener)
  return () => presetListeners.delete(listener)
}

export function masternodePreviewCacheKey(walletId: string, current: MasternodePreviewPreset = preset): string {
  return `${walletId}:${current}`
}

async function loadSeedInput(walletId: string): Promise<PreviewSeedInput> {
  const [status, identities] = await Promise.all([
    API.getStatus() as Promise<AppStatus | null>,
    (API.getIdentities(walletId) as Promise<IdentityApiDto[] | null>).then(list => list ?? [], () => []),
  ])
  return { network: status?.network ?? PREVIEW_DEFAULT_NETWORK, identities }
}

async function seedPreviewWallet(walletId: string, current: MasternodePreviewPreset): Promise<PreviewWalletState> {
  const input = await (seedInputs.get(walletId) ?? forgetOnFailure(seedInputs, walletId, loadSeedInput(walletId)))
  return buildPreviewWallet({ ...input, walletId, now: Date.now(), preset: current })
}

export function readPreviewWallet(walletId: string): Promise<PreviewWalletState> {
  const key = masternodePreviewCacheKey(walletId)
  return wallets.get(key) ?? forgetOnFailure(wallets, key, seedPreviewWallet(walletId, preset))
}

export async function updatePreviewWallet<R>(walletId: string, update: (state: PreviewWalletState) => PreviewUpdate<R>): Promise<R> {
  const key = masternodePreviewCacheKey(walletId)
  const { state, result } = update(await readPreviewWallet(walletId))
  wallets.set(key, Promise.resolve(state))
  return result
}

export function previewLatency(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
