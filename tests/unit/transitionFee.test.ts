import {describe, it, expect} from 'vitest'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {PlatformAddressWASM} from 'pshenmic-dpp'
import {InputAddressWASM} from 'dash-platform-sdk/types.js'
import {createBase58check} from '@scure/base'
import {sha256} from '@noble/hashes/sha2.js'
import {InstantLock, Input, Network as CoreNetwork, OutPoint, PrivateKey, Script, Transaction as SDKTransaction, TransactionType} from 'dash-core-sdk'
import {transitionFee} from '../../src/main/platform/operations/fee'
import {buildAssetLockOutputs} from '../../src/main/src/utils/assetLockTx'
import {IDENTITY_KEY_DEFINITIONS} from '../../src/main/src/constants'
import {FEE_QUOTE_PUBLIC_KEY} from '../../src/main/platform/constants'
import {DEDUCT_FROM_FIRST} from '../../src/main/platform/operations/address/signInputs'
import {FeeQuoteParams, TransitionFeeOperation} from '../../src/main/platform/types/messages'
import {OperationContext} from '../../src/main/platform/operations/types'

const IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const CORE_ADDRESS = coreAddress()
const PLATFORM_ADDRESS = platformAddress(0)

function platformAddress(index: number): string {
  const bytes = new Uint8Array(21)
  bytes[1] = index
  return PlatformAddressWASM.fromBytes(bytes).toBech32m('testnet')
}

// Testnet p2pkh: version byte 140 over a 20-byte hash.
function coreAddress(): string {
  const payload = new Uint8Array(21)
  payload[0] = 140
  payload.set(new Uint8Array(20).fill(7), 1)
  return createBase58check(sha256).encode(payload)
}

// `recipient` is whatever kind of address the operation pays, which is the one
// thing about FeeParams a reader has to know.
const RECIPIENT: Record<TransitionFeeOperation, string> = {
  addressFundsTransfer: PLATFORM_ADDRESS,
  addressWithdrawal: CORE_ADDRESS,
  shield: PLATFORM_ADDRESS,
  identityToAddress: PLATFORM_ADDRESS,
  identityToIdentity: IDENTITY,
  identityWithdrawal: CORE_ADDRESS,
  identityCreate: '',
  identityTopUp: IDENTITY,
  assetLockFunding: PLATFORM_ADDRESS,
  assetLockShield: '',
  identityRegister: '',
  identityTopUpL1: IDENTITY,
}

const FUNDING_TXID = '11'.repeat(32)

// A real signed asset lock, so the instant proof below carries the bytes one
// would on chain rather than a hand-written stand-in.
function assetLockTransaction(inputCount: number): SDKTransaction {
  const key = PrivateKey.fromBytes(new Uint8Array(32).fill(3), 'testnet')
  const address = key.getPublicKey().getAddress(CoreNetwork.Testnet)
  const {burnOutput, extraPayload} = buildAssetLockOutputs(100_000_000n, address)
  const tx = new SDKTransaction(undefined, undefined, undefined, 3, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload)

  const script = new Script()
  script.pushOpCode('OP_DUP')
  script.pushOpCode('OP_HASH160')
  script.pushOpCode('OP_PUSHBYTES_20', new Uint8Array(20).fill(9))
  script.pushOpCode('OP_EQUALVERIFY')
  script.pushOpCode('OP_CHECKSIG')
  for (let i = 0; i < inputCount; i++) tx.addInput(new Input(FUNDING_TXID, i, script, 0xffffffff))

  tx.addOutput(burnOutput)
  tx.generateChange(address, 200_000_000n)
  tx.sign(Array.from({length: inputCount}, () => key))
  return tx
}

const ctx = {
  sdk: new DashPlatformSDK({network: 'testnet'}),
  network: 'testnet',
  signal: new AbortController().signal,
  progress: () => undefined,
  notesSpent: () => undefined,
} as unknown as OperationContext

function params(overrides: Partial<FeeQuoteParams> = {}): FeeQuoteParams {
  return {
    amountCredits: 1_000_000n,
    recipient: IDENTITY,
    sourceAddress: null,
    identityId: IDENTITY,
    noteIndexes: null,
    inputCount: 1,
    coreFeePerByte: 1,
    ...overrides,
  }
}

const ALL: TransitionFeeOperation[] = [
  'addressFundsTransfer',
  'addressWithdrawal',
  'shield',
  'identityToAddress',
  'identityToIdentity',
  'identityWithdrawal',
  'identityCreate',
  'identityTopUp',
  'assetLockFunding',
  'assetLockShield',
  'identityRegister',
  'identityTopUpL1',
]

describe('transitionFee', () => {
  it('prices every operation main can send it', () => {
    for (const operation of ALL) {
      const quote = transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx)
      expect(quote.feeCredits, operation).toBeGreaterThan(0n)
    }
  })

  it('marks everything but a shield as metered, since only the pool fee is exact', () => {
    for (const operation of ALL) {
      const {metered} = transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx)
      expect(metered, operation).toBe(operation !== 'shield' && operation !== 'assetLockShield')
    }
  })

  // The two counts main supplies are the whole reason a quote cannot be a
  // constant: each extra input and each extra output costs again.
  it('charges for every input', () => {
    const feeAt = (inputCount: number): bigint =>
      transitionFee({operation: 'addressFundsTransfer', params: params({inputCount, recipient: PLATFORM_ADDRESS})}, ctx).feeCredits
    expect(feeAt(2)).toBeGreaterThan(feeAt(1))
    expect(feeAt(3) - feeAt(2)).toBe(feeAt(2) - feeAt(1))
  })

  it('charges for every recipient', () => {
    const feeAt = (count: number): bigint => transitionFee({
      operation: 'identityToAddress',
      params: params({recipient: Array.from({length: count}, (_, i) => platformAddress(i))}),
    }, ctx).feeCredits
    expect(feeAt(2)).toBeGreaterThan(feeAt(1))
    expect(feeAt(3) - feeAt(2)).toBe(feeAt(2) - feeAt(1))
  })

  // The transition keys its outputs by address, so paying one address twice is
  // one output. Passing the real addresses is what makes the quote match; a
  // count would have over-charged for the duplicate.
  it('prices a repeated address as the single output it becomes', () => {
    const once = transitionFee({operation: 'identityToAddress', params: params({recipient: [PLATFORM_ADDRESS]})}, ctx)
    const twice = transitionFee({
      operation: 'identityToAddress',
      params: params({recipient: [PLATFORM_ADDRESS, PLATFORM_ADDRESS]}),
    }, ctx)
    expect(twice.feeCredits).toBe(once.feeCredits)
  })

  // A bare string is one recipient; nothing has to say so separately.
  it('prices a single recipient the same whether it is a string or a list of one', () => {
    const asString = transitionFee({operation: 'identityToAddress', params: params({recipient: PLATFORM_ADDRESS})}, ctx)
    const asList = transitionFee({operation: 'identityToAddress', params: params({recipient: [PLATFORM_ADDRESS]})}, ctx)
    expect(asString.feeCredits).toBe(asList.feeCredits)
  })

  // Measured across the u64 range: the placeholder costs nothing in accuracy,
  // and saves a proved gRPC round trip on every keystroke.
  it('prices identity transitions the same whatever the real nonce would be', () => {
    for (const operation of ['identityToAddress', 'identityToIdentity', 'identityWithdrawal'] as TransitionFeeOperation[]) {
      const feeAt = (identityNonce: bigint): bigint => ctx.sdk.identities
        .createStateTransition('creditTransfer', {
          identityId: IDENTITY, recipientId: IDENTITY, amount: params().amountCredits, identityNonce,
        }).calculateMinRequiredFee()

      expect(feeAt(1n)).toBe(feeAt(2n ** 40n))
      expect(transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx).feeCredits, operation)
        .toBeGreaterThan(0n)
    }
  })

  // The other two stand-ins an address-funded quote carries. A real nonce costs
  // a round trip and real credits are not known until the selection runs, so
  // this is what says neither has to be waited for.
  it('prices an address-funded transition the same whatever its inputs hold', () => {
    const feeAt = (nonce: number, credits: bigint): bigint => ctx.sdk.platformAddresses
      .createStateTransition('identityTopUpFromAddresses', {
        identityId: IDENTITY,
        inputs: [new InputAddressWASM(PlatformAddressWASM.fromBytes(new Uint8Array(21)), nonce, credits)],
        feeStrategy: DEDUCT_FROM_FIRST,
        inputWitness: [],
        userFeeIncrease: 0,
      }).calculateMinRequiredFee()

    expect(feeAt(1, 1_000_000n)).toBe(feeAt(0, 1n))
    expect(feeAt(1, 1_000_000n)).toBe(feeAt(2 ** 31, 2n ** 62n))
  })

  // The L2 half of an L1 -> L2 transfer. Quoted before any coins are committed,
  // so it is priced against a placeholder proof rather than the real one.
  it('prices the transition an asset lock proof will fund, not only the lock', () => {
    for (const operation of ['assetLockFunding', 'assetLockShield', 'identityRegister', 'identityTopUpL1'] as TransitionFeeOperation[]) {
      const quote = transitionFee({operation, params: params({recipient: RECIPIENT[operation]})}, ctx)
      expect(quote.feeCredits, operation).toBeGreaterThan(0n)
    }
  })

  // The quote is asked for before any lock exists, so it prices a placeholder
  // chain proof while the wallet usually settles on an instant one, which is
  // several hundred bytes larger. This is what says the substitution is free.
  it.each([1, 2, 5])('prices an identity registration over a %i-input instant lock the same', (inputCount) => {
    const tx = assetLockTransaction(inputCount)
    const islock = new InstantLock(
      1,
      Array.from({length: inputCount}, (_, i) => new OutPoint(FUNDING_TXID, i)),
      tx.hash(),
      '22'.repeat(32),
      '33'.repeat(96),
    )

    const overInstantProof = ctx.sdk.identities.createStateTransition('create', {
      publicKeys: IDENTITY_KEY_DEFINITIONS.map(({id, purpose, securityLevel, keyType}) => ({
        id, purpose, securityLevel, keyType, readOnly: false, data: FEE_QUOTE_PUBLIC_KEY,
      })),
      assetLockProof: {type: 'instantLock', transaction: tx.hex(), instantLock: islock.hex(), outputIndex: 0},
    }).calculateMinRequiredFee()

    expect(transitionFee({operation: 'identityRegister', params: params({recipient: ''})}, ctx).feeCredits)
      .toBe(overInstantProof)
  })
})
