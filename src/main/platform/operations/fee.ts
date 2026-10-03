import {
  AddressCreditWithdrawalTransitionWASM,
  AddressFundsTransferTransitionWASM,
  PlatformAddressWASM,
  PlatformVersionWASM,
  ShieldFromAssetLockTransitionWASM,
  ShieldedTransferTransitionWASM,
} from 'pshenmic-dpp'
import {
  AddressFundsFeeStrategyStepWASM,
  IdentityPublicKeyInCreationWASM,
  InputAddressWASM,
  OutputAddressNullableCreditsWASM,
  OutputAddressWASM,
  StateTransitionWASM,
} from 'dash-platform-sdk/types.js'
import {coreAddressToScript} from '../../src/utils/coreScript'
import {
  FEE_QUOTE_PUBLIC_KEY,
  FUNDING_REMAINDER_STAND_IN,
  KEY_SPECS,
  PLATFORM_ADDRESS_BYTES,
} from '../constants'
import type {ChainAssetLockProofParams} from 'dash-core-sdk/src/utils.js'
import {BuiltTransitionOperation, FeeQuoteParams, PlatformOperations, TransitionFeeOperation} from '../types/messages'
import {OperationContext} from './types'
import {buildAssetLockProof} from './assetLockProof'
import {platformVersion} from './platformVersion'
import {DEDUCT_FROM_FIRST} from './address/signInputs'
import {minimumFee} from './shielded/spend/fee'
import {IDENTITY_KEY_DEFINITIONS, MAX_BUNDLE_ACTIONS, MIN_BUNDLE_ACTIONS} from '../../src/constants/credits'
import {ASSET_LOCK_BASE_COST_CREDITS, SHIELD_FUNDING_ACTIONS} from '../../src/constants/fee/platform'

type Payload = PlatformOperations['transitionFee']['payload']
type Result = PlatformOperations['transitionFee']['result']
type CurvePayload = PlatformOperations['spendFeeCurve']['payload']
type CurveResult = PlatformOperations['spendFeeCurve']['result']

// Notes spent and addresses paid both land on the action count, and the fee
// follows only that, so one curve over every action count answers for both.
export async function spendFeeCurve(payload: CurvePayload, ctx: OperationContext): Promise<CurveResult> {
  const version = await platformVersion(ctx)
  return {
    feeCredits: Array.from({length: MAX_BUNDLE_ACTIONS}, (_, index) => minimumFee(payload.kind, index + 1, version)),
  }
}

// What every priced transition costs. This is the only place an operation's
// price is spelled out; main decides which operations come here, never how they
// are priced. Every quote is local — WASM and the SDK's builders — once the
// network's protocol version is known.
//
// metered means consensus prices the transition at execution and this is only
// the floor. A shielded fee is exact, so nothing may be added to it.
export async function transitionFee(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {operation, params} = payload
  return {
    feeCredits: protocolFee(operation, params, ctx, await platformVersion(ctx)),
    metered: operation !== 'shield' && operation !== 'assetLockShield',
  }
}

// Shield's own minimum omits note storage, but consensus checks its claims
// against the full pool carve, which ShieldedTransfer carries.
export function shieldPoolFee(version: PlatformVersionWASM): bigint {
  return ShieldedTransferTransitionWASM.computeMinimumFee(MIN_BUNDLE_ACTIONS, version)
}

function protocolFee(
  operation: TransitionFeeOperation,
  params: FeeQuoteParams,
  ctx: OperationContext,
  version: PlatformVersionWASM,
): bigint {
  switch (operation) {
    case 'addressFundsTransfer':
      return AddressFundsTransferTransitionWASM.estimateMinFee(params.inputCount, paid(params).length, version)

    // What a withdrawal does not spend stays on the address, so no change output.
    case 'addressWithdrawal':
      return AddressCreditWithdrawalTransitionWASM.estimateMinFee(params.inputCount, false, version)

    case 'shield':
      return shieldPoolFee(version)

    // Exact, not a floor: with no surplus address, consensus donates whatever
    // the lock carries above this to the fee pools.
    case 'assetLockShield':
      return ShieldFromAssetLockTransitionWASM.computeMinimumFee(SHIELD_FUNDING_ACTIONS, version) + ASSET_LOCK_BASE_COST_CREDITS

    default:
      return builtTransition(operation, params, ctx).calculateMinRequiredFee(version)
  }
}

// The transitions that price themselves. All unsigned, and built against
// stand-ins wherever the real value is not knowable when a quote is asked for:
// a nonce of 1, which otherwise costs a proved gRPC round trip per keystroke,
// and a proof of zeroes, because nothing is locked yet. Both are measured —
// across the u64 range, and against real instant proofs — and neither moves a
// fee. The four L1 -> L2 cases are the L2 half of a funding: what the proof
// will be spent on once the lock settles.
function builtTransition(
  operation: BuiltTransitionOperation,
  params: FeeQuoteParams,
  ctx: OperationContext,
): StateTransitionWASM {
  const {sdk, network} = ctx
  const identityId = params.identityId ?? ''
  const proof: ChainAssetLockProofParams = {type: 'chainLock', txid: '0'.repeat(64), coreChainLockedHeight: 1, outputIndex: 0}

  switch (operation) {
    case 'identityToAddress':
      return sdk.platformAddresses.createStateTransition('identityCreditTransferToAddresses', {
        identityId,
        recipients: paid(params).map(address => new OutputAddressWASM(address, params.amountCredits)),
        nonce: 1n,
        userFeeIncrease: 0,
      })
    case 'identityToIdentity':
      return sdk.identities.createStateTransition('creditTransfer', {
        identityId,
        recipientId: paid(params)[0],
        amount: params.amountCredits,
        identityNonce: 1n,
      })
    case 'identityWithdrawal':
      return sdk.identities.createStateTransition('withdrawal', {
        identityId,
        amount: params.amountCredits,
        coreFeePerByte: params.coreFeePerByte,
        pooling: 'Never',
        identityNonce: 1n,
        outputScript: coreAddressToScript(paid(params)[0], network),
      })

    // The inputs carry their own nonces, so neither of these reads the network.
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

    // The recipient and the address the unused fee returns to; only their count
    // prices the funding.
    case 'assetLockFunding':
      return sdk.platformAddresses.createStateTransition('addressFundingFromAssetLock', {
        assetLockProof: buildAssetLockProof(proof, proof.txid, proof.outputIndex),
        inputs: [],
        feeStrategy: [AddressFundsFeeStrategyStepWASM.ReduceOutput(1)],
        inputWitness: [],
        outputs: [
          new OutputAddressNullableCreditsWASM(paid(params)[0], params.amountCredits),
          new OutputAddressNullableCreditsWASM(quoteAddress(FUNDING_REMAINDER_STAND_IN)),
        ],
        userFeeIncrease: 0,
      })
    case 'identityRegister':
      return sdk.identities.createStateTransition('create', {
        publicKeys: IDENTITY_KEY_DEFINITIONS.map(({id, purpose, securityLevel, keyType}) => ({
          id, purpose, securityLevel, keyType, readOnly: false, data: FEE_QUOTE_PUBLIC_KEY,
        })),
        assetLockProof: proof,
      })
    case 'identityTopUpL1':
      return sdk.identities.createStateTransition('topUp', {
        identityId: paid(params)[0],
        assetLockProof: proof,
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
// Nonce and credits are stood in for the same way: measured across the u64
// range, neither moves the fee.
function quoteInputs(inputCount: number): InputAddressWASM[] {
  return Array.from({length: inputCount}, (_, index) => new InputAddressWASM(quoteAddress(index), 1, 1_000_000n))
}

function quoteAddress(index: number): PlatformAddressWASM {
  const bytes = new Uint8Array(PLATFORM_ADDRESS_BYTES)
  bytes[1] = index
  return PlatformAddressWASM.fromBytes(bytes)
}
