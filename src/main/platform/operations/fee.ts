import {
  AddressCreditWithdrawalTransitionWASM,
  AddressFundsTransferTransitionWASM,
  PlatformAddressWASM,
  ShieldFromAssetLockTransitionWASM,
  ShieldTransitionWASM,
} from 'pshenmic-dpp'
import {
  AddressFundsFeeStrategyStepWASM,
  IdentityPublicKeyInCreationWASM,
  OutputAddressNullableCreditsWASM,
  OutputAddressWASM,
  StateTransitionWASM,
} from 'dash-platform-sdk/types.js'
import {coreAddressToScript} from '../../src/utils/coreScript'
import {CORE_FEE_PER_BYTE} from '../../src/constants'
import {FEE_QUOTE_PUBLIC_KEY, KEY_SPECS} from '../constants'
import {FeeQuery, PlatformOperations} from '../types/messages'
import {OperationContext} from './types'
import {addressInfos} from './address/infos'
import {DEDUCT_FROM_FIRST, toInputAddresses} from './address/signInputs'
import {buildAssetLockProof} from './assetLockProof'
import {minimumFee} from './shielded/spend/fee'
import {MIN_BUNDLE_ACTIONS} from './shielded/constants'

type Payload = PlatformOperations['transitionFee']['payload']
type Result = PlatformOperations['transitionFee']['result']

type IdentityQuery = Extract<
  FeeQuery,
  {kind: 'identityCreditsToAddresses' | 'identityCreditTransfer' | 'identityWithdrawal'}
>

type AddressFundedQuery = Extract<
  FeeQuery,
  {kind: 'identityCreateFromAddresses' | 'identityTopUpFromAddresses' | 'addressFundingFromAssetLock'}
>

export async function transitionFee(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {query} = payload

  const minFeeCredits = await minimumFeeCredits(query, ctx)
  // Deduped for storage only: two outputs to one address create one entry.
  const recipients = [...new Set(paidAddresses(query))]
  const newAddresses = await addressesNotInState(recipients, ctx)
  const storageFeeCredits = PlatformAddressWASM.estimateStorageFeeForNewAddresses(newAddresses.length)

  return {
    minFeeCredits,
    storageFeeCredits,
    totalFeeCredits: minFeeCredits + storageFeeCredits,
    newAddresses,
  }
}

async function minimumFeeCredits(query: FeeQuery, ctx: OperationContext): Promise<bigint> {
  switch (query.kind) {
    case 'addressTransfer':
      return AddressFundsTransferTransitionWASM.estimateMinFee(query.inputCount, query.recipients.length)
    case 'addressWithdrawal':
      return AddressCreditWithdrawalTransitionWASM.estimateMinFee(query.inputCount, query.hasChange)
    case 'shieldedSpend':
      return minimumFee(query.spendKind, query.noteCount)
    case 'shield': {
      const actions = Math.max(query.noteCount, MIN_BUNDLE_ACTIONS)
      return query.fromAssetLock
        ? ShieldFromAssetLockTransitionWASM.computeMinimumFee(actions)
        : ShieldTransitionWASM.computeMinimumFee(actions)
    }
    case 'identityCreditsToAddresses':
    case 'identityCreditTransfer':
    case 'identityWithdrawal':
      return (await identityTransition(query, ctx)).calculateMinRequiredFee()
    case 'identityCreateFromAddresses':
    case 'identityTopUpFromAddresses':
    case 'addressFundingFromAssetLock':
      return addressFundedTransition(query, ctx).calculateMinRequiredFee()
  }
}

// Unsigned: the fee does not depend on the signature, so a quote needs no seed.
async function identityTransition(query: IdentityQuery, ctx: OperationContext): Promise<StateTransitionWASM> {
  const {sdk, network} = ctx
  const identityNonce = await sdk.identities.getIdentityNonce(query.identityId) + 1n

  switch (query.kind) {
    case 'identityCreditsToAddresses':
      return sdk.platformAddresses.createStateTransition('identityCreditTransferToAddresses', {
        identityId: query.identityId,
        recipients: query.recipients.map(
          recipient => new OutputAddressWASM(recipient.address, recipient.amountCredits),
        ),
        nonce: identityNonce,
        userFeeIncrease: 0,
      })
    case 'identityCreditTransfer':
      return sdk.identities.createStateTransition('creditTransfer', {
        identityId: query.identityId,
        recipientId: query.recipientId,
        amount: query.amountCredits,
        identityNonce,
      })
    case 'identityWithdrawal':
      return sdk.identities.createStateTransition('withdrawal', {
        identityId: query.identityId,
        amount: query.amountCredits,
        coreFeePerByte: CORE_FEE_PER_BYTE,
        pooling: 'Never',
        identityNonce,
        outputScript: coreAddressToScript(query.coreAddress, network),
      })
  }
}

// The inputs carry their own nonces, so none of these read the network.
function addressFundedTransition(query: AddressFundedQuery, ctx: OperationContext): StateTransitionWASM {
  const {sdk} = ctx

  switch (query.kind) {
    case 'identityCreateFromAddresses':
      return sdk.platformAddresses.createStateTransition('identityCreateFromAddresses', {
        publicKeys: KEY_SPECS.map((spec, keyId) =>
          new IdentityPublicKeyInCreationWASM(
            keyId, spec.purpose, spec.securityLevel, 'ECDSA_SECP256K1', false, FEE_QUOTE_PUBLIC_KEY)),
        inputs: toInputAddresses(query.inputs),
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      })
    case 'identityTopUpFromAddresses':
      return sdk.platformAddresses.createStateTransition('identityTopUpFromAddresses', {
        identityId: query.identityId,
        inputs: toInputAddresses(query.inputs),
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      })
    case 'addressFundingFromAssetLock':
      return sdk.platformAddresses.createStateTransition('addressFundingFromAssetLock', {
        assetLockProof: buildAssetLockProof(query.assetLockProof, query.txid, query.outputIndex),
        inputs: [],
        feeStrategy: [AddressFundsFeeStrategyStepWASM.ReduceOutput(0)],
        inputWitness: [],
        outputs: [new OutputAddressNullableCreditsWASM(query.recipient)],
        userFeeIncrease: 0,
      })
  }
}

// A payout to a Core address, the pool or an identity balance creates no entry.
// surplusOutput is counted as a payout — dpp states no amount for it.
function paidAddresses(query: FeeQuery): string[] {
  switch (query.kind) {
    case 'addressTransfer':
    case 'shieldedSpend':
      return query.recipients
    case 'identityCreditsToAddresses':
      return query.recipients.map(recipient => recipient.address)
    case 'shield':
      return query.surplusAddress != null ? [query.surplusAddress] : []
    case 'addressFundingFromAssetLock':
      return [query.recipient]
    case 'addressWithdrawal':
    case 'identityCreditTransfer':
    case 'identityWithdrawal':
    case 'identityCreateFromAddresses':
    case 'identityTopUpFromAddresses':
      return []
  }
}

// dash-platform-sdk reports an address missing from state as a zero balance
// with a zero nonce, so that pair is the only signal a client gets.
async function addressesNotInState(addresses: string[], ctx: OperationContext): Promise<string[]> {
  if (addresses.length === 0) return []

  const {infos} = await addressInfos({addresses}, ctx)
  const inState = new Set(
    infos.filter(info => info.balance > 0n || info.nonce > 0).map(info => info.address),
  )

  return addresses.filter(address => !inState.has(address))
}