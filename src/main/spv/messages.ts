import {Network} from '../src/types'

export interface SpvStartMessage {
  type: 'start'
  network: Network
  chainDbPath: string
  startHeight: number
  startHash: string | null
  watchAddresses: string[]
  birthdayHeight?: number
}

export interface SpvStopMessage {
  type: 'stop'
}

export interface SpvAddWatchAddressesMessage {
  type: 'addWatchAddresses'
  network: Network
  addresses: string[]
}

export type SpvCommand = SpvStartMessage | SpvStopMessage | SpvAddWatchAddressesMessage

export type SpvPhase =
  | 'idle'
  | 'connecting'
  | 'syncing-headers'
  | 'synced-headers'
  | 'syncing-cfilters'
  | 'synced'
  | 'stopped'

export interface SpvStatus {
  phase: SpvPhase
  network: Network | null
  tipHeight: number
  tipHash: string | null
  peerCount: number
  cfilterHeight: number
  utxoCount: number
  updatedAt: number
}

export interface SpvUtxoSummary {
  txid: string
  vout: number
  satoshis: string
  address: string
  height: number
}

export interface SpvStatusMessage {
  type: 'status'
  status: SpvStatus
}

export interface SpvUtxosMessage {
  type: 'utxos'
  utxos: SpvUtxoSummary[]
}

export interface SpvErrorMessage {
  type: 'error'
  message: string
}

export type SpvEvent = SpvStatusMessage | SpvUtxosMessage | SpvErrorMessage