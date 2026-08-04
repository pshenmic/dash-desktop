import {PlatformRequestMessage} from './types/messages'
import type {Network} from '../src/types'

export const PROVER_LANE = 'prover'

export const MB = 1024 * 1024

export const NETWORKS: readonly Network[] = ['mainnet', 'testnet']

export const ERROR_CODES: readonly string[] =
  ['cancelled', 'alreadyInChain', 'insufficientFunds', 'network', 'internal']

// Trailing base64 blob of a serialized consensus error.
export const CONSENSUS_DATA = /data:\s*([A-Za-z0-9+/=]+)\s*$/

export const IDENTITY_KEY_LOOKAHEAD = 20

// A quote has no seed, and the fee depends on the key count, not the key. The
// secp256k1 generator stands in because it parses wherever a real key would.
export const FEE_QUOTE_PUBLIC_KEY = Uint8Array.from(
  Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex'),
)

export const KEY_SPECS: Array<{purpose: 'AUTHENTICATION' | 'TRANSFER'; securityLevel: 'MASTER' | 'HIGH' | 'CRITICAL'}> = [
  {purpose: 'AUTHENTICATION', securityLevel: 'MASTER'},
  {purpose: 'AUTHENTICATION', securityLevel: 'HIGH'},
  {purpose: 'AUTHENTICATION', securityLevel: 'CRITICAL'},
  {purpose: 'TRANSFER', securityLevel: 'CRITICAL'},
]

// Prover-lane work saturates the single thread this process has, so serialising
// it costs nothing and guarantees a spend sees what the sync before it
// recovered. Reads get no lane: they are socket waits.
//
// Signed transitions get a lane per nonce source. An identity's nonce is read
// and consumed in one task, so two transitions from the same identity must not
// interleave. Address-funded transitions share one lane per network: their
// inputs can overlap in ways a single key cannot express, and they are
// user-initiated one at a time.
export function laneFor(request: PlatformRequestMessage): string | null {
  switch (request.kind) {
    case 'warmup':
    case 'sync':
    case 'spend':
    case 'shield':
    case 'shieldFromAssetLock':
      return PROVER_LANE

    case 'addressTransfer':
    case 'addressWithdrawal':
    case 'identityCreateFromAddresses':
    case 'identityTopUpFromAddresses':
      return `${request.network}:addresses`

    // No nonce to order, so the lane only stops one funding being submitted
    // twice concurrently.
    case 'addressFundingFromAssetLock':
    case 'identityCreateFromAssetLock':
    case 'identityTopUpFromAssetLock':
      return `${request.network}:assetlock:${request.payload.txid}`

    case 'identityCreditsToAddresses':
    case 'identityCreditTransfer':
    case 'identityWithdrawal':
      return `${request.network}:identity:${request.payload.identifier}`

    case 'transitionFee':
    case 'addressInfos':
    case 'identityExists':
    case 'identityBalance':
    case 'identityNonce':
    case 'identityInfos':
    case 'identityScan':
    case 'nodeStatus':
    case 'poolInfo':
    case 'notesCount':
    case 'encryptedNotes':
      return null
  }
}