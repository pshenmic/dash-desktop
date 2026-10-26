import {Transaction as SDKTransaction, TransactionType} from 'dash-core-sdk'
import {AssetLockTx} from 'dash-core-sdk/src/types/ExtraPayload/AssetLockTx.js'
import {ChainAssetLockProofWASM, OutPointWASM} from 'pshenmic-dpp'
import {Network} from '../types/Network'
import {AssetLockFundingKind} from '../types/AssetLock'
import {AssetLockCredit, AssetLockCreditSource, AssetLockRecoveryDestination} from '../types/AssetLockRecovery'
import {ASSET_LOCK_CREDIT_OUTPUT_INDEX, ASSET_LOCK_RECOVERY_KINDS} from '../constants/credits'
import {TXID_PATTERN} from '../constants/chain'

export function requireTxid(input: string): string {
  const txid = input.trim().toLowerCase()
  if (!TXID_PATTERN.test(txid)) {
    throw new Error('Invalid transaction id')
  }
  return txid
}

// Every lock this wallet builds carries one P2PKH credit output, and the resume
// path spends it at ASSET_LOCK_CREDIT_OUTPUT_INDEX.
export function assetLockCredit(tx: SDKTransaction, network: Network): AssetLockCredit {
  if (tx.type !== TransactionType.TRANSACTION_ASSET_LOCK || tx.getExtraPayloadType() !== 'AssetLockTx') {
    throw new Error('Transaction is not an asset lock')
  }
  const {outputs} = tx.extraPayload as AssetLockTx
  const output = outputs[ASSET_LOCK_CREDIT_OUTPUT_INDEX]
  const address = outputs.length === 1 ? output.getAddress(network) : undefined
  if (address == null) {
    throw new Error('Asset lock does not carry a single P2PKH credit output')
  }
  return {address, amountDuffs: output.satoshis}
}

// Platform names an identity after the outpoint that funded it; the chain lock
// height plays no part, so any height yields the same id.
export function assetLockIdentityId(txid: string): string {
  return new ChainAssetLockProofWASM(0, new OutPointWASM(txid, ASSET_LOCK_CREDIT_OUTPUT_INDEX)).createIdentityId().base58()
}

export function recoveryFundingKind(source: AssetLockCreditSource, destination: AssetLockRecoveryDestination): AssetLockFundingKind {
  if (!ASSET_LOCK_RECOVERY_KINDS[source].includes(destination.kind)) {
    throw new Error(`An asset lock credited to a ${source} key cannot fund a ${destination.kind} destination`)
  }
  return destination.kind
}
