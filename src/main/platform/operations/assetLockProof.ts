import {AssetLockProofWASM} from 'dash-platform-sdk/types.js'
import {OutPointWASM} from 'pshenmic-dpp'
import type {ChainAssetLockProofParams, InstantAssetLockProofParams} from 'dash-core-sdk/src/utils.js'
import {AssetLockProofParams} from '../types/messages'

const hexToBytes = (hex: string): Uint8Array => Uint8Array.from(Buffer.from(hex, 'hex'))

export function buildAssetLockProof(proof: AssetLockProofParams, txid: string, outputIndex: number): AssetLockProofWASM {
  return proof.type === 'instantLock'
    ? AssetLockProofWASM.createInstantAssetLockProof(
        hexToBytes(proof.instantLock),
        hexToBytes(proof.transaction),
        outputIndex,
      )
    : AssetLockProofWASM.createChainAssetLockProof(
        proof.coreChainLockedHeight,
        new OutPointWASM(txid, outputIndex),
      )
}

export function assetLockProofParams(
  proof: AssetLockProofParams,
  txid: string,
  outputIndex: number,
): InstantAssetLockProofParams | ChainAssetLockProofParams {
  return proof.type === 'instantLock'
    ? {type: 'instantLock', transaction: proof.transaction, instantLock: proof.instantLock, outputIndex}
    : {type: 'chainLock', txid, coreChainLockedHeight: proof.coreChainLockedHeight, outputIndex}
}
