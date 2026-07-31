import {PlatformRequestMessage} from './types/messages'

export const PROVER_LANE = 'prover'

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

    case 'addressInfos':
    case 'identityExists':
    case 'identityBalance':
    case 'identityNonce':
    case 'poolInfo':
    case 'notesCount':
    case 'encryptedNotes':
      return null
  }
}