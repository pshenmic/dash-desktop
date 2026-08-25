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
import {
  FEE_QUOTE_INPUT_CREDITS,
  FEE_QUOTE_NONCE,
  FEE_QUOTE_PUBLIC_KEY,
  KEY_SPECS,
  PLATFORM_ADDRESS_BYTES,
} from '../constants'
import {FeeQuoteParams, PlatformOperations, TransitionFeeOperation} from '../types/messages'
import {OperationContext} from './types'
import {DEDUCT_FROM_FIRST} from './address/signInputs'
import {minimumFee} from './shielded/spend/fee'
import {MAX_SPEND_NOTES, MIN_BUNDLE_ACTIONS} from './shielded/constants'

type Payload = PlatformOperations['transitionFee']['payload']
type Result = PlatformOperations['transitionFee']['result']
type CurvePayload = PlatformOperations['spendFeeCurve']['payload']
type CurveResult = PlatformOperations['spendFeeCurve']['result']

// A spend's fee and its note count define each other, so the caller needs the
// whole curve to resolve them rather than one point on it.
export function spendFeeCurve(payload: CurvePayload): CurveResult {
  return {
    feeCredits: Array.from({length: MAX_SPEND_NOTES}, (_, index) => minimumFee(payload.kind, index + 1)),
  }
}

// What every priced transition costs. This is the only place an operation's
// price is spelled out; main decides which operations come here, never how they
// are priced. Every quote is local — WASM and the SDK's builders, no round trip.
//
// metered means consensus prices the transition at execution and this is only
// the floor. A shielded fee is exact, so nothing may be added to it.
export function transitionFee(payload: Payload, ctx: OperationContext): Result {
  const {operation, params} = payload
  return {
    feeCredits: protocolFee(operation, params, ctx),
    metered: operation !== 'shield',
  }
}

function protocolFee(operation: TransitionFeeOperation, params: FeeQuoteParams, ctx: OperationContext): bigint {
  switch (operation) {
    case 'addressFundsTransfer':
      return AddressFundsTransferTransitionWASM.estimateMinFee(params.inputCount, paid(params).length)

    // What a withdrawal does not spend stays on the address, so no change output.
    case 'addressWithdrawal':
      return AddressCreditWithdrawalTransitionWASM.estimateMinFee(params.inputCount, false)

    // Shield's own minimum omits note storage, but consensus checks its inputs
    // against the full pool carve, which ShieldedTransfer carries.
    case 'shield':
      return ShieldedTransferTransitionWASM.computeMinimumFee(MIN_BUNDLE_ACTIONS)

    case 'identityToAddress':
    case 'identityToIdentity':
    case 'identityWithdrawal':
      return identityTransition(operation, params, ctx).calculateMinRequiredFee()

    case 'identityCreate':
    case 'identityTopUp':
      return addressFundedTransition(operation, params, ctx).calculateMinRequiredFee()
  }
}

// Unsigned, and priced against a placeholder nonce: the real one costs a proved
// gRPC round trip per quote and, measured across the u64 range, does not move
// the fee of any of these three transitions at all.
function identityTransition(
  operation: 'identityToAddress' | 'identityToIdentity' | 'identityWithdrawal',
  params: FeeQuoteParams,
  ctx: OperationContext,
): StateTransitionWASM {
  const {sdk, network} = ctx
  const identityId = params.identityId ?? ''

  switch (operation) {
    case 'identityToAddress':
      return sdk.platformAddresses.createStateTransition('identityCreditTransferToAddresses', {
        identityId,
        recipients: paid(params).map(address => new OutputAddressWASM(address, params.amountCredits)),
        nonce: FEE_QUOTE_NONCE,
        userFeeIncrease: 0,
      })
    case 'identityToIdentity':
      return sdk.identities.createStateTransition('creditTransfer', {
        identityId,
        recipientId: paid(params)[0],
        amount: params.amountCredits,
        identityNonce: FEE_QUOTE_NONCE,
      })
    case 'identityWithdrawal':
      return sdk.identities.createStateTransition('withdrawal', {
        identityId,
        amount: params.amountCredits,
        coreFeePerByte: params.coreFeePerByte,
        pooling: 'Never',
        identityNonce: FEE_QUOTE_NONCE,
        outputScript: coreAddressToScript(paid(params)[0], network),
      })
  }
}

// The inputs carry their own nonces, so neither of these reads the network.
function addressFundedTransition(
  operation: 'identityCreate' | 'identityTopUp',
  params: FeeQuoteParams,
  ctx: OperationContext,
): StateTransitionWASM {
  const {sdk} = ctx

  switch (operation) {
    case 'identityCreate':
      return sdk.platformAddresses.createStateTransition('identityCreateFromAddresses', {
        publicKeys: KEY_SPECS.map((spec, keyId) =>
          new IdentityPublicKeyInCreationWASM(
            keyId, spec.purpose, spec.securityLevel, 'ECDSA_SECP256K1', false, FEE_QUOTE_PUBLIC_KEY)),
        inputs: quoteInputs(params.inputCount),
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      })
    case 'identityTopUp':
      return sdk.platformAddresses.createStateTransition('identityTopUpFromAddresses', {
        identityId: paid(params)[0],
        inputs: quoteInputs(params.inputCount),
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      })
  }
}

// The addresses an operation pays, however many. Operations that pay one carry
// it as a bare string, so nothing has to keep a count in step with a list.
function paid(params: FeeQuoteParams): string[] {
  return Array.isArray(params.recipient) ? params.recipient : [params.recipient]
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
