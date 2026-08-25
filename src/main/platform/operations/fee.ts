import {
  AddressCreditWithdrawalTransitionWASM,
  AddressFundsTransferTransitionWASM,
  PlatformAddressWASM,
  ShieldedTransferTransitionWASM,
} from 'pshenmic-dpp'
import {
  IdentityPublicKeyInCreationWASM,
  InputAddressWASM,
  OutputAddressWASM,
  StateTransitionWASM,
} from 'dash-platform-sdk/types.js'
import {coreAddressToScript} from '../../src/utils/coreScript'
import {FEE_QUOTE_INPUT_CREDITS, FEE_QUOTE_PUBLIC_KEY, KEY_SPECS, PLATFORM_ADDRESS_BYTES, SHIELD_RECIPIENT_COUNT} from '../constants'
import {FeeQuery, PlatformOperations} from '../types/messages'
import {OperationContext} from './types'
import {DEDUCT_FROM_FIRST} from './address/signInputs'
import {minimumFee} from './shielded/spend/fee'
import {MAX_SPEND_NOTES, MIN_BUNDLE_ACTIONS} from './shielded/constants'

type Payload = PlatformOperations['transitionFee']['payload']
type Result = PlatformOperations['transitionFee']['result']
type CurvePayload = PlatformOperations['spendFeeCurve']['payload']
type CurveResult = PlatformOperations['spendFeeCurve']['result']

type IdentityQuery = Extract<
  FeeQuery,
  {kind: 'identityCreditsToAddresses' | 'identityCreditTransfer' | 'identityWithdrawal'}
>

type AddressFundedQuery = Extract<
  FeeQuery,
  {kind: 'identityCreateFromAddresses' | 'identityTopUpFromAddresses'}
>

// A spend's fee and its note count define each other, so the caller needs the
// whole curve to resolve them rather than one point on it.
export function spendFeeCurve(payload: CurvePayload): CurveResult {
  return {
    feeCredits: Array.from({length: MAX_SPEND_NOTES}, (_, index) => minimumFee(payload.kind, index + 1)),
  }
}

export async function transitionFee(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {query} = payload
  return {
    feeCredits: await protocolFee(query, ctx),
    metered: query.kind !== 'shield',
  }
}

// The address and identity transitions return a floor, with the metered fee
// coming out of the fee input's remaining balance; the shielded ones are exact.
async function protocolFee(query: FeeQuery, ctx: OperationContext): Promise<bigint> {
  switch (query.kind) {
    case 'addressTransfer':
      return AddressFundsTransferTransitionWASM.estimateMinFee(query.inputCount, SHIELD_RECIPIENT_COUNT)
    case 'addressWithdrawal':
      // What a withdrawal does not spend stays on the address, so no change output.
      return AddressCreditWithdrawalTransitionWASM.estimateMinFee(query.inputCount, false)
    case 'shield':
      // Shield's own minimum omits note storage, but consensus checks its
      // inputs against the full pool carve, which ShieldedTransfer carries.
      return ShieldedTransferTransitionWASM.computeMinimumFee(MIN_BUNDLE_ACTIONS)
    case 'identityCreditsToAddresses':
    case 'identityCreditTransfer':
    case 'identityWithdrawal':
      return (await identityTransition(query, ctx)).calculateMinRequiredFee()
    case 'identityCreateFromAddresses':
    case 'identityTopUpFromAddresses':
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
        coreFeePerByte: query.coreFeePerByte,
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
        inputs: quoteInputs(query.inputCount),
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      })
    case 'identityTopUpFromAddresses':
      return sdk.platformAddresses.createStateTransition('identityTopUpFromAddresses', {
        identityId: query.identityId,
        inputs: quoteInputs(query.inputCount),
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      })
  }
}

// The minimum scales with the input count and inputs are keyed by address, so
// a quote needs no real address, only as many distinct ones as it will carry.
function quoteInputs(inputCount: number): InputAddressWASM[] {
  return Array.from({length: inputCount}, (_, index) => {
    const bytes = new Uint8Array(PLATFORM_ADDRESS_BYTES)
    bytes[1] = index
    return new InputAddressWASM(PlatformAddressWASM.fromBytes(bytes), 1, FEE_QUOTE_INPUT_CREDITS)
  })
}
