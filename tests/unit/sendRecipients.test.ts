import {bech32m, createBase58check} from '@scure/base'
import {sha256} from '@noble/hashes/sha2.js'
import {describe, expect, it} from 'vitest'
import type {PlatformSpendSource} from '../../src/renderer/src/api/types'
import {DestinationKind} from '../../src/renderer/src/enums/DestinationKind'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import type {SendRecipientDraft} from '../../src/renderer/src/types/SendDraft'
import type {SendRecipientValidation} from '../../src/renderer/src/types/SendRecipients'
import {dashToDuffs} from '../../src/renderer/src/utils/balance'
import {
  orderPlatformRecipients,
  recipientAllocationBudget,
  recipientPercent,
  recipientRemainingDuffs,
  recipientSliderAmount,
  recipientTotalDuffs,
  splitRecipientTotal,
  validateSendRecipients,
  withOutputFee,
} from '../../src/renderer/src/utils/sendRecipients'

function platformAddress(type: number, hash: number, prefix = 'tdash'): string {
  return bech32m.encode(prefix, bech32m.toWords(Uint8Array.from([type, ...Array(20).fill(hash)])))
}

function recipient(id: string, amount: string, address = platformAddress(0xb0, 1)): SendRecipientDraft {
  return {id, address, amount}
}

function validation(recipients: SendRecipientDraft[], overrides: Partial<SendRecipientValidation> = {}): SendRecipientValidation {
  return {
    recipients,
    operation: TransferOperation.AddressFundsTransfer,
    destination: DestinationKind.PlatformAddress,
    network: 'testnet',
    fundingAddresses: [],
    feeRecipientId: null,
    feeCredits: null,
    ...overrides,
  }
}

describe('recipient allocation', () => {
  it('allows allocation before addresses are complete and while a fee quote is pending', () => {
    const rows = [recipient('a', '', ''), recipient('b', '1', '')]
    const budget = recipientAllocationBudget(500_000_000n, null, false)
    expect(budget).toBe(500_000_000n)
    expect(recipientSliderAmount(rows, 'a', budget!, 50)).toBe('2.5')
    expect(recipientAllocationBudget(500_000_000n, 499_999_000n, false)).toBe(500_000_000n)
    expect(recipientAllocationBudget(500_000_000n, 499_999_000n, true)).toBe(499_999_000n)
  })

  it('does not enable allocation for missing funds or use a quote above the source balance', () => {
    expect(recipientAllocationBudget(null, 100n, true)).toBeNull()
    expect(recipientAllocationBudget(0n, 100n, true)).toBe(0n)
    expect(recipientAllocationBudget(50n, 100n, true)).toBe(50n)
    expect(recipientAllocationBudget(50n, 0n, true)).toBe(0n)
  })

  it('splits a total above the safe Number range without losing a duff', () => {
    const recipients = [recipient('a', '90071992.54740993'), recipient('b', '0'), recipient('c', '0')]
    const split = splitRecipientTotal(recipients)

    expect(recipientTotalDuffs(split)).toBe(9007199254740993n)
    expect(split.map(entry => dashToDuffs(entry.amount))).toEqual([
      3002399751580331n, 3002399751580331n, 3002399751580331n,
    ])
    expect(recipients[0].amount).toBe('90071992.54740993')
    expect(split.map(entry => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('preserves an indivisible total and existing recipient addresses', () => {
    const recipients = [recipient('a', '0.00000005'), recipient('b', '0', platformAddress(0xb0, 2))]
    const split = splitRecipientTotal(recipients)
    expect(split.map(entry => entry.amount)).toEqual(['0.00000002', '0.00000003'])
    expect(split.map(entry => entry.address)).toEqual(recipients.map(entry => entry.address))
    expect(splitRecipientTotal([])).toEqual([])
  })

  it('limits a slider to remaining budget without redistributing other rows', () => {
    const recipients = [recipient('a', '1'), recipient('b', '7')]
    const snapshot = structuredClone(recipients)
    expect(recipientRemainingDuffs(recipients, 'a', 1_000_000_000n)).toBe(300_000_000n)
    expect(recipientSliderAmount(recipients, 'a', 1_000_000_000n, 90)).toBe('3')
    expect(recipientSliderAmount(recipients, 'a', 1_000_000_000n, 20)).toBe('2')
    expect(recipients).toEqual(snapshot)
  })

  it('clamps percentages and exhausted budgets', () => {
    const recipients = [recipient('a', '1'), recipient('b', '7')]
    expect(recipientSliderAmount(recipients, 'a', 1_000_000_000n, -30)).toBe('0')
    expect(recipientSliderAmount(recipients, 'a', 1_000_000_000n, 130)).toBe('3')
    expect(recipientSliderAmount(recipients, 'a', 600_000_000n, 100)).toBe('0')
    expect(recipientRemainingDuffs(recipients, 'a', 0n)).toBe(0n)
    expect(recipientPercent(9007199254740993n, 18014398509481986n)).toBe(50)
    expect(recipientPercent(3n, 2n)).toBe(100)
    expect(recipientPercent(3n, null)).toBe(0)
    expect(recipientPercent(3n, 0n)).toBe(0)
  })
})

describe('Platform output fee selection', () => {
  it('orders canonical P2PKH bytes before P2SH despite reversed encoded type bytes', () => {
    const recipients = [
      recipient('script', '1', platformAddress(0x80, 0)),
      recipient('key-high', '2', platformAddress(0xb0, 255).toUpperCase()),
      recipient('key-low', '3', ` ${platformAddress(0xb0, 1)} `),
    ]
    const ordered = orderPlatformRecipients(recipients)
    expect(ordered.map(entry => entry.id)).toEqual(['key-low', 'key-high', 'script'])
    expect(ordered.map(entry => entry.amount)).toEqual(['3', '2', '1'])
    expect(ordered[1].address).toBe(platformAddress(0xb0, 255))
    expect(recipients[0].id).toBe('script')
  })

  it('keeps the payer attached to its recipient when rows are reordered or removed', () => {
    const source: PlatformSpendSource = {
      kind: 'inputs',
      inputs: [{address: platformAddress(0xb0, 9), credits: 9007199254740993n}],
      feeStrategy: [{kind: 'deductFromInput', address: platformAddress(0xb0, 9)}],
    }
    const recipients = [
      recipient('payer', '2', platformAddress(0x80, 0)),
      recipient('other', '3', platformAddress(0xb0, 1)),
    ]
    const feeSource = (rows: SendRecipientDraft[]) =>
      withOutputFee(source, orderPlatformRecipients(rows).findIndex(entry => entry.id === 'payer'))

    expect(feeSource(recipients)).toMatchObject({feeStrategy: [{kind: 'reduceOutput', index: 1}]})
    expect(feeSource([...recipients].reverse())).toEqual(feeSource(recipients))
    expect(feeSource(recipients.filter(entry => entry.id !== 'other'))).toMatchObject({feeStrategy: [{kind: 'reduceOutput', index: 0}]})
    expect(feeSource(recipients.filter(entry => entry.id !== 'payer'))).toEqual(source)
    expect(source.feeStrategy).toEqual([{kind: 'deductFromInput', address: platformAddress(0xb0, 9)}])
    expect(withOutputFee(null, 0)).toBeNull()
    expect(withOutputFee({kind: 'address', address: 'source'}, 0)).toEqual({kind: 'address', address: 'source'})
    expect(withOutputFee(source, undefined)).toBe(source)
  })

  it('leaves an incomplete address draft intact until it can be ordered', () => {
    const recipients = [recipient('incomplete', '1', 'tdash1'), recipient('valid', '2')]
    expect(orderPlatformRecipients(recipients)).toBe(recipients)
  })
})

describe('recipient validation', () => {
  it('rejects case-insensitive duplicate Platform recipients and funding collisions', () => {
    const address = platformAddress(0xb0, 1)
    const duplicate = validateSendRecipients(validation([
      recipient('a', '1', address), recipient('b', '2', ` ${address.toUpperCase()} `),
    ]))
    expect(duplicate[0].address).toBeNull()
    expect(duplicate[1].address).toMatch(/only once/)
    expect(validateSendRecipients(validation([recipient('a', '1', address)], {
      fundingAddresses: [address.toUpperCase()],
    }))[0].address).toMatch(/funding address/)
  })

  it('checks the selected payer minimum after fees down to the credit', () => {
    const recipients = [recipient('payer', '0.000006'), recipient('other', '0.000005', platformAddress(0xb0, 2))]
    const atMinimum = validateSendRecipients(validation(recipients, {feeRecipientId: 'payer', feeCredits: 100_000n}))
    expect(atMinimum).toEqual([{address: null, amount: null}, {address: null, amount: null}])
    const belowMinimum = validateSendRecipients(validation(recipients, {feeRecipientId: 'payer', feeCredits: 100_001n}))
    expect(belowMinimum[0].amount).toMatch(/after fees/)
    expect(belowMinimum[1].amount).toBeNull()
    expect(validateSendRecipients(validation(recipients, {feeRecipientId: null, feeCredits: 900_000n}))[0].amount).toBeNull()
  })

  it('rejects mixed-case Platform encodings before canonicalizing their address', () => {
    const address = platformAddress(0xb0, 1)
    const mixed = address.replace('tdash', 'tDash')
    expect(validateSendRecipients(validation([recipient('a', '1', mixed)]))[0].address).not.toBeNull()
    expect(orderPlatformRecipients([recipient('a', '1', mixed)])[0].address).toBe(mixed)
  })

  it.each(['', '.', '0', '-1', '1e2', '1,5', '1.2.3', 'NaN', ' 1 ', '0.000000001'])('rejects malformed or zero amount %s', amount => {
    expect(validateSendRecipients(validation([recipient('a', amount)]))[0].amount).not.toBeNull()
  })

  it('validates destination network and Core dust separately from Platform minimum', () => {
    expect(validateSendRecipients(validation([recipient('a', '1', platformAddress(0xb0, 1, 'dash'))]))[0].address).not.toBeNull()
    const coreAddress = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(1)]))
    const core = {operation: TransferOperation.CoreSend, destination: DestinationKind.CoreAddress}
    expect(validateSendRecipients(validation([recipient('a', '0.00000545', coreAddress)], core))[0].amount).toMatch(/Minimum/)
    expect(validateSendRecipients(validation([recipient('a', '0.00000546', coreAddress)], core))[0]).toEqual({address: null, amount: null})
    expect(validateSendRecipients(validation([recipient('a', '0.000005')]))[0].amount).toBeNull()
    expect(validateSendRecipients(validation([recipient('a', '0.00000499')]))[0].amount).toMatch(/at least/)
  })
})
