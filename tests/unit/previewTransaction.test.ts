import {describe, it, expect, vi} from 'vitest'
import {Script} from 'dash-core-sdk'
import {FeeService} from '../../src/main/src/services/wallet/FeeService'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {PlatformAddressService} from '../../src/main/src/services/platform/PlatformAddressService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {Preferences} from '../../src/main/src/preferences'
import {UTXO} from '../../src/main/src/types/UTXO'
import {PlatformSourceCandidate} from '../../src/main/src/types/PlatformTransfer'
import {PreviewEntry, PreviewParams} from '../../src/main/src/types/TransactionPreview'
import {ShieldedSpendPlan, ShieldedSyncState} from '../../src/main/src/types/Shielded'
import {FeeQuoteParams} from '../../src/main/platform/types/messages'
import {coreFeeDuffsFor} from '../../src/main/src/utils/coreFeeRate'
import {lockedDuffsFor} from '../../src/main/src/utils/assetLockTx'
import {ASSET_LOCK_PAYLOAD_BYTES, DUST_THRESHOLD_DUFFS} from '../../src/main/src/constants/chain'
import {
  CREDITS_PER_DUFF,
  DEFAULT_CORE_FEE_MULTIPLIER,
  DEFAULT_PLATFORM_FEE_MULTIPLIER,
} from '../../src/main/src/constants/credits'

const WALLET = 'w1'
const IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'
const RECEIVING = 'yPx8DNt1oQt3yubB2Sh73vAQRQ1AoyyLCS'
const CHANGE = 'yWc2Zk1p5RVWNyCUgNBSGvhqvBhqxJ2rrN'
const CREDIT = 'yTgSPRhJ3XCbTKaebeFrJnrTNKUEmoLLGa'
const EXTERNAL = 'yUCBc5wgtnJgvsCiQeDpZKqM8n8vP4B4bB'
const TO = 'yZ2rLVczRqPa1RmYcVQFbDPTvcJgBaeGGB'
const PLATFORM_A = 'tdash1qplatformaaa'
const PLATFORM_B = 'tdash1qplatformbbb'
const SHIELDED = 'tdash1shieldedrecipient'

const ONE_DASH = 100_000_000n
const BASE_FEE = 1_000_000n
const METERED_FEE = BASE_FEE * BigInt(DEFAULT_PLATFORM_FEE_MULTIPLIER)

const coreFee = (inputsCount: number, outputsCount: number): bigint =>
  coreFeeDuffsFor(DEFAULT_CORE_FEE_MULTIPLIER, inputsCount, outputsCount, true)
const assetLockFee = (inputsCount: number): bigint =>
  coreFeeDuffsFor(DEFAULT_CORE_FEE_MULTIPLIER, inputsCount, 1, true, ASSET_LOCK_PAYLOAD_BYTES)

const txid = (index: number): string => `${index}`.padStart(64, '0')

function utxo(satoshis: bigint, index: number): UTXO {
  return {address: RECEIVING, txId: txid(index), vOut: 0, satoshis, script: new Script(), height: 1}
}

function candidate(platformAddress: string, balanceCredits: bigint, hashByte: number): PlatformSourceCandidate {
  const addressBytes = new Uint8Array(21)
  addressBytes[1] = hashByte
  return {platformAddress, addressBytes, index: 0, balanceCredits, nonce: 0}
}

const total = (entries: PreviewEntry[]): bigint =>
  entries.reduce((sum, entry) => sum + entry.amount, 0n)

function service(options: {utxos?: UTXO[]; candidates?: PlatformSourceCandidate[]; plan?: ShieldedSpendPlan} = {}) {
  const request = vi.fn(async () => ({feeCredits: BASE_FEE, metered: true}))
  const planSpend = vi.fn(async () => options.plan)
  const ensureReady = vi.fn(async () => {})

  const walletDAO = {getWalletById: async () => ({walletId: WALLET, network: 'testnet'})}
  const addressDAO = {
    getAddressesByWalletId: async () => ({
      receiving: [{address: RECEIVING, derivationPath: "m/44'/1'/0'/0/0", isUsed: true}],
      change: [
        {address: CHANGE, derivationPath: "m/44'/1'/0'/1/0", isUsed: false},
        {address: CREDIT, derivationPath: "m/44'/1'/0'/1/1", isUsed: false},
      ],
    }),
  }
  const providers = {forWallet: () => ({ensureReady, getWalletUtxos: async () => options.utxos ?? []})}

  const svc = new FeeService(
    walletDAO as unknown as WalletDAO,
    addressDAO as unknown as AddressDAO,
    {loadCandidates: async () => options.candidates ?? []} as unknown as PlatformAddressService,
    {request} as unknown as PlatformWorkerService,
    {planSpend} as unknown as ShieldedService,
    providers as unknown as WalletProviderFactory,
    Preferences.default(),
  )

  return {svc, request, planSpend, ensureReady}
}

function params(overrides: Partial<PreviewParams> = {}): PreviewParams {
  return {
    amountCredits: 0n,
    recipients: [{address: TO, amount: ONE_DASH / 2n}],
    platformSource: null,
    coreSource: null,
    identityId: null,
    shieldedSource: null,
    ...overrides,
  }
}

const quoteParams = (request: ReturnType<typeof vi.fn>): FeeQuoteParams =>
  (request.mock.calls[0][2] as {params: FeeQuoteParams}).params

describe('previewTransaction — Core sends', () => {
  it('names the coins the send will spend and what each one holds', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH / 4n, 1), utxo(ONE_DASH, 2)]})

    const preview = await svc.previewTransaction(WALLET, 'coreSend', params())

    expect(preview.inputs).toEqual([
      {role: 'input', address: RECEIVING, amount: ONE_DASH, unit: 'duffs', reference: `${txid(2)}:0`},
    ])
    expect(preview.outputs).toEqual([
      {role: 'recipient', address: TO, amount: ONE_DASH / 2n, unit: 'duffs', reference: null},
      {role: 'change', address: CHANGE, amount: ONE_DASH / 2n - coreFee(1, 1), unit: 'duffs', reference: null},
    ])
    expect(preview.feeDuffs).toBe(coreFee(1, 1))
    expect(preview.feeCredits).toBeNull()
  })

  it('prices the transaction the quote priced, over the same coins', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH, 1)]})
    const recipients = [{address: TO, amount: ONE_DASH / 4n}, {address: EXTERNAL, amount: ONE_DASH / 4n}]

    const preview = await svc.previewTransaction(WALLET, 'coreSend', params({recipients}))
    const quote = await svc.estimateFee(WALLET, 'coreSend', {
      amountCredits: 0n,
      amountDuffs: ONE_DASH / 2n,
      recipient: recipients.map(recipient => recipient.address),
    })

    expect(preview.feeDuffs).toBe(quote.feeDuffs)
    expect(total(preview.inputs) - total(preview.outputs)).toBe(preview.feeDuffs)
  })

  // The builder writes no output below the dust threshold, so what it would
  // have held is paid to the miner and belongs in the fee a review shows.
  it('reports change too small to write as fee', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH, 1)]})
    const dust = DUST_THRESHOLD_DUFFS - 1n
    const amount = ONE_DASH - coreFee(1, 1) - dust

    const preview = await svc.previewTransaction(WALLET, 'coreSend', params({recipients: [{address: TO, amount}]}))

    expect(preview.outputs.map(output => output.role)).toEqual(['recipient'])
    expect(preview.feeDuffs).toBe(coreFee(1, 1) + dust)
    expect(total(preview.inputs) - total(preview.outputs)).toBe(preview.feeDuffs)
  })

  it('sends change to the address the caller named', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH, 1)]})

    const preview = await svc.previewTransaction(WALLET, 'coreSend', params({changeTo: EXTERNAL}))

    expect(preview.outputs[1]).toMatchObject({role: 'change', address: EXTERNAL})
  })

  it('spends exactly the coins a pick names', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH / 4n, 1), utxo(ONE_DASH, 2)]})

    const preview = await svc.previewTransaction(WALLET, 'coreSend', params({
      coreSource: {kind: 'outpoints', outpoints: [{txid: txid(1), vout: 0}, {txid: txid(2), vout: 0}]},
    }))

    expect(preview.inputs.map(input => input.reference)).toEqual([`${txid(1)}:0`, `${txid(2)}:0`])
    expect(preview.feeDuffs).toBe(coreFee(2, 1))
  })

  // Nothing is signed, so the refusal has to be the send's own — a preview that
  // answered anyway would review a transaction that cannot be made.
  it('refuses an amount the coins cannot fund', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH / 4n, 1)]})

    await expect(svc.previewTransaction(WALLET, 'coreSend', params()))
      .rejects.toThrow('Insufficient funds to cover amount and network fee')
  })

  it('refuses an output below the dust threshold', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH, 1)]})

    await expect(svc.previewTransaction(WALLET, 'coreSend', params({recipients: [{address: TO, amount: 100n}]})))
      .rejects.toThrow('Minimum amount per recipient')
  })
})

describe('previewTransaction — asset locks', () => {
  it('locks the amount plus the L2 fee, and shows the credit output that funds it', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH, 1)]})
    const amountDuffs = ONE_DASH / 2n

    const preview = await svc.previewTransaction(WALLET, 'assetLockFunding', params({
      recipients: [{address: PLATFORM_A, amount: amountDuffs}],
    }))

    const lockDuffs = lockedDuffsFor(amountDuffs, METERED_FEE)
    expect(preview.outputs).toEqual([
      {role: 'recipient', address: PLATFORM_A, amount: amountDuffs, unit: 'duffs', reference: null},
      {role: 'credit', address: CREDIT, amount: lockDuffs, unit: 'duffs', reference: null},
      {role: 'change', address: CHANGE, amount: ONE_DASH - lockDuffs - assetLockFee(1), unit: 'duffs', reference: null},
    ])
    expect(preview.feeDuffs).toBe(assetLockFee(1))
    expect(preview.feeCredits).toBe(METERED_FEE)
  })

  // The funding prices its transition against the credits the lock will create,
  // which is what the send does — an L1 form carries no amount in credits.
  it('quotes the L2 half against the credits the lock creates', async () => {
    const {svc, request} = service({utxos: [utxo(ONE_DASH, 1)]})

    await svc.previewTransaction(WALLET, 'identityRegister', params({
      recipients: [{address: '', amount: ONE_DASH / 2n}],
    }))

    expect(quoteParams(request).amountCredits).toBe(ONE_DASH / 2n * CREDITS_PER_DUFF)
  })
})

describe('previewTransaction — platform addresses', () => {
  it('marks the input consensus charges the fee to', async () => {
    const {svc} = service({candidates: [candidate(PLATFORM_A, 10_000_000n, 1)]})

    const preview = await svc.previewTransaction(WALLET, 'addressFundsTransfer', params({
      amountCredits: 1_000_000n,
      recipients: [{address: PLATFORM_B, amount: 1_000_000n}],
    }))

    expect(preview.inputs).toEqual([
      {role: 'feeInput', address: PLATFORM_A, amount: 1_000_000n + METERED_FEE, unit: 'credits', reference: null},
    ])
    expect(preview.outputs).toEqual([
      {role: 'recipient', address: PLATFORM_B, amount: 1_000_000n, unit: 'credits', reference: null},
    ])
    expect(preview.feeCredits).toBe(METERED_FEE)
    expect(preview.feeDuffs).toBeNull()
  })

  // A fee taken out of an output is a recipient paid less than the caller named,
  // which is the whole reason to look before signing.
  it('shows the recipient a fee is taken out of paid less', async () => {
    const {svc} = service({candidates: [candidate(PLATFORM_A, 10_000_000n, 1)]})
    const recipients = [{address: PLATFORM_B, amount: 1_000_000n}, {address: SHIELDED, amount: 2_000_000n}]

    const preview = await svc.previewTransaction(WALLET, 'addressFundsTransfer', params({
      amountCredits: 3_000_000n,
      recipients,
      platformSource: {
        kind: 'inputs',
        inputs: [{address: PLATFORM_A, credits: 3_000_000n}],
        feeStrategy: [{kind: 'reduceOutput', index: 1}],
      },
    }))

    expect(preview.outputs.map(output => output.amount)).toEqual([1_000_000n, 2_000_000n - METERED_FEE])
    expect(preview.inputs.map(input => input.role)).toEqual(['input'])
  })

  it('refuses a transfer the addresses cannot fund', async () => {
    const {svc} = service({candidates: [candidate(PLATFORM_A, 1_000_000n, 1)]})

    await expect(svc.previewTransaction(WALLET, 'addressFundsTransfer', params({
      amountCredits: 900_000_000n,
      recipients: [{address: PLATFORM_B, amount: 900_000_000n}],
    }))).rejects.toThrow('do not hold enough credits')
  })
})

describe('previewTransaction — identities and the pool', () => {
  it('draws the amount and the fee from the identity that funds it', async () => {
    const {svc} = service()

    const preview = await svc.previewTransaction(WALLET, 'identityToAddress', params({
      amountCredits: 1_000_000n,
      identityId: IDENTITY,
      recipients: [{address: PLATFORM_A, amount: 1_000_000n}],
    }))

    expect(preview.inputs).toEqual([
      {role: 'input', address: IDENTITY, amount: 1_000_000n + METERED_FEE, unit: 'credits', reference: null},
    ])
    expect(preview.outputs).toEqual([
      {role: 'recipient', address: PLATFORM_A, amount: 1_000_000n, unit: 'credits', reference: null},
    ])
  })

  it('names the platform address a shield spends', async () => {
    const {svc} = service({candidates: [candidate(PLATFORM_A, 2_000_000n, 1), candidate(PLATFORM_B, 90_000_000n, 2)]})

    const preview = await svc.previewTransaction(WALLET, 'shield', params({
      amountCredits: 1_000_000n,
      fromAddress: PLATFORM_B,
      recipients: [{address: SHIELDED, amount: 1_000_000n}],
    }))

    expect(preview.inputs).toEqual([
      {role: 'input', address: PLATFORM_B, amount: 1_000_000n + METERED_FEE, unit: 'credits', reference: null},
    ])
  })

  it('returns what the notes hold beyond the payout and the fee to the pool', async () => {
    const plan: ShieldedSpendPlan = {
      notes: [{index: 3, address: SHIELDED, amountCredits: 10_000_000n}],
      feeCredits: 400_000n,
      totalCredits: 10_000_000n,
    }
    const {svc, planSpend} = service({plan})

    const preview = await svc.previewTransaction(WALLET, 'shieldedTransfer', params({
      amountCredits: 1_000_000n,
      recipients: [{address: SHIELDED, amount: 1_000_000n}],
      shieldedSource: {kind: 'notes', noteIndexes: [3]},
    }))

    expect(planSpend).toHaveBeenCalledWith(WALLET, 'shieldedTransfer', 1_000_000n, {kind: 'notes', noteIndexes: [3]}, 1)
    expect(preview.inputs).toEqual([
      {role: 'input', address: SHIELDED, amount: 10_000_000n, unit: 'credits', reference: 'note 3'},
    ])
    expect(preview.outputs).toEqual([
      {role: 'recipient', address: SHIELDED, amount: 1_000_000n, unit: 'credits', reference: null},
      {role: 'change', address: '', amount: 10_000_000n - 1_000_000n - 400_000n, unit: 'credits', reference: null},
    ])
    expect(preview.feeCredits).toBe(400_000n)
  })

  // The denomination funds the identity and the fee together, so the fee is not
  // charged beside it a second time.
  it('creates an identity worth the denomination less the fee', async () => {
    const plan: ShieldedSpendPlan = {
      notes: [{index: 1, address: SHIELDED, amountCredits: 8_000_000n}],
      feeCredits: 500_000n,
      totalCredits: 8_000_000n,
    }
    const {svc} = service({plan})

    const preview = await svc.previewTransaction(WALLET, 'identityCreateFromShielded', params({
      amountCredits: 2_000_000n,
      recipients: [{address: '', amount: 2_000_000n}],
    }))

    expect(preview.outputs).toEqual([
      {role: 'recipient', address: '', amount: 1_500_000n, unit: 'credits', reference: null},
      {role: 'change', address: '', amount: 6_000_000n, unit: 'credits', reference: null},
    ])
    expect(total(preview.inputs) - total(preview.outputs)).toBe(preview.feeCredits)
  })
})

describe('previewTransaction — refusals a send would make', () => {
  it('rejects coin control on an operation L1 does not fund', async () => {
    const {svc} = service()

    await expect(svc.previewTransaction(WALLET, 'identityToAddress', params({
      identityId: IDENTITY,
      coreSource: {kind: 'address', address: RECEIVING},
    }))).rejects.toThrow('Coin control applies to L1-funded operations only')
  })

  it('rejects picked platform inputs on a Core send', async () => {
    const {svc} = service({utxos: [utxo(ONE_DASH, 1)]})

    await expect(svc.previewTransaction(WALLET, 'coreSend', params({
      platformSource: {kind: 'address', address: PLATFORM_A},
    }))).rejects.toThrow('Input selection applies to address-funded operations only')
  })

  it('needs the identity that funds an identity-paid transition', async () => {
    const {svc} = service()

    await expect(svc.previewTransaction(WALLET, 'identityWithdrawal', params({amountCredits: 1_000_000n})))
      .rejects.toThrow('needs the identity that funds it')
  })
})

describe('ShieldedService.planSpend', () => {
  function shielded(notes: ShieldedSyncState['notes'], curve: bigint[]) {
    const walletDAO = {getWalletById: async () => ({walletId: WALLET, network: 'testnet'})}
    const request = vi.fn(async () => ({feeCredits: curve}))
    const svc = new ShieldedService(
      walletDAO as never, null as never, null as never, null as never, null as never,
      {request} as never, null as never, Preferences.default(),
    )
    // Written by the sync path only; a plan reads whatever it last held.
    ;(svc as unknown as {syncStates: Map<string, ShieldedSyncState>}).syncStates.set(WALLET, {
      phase: 'done', fetched: notes.length, total: notes.length, balance: null, notes, error: null, syncedAt: 1,
    })
    return svc
  }

  const note = (index: number, amount: bigint, spent = false) =>
    ({index, amount, spent, address: `${SHIELDED}${index}`})

  it('reports the notes it picked, with the address each was received at', async () => {
    const svc = shielded([note(1, 3_000_000n), note(2, 9_000_000n)], [100n, 200n, 300n, 400n])

    const plan = await svc.planSpend(WALLET, 'shieldedTransfer', 1_000_000n, null)

    expect(plan.notes).toEqual([{index: 2, address: `${SHIELDED}2`, amountCredits: 9_000_000n}])
    expect(plan.totalCredits).toBe(9_000_000n)
    expect(plan.feeCredits).toBeGreaterThan(0n)
  })

  it('skips notes already spent', async () => {
    const svc = shielded([note(1, 9_000_000n, true), note(2, 4_000_000n)], [100n, 200n, 300n, 400n])

    const plan = await svc.planSpend(WALLET, 'unshield', 1_000_000n, null)

    expect(plan.notes.map(picked => picked.index)).toEqual([2])
  })

  it('refuses an amount the notes cannot cover instead of quoting a floor', async () => {
    const svc = shielded([note(1, 100_000n)], [100n, 200n, 300n, 400n])

    await expect(svc.planSpend(WALLET, 'unshield', 5_000_000n, null))
      .rejects.toThrow('the most spendable now is')
  })
})
