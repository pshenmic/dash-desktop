import { DashPlatformSDK } from 'dash-platform-sdk'
import { Network } from '../types'

export type ShieldedWarmupState = 'idle' | 'preparing' | 'ready' | 'error'

export interface ShieldedStatus {
  warmup: ShieldedWarmupState
  ready: boolean
  error: string | null
}

export interface ShieldedPoolInfo {
  poolState: string | null
  notesCount: string | null
}

export class ShieldedService {
  private sdk: DashPlatformSDK
  private warmupState: ShieldedWarmupState = 'idle'
  private warmupError: string | null = null

  constructor(sdk: DashPlatformSDK) {
    this.sdk = sdk
  }

  getStatus(): ShieldedStatus {
    if (this.warmupState === 'idle') {
      void this.warmUp()
    }
    return {
      warmup: this.warmupState,
      ready: this.warmupState === 'ready',
      error: this.warmupError
    }
  }

  async warmUp(): Promise<void> {
    if (this.warmupState === 'preparing' || this.warmupState === 'ready') return
    this.warmupState = 'preparing'
    this.warmupError = null
    try {
      await new Promise<void>((resolve) => setImmediate(resolve))
      this.sdk.shielded.init()
      this.warmupState = 'ready'
    } catch (e) {
      this.warmupState = 'error'
      this.warmupError = e instanceof Error ? e.message : String(e)
      console.error('Shielded builder warm-up failed', e)
    }
  }

  async getPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    this.sdk.setNetwork(network)
    const [poolState, notesCount] = await Promise.all([
      this.sdk.shielded.getShieldedPoolState(),
      this.sdk.shielded.getShieldedNotesCount()
    ])
    return {
      poolState: poolState != null ? poolState.toString() : null,
      notesCount: notesCount != null ? notesCount.toString() : null
    }
  }
}
