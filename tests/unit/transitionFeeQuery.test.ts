import { describe, it, expect } from 'vitest'
import { feeQueryFor, feeQueryKey } from '../../src/renderer/src/utils/transitionFeeQuery'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import { CoreFeeShape } from '../../src/renderer/src/enums/CoreFeeShape'
import { FeeEndpoint } from '../../src/renderer/src/enums/FeeEndpoint'
import { PlatformAddressDto, TransitionFeeParams } from '../../src/renderer/src/api/types'

const SOURCE: PlatformAddressDto = {
  platformAddress: 'tdash1qsource',
  balanceCredits: 900_000_000n,
  nonce: 7,
}

const IDENTITY = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

const ASSET_LOCK_OPERATIONS = [
  TransferOperation.AssetLockFunding,
  TransferOperation.AssetLockShield,
  TransferOperation.IdentityRegister,
  TransferOperation.IdentityTopUpL1,
]

const DASH_OPERATIONS = [TransferOperation.CoreSend, ...ASSET_LOCK_OPERATIONS]

function params(overrides: Partial<TransitionFeeParams> = {}): TransitionFeeParams {
  return {
    destinationValid: true,
    recipient: 'tdash1qrecipient',
    amountCredits: 1_000_000n,
    amountDuffs: 0n,
    fromAddress: null,
    source: SOURCE,
    identityId: IDENTITY,
    ...overrides,
  }
}

describe('feeQueryKey', () => {
  it('serialises a bigint amount instead of throwing on it', () => {
    const query = feeQueryFor(TransferOperation.IdentityToIdentity, params({recipient: IDENTITY}))!
    expect(feeQueryKey(query.query)).toContain('"amountCredits":"1000000"')
  })

  it('separates queries that differ only in amount', () => {
    const one = feeQueryFor(TransferOperation.IdentityWithdrawal, params({amountCredits: 1n}))!
    const two = feeQueryFor(TransferOperation.IdentityWithdrawal, params({amountCredits: 2n}))!
    expect(feeQueryKey(one.query)).not.toBe(feeQueryKey(two.query))
  })

  it('is stable across equal queries', () => {
    expect(feeQueryKey(feeQueryFor(TransferOperation.AddressFundsTransfer, params())!.query))
      .toBe(feeQueryKey(feeQueryFor(TransferOperation.AddressFundsTransfer, params())!.query))
  })

  it('separates core queries that differ only in amount', () => {
    const one = feeQueryFor(TransferOperation.CoreSend, params({amountDuffs: 1n}))!
    const two = feeQueryFor(TransferOperation.CoreSend, params({amountDuffs: 2n}))!
    expect(feeQueryKey(one.query)).not.toBe(feeQueryKey(two.query))
  })
})

describe('feeQueryFor', () => {
  it('prices an address transfer from one input to the recipient', () => {
    expect(feeQueryFor(TransferOperation.AddressFundsTransfer, params())).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'addressTransfer',
        inputCount: 1,
        recipients: ['tdash1qrecipient'],
      },
    })
  })

  it('prices an address withdrawal with change and no recipient', () => {
    expect(feeQueryFor(TransferOperation.AddressWithdrawal, params())).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'addressWithdrawal',
        inputCount: 1,
        hasChange: true,
      },
    })
  })

  it('prices a shield with no transparent destination', () => {
    expect(feeQueryFor(TransferOperation.Shield, params())).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'shield',
        noteCount: 1,
        inputCount: 1,
        fromAssetLock: false,
        surplusAddress: null,
      },
    })
  })

  it('prices an identity top-up from the source address', () => {
    expect(feeQueryFor(TransferOperation.IdentityTopUp, params({recipient: IDENTITY}))).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'identityTopUpFromAddresses',
        identityId: IDENTITY,
        inputs: [{platformAddress: SOURCE.platformAddress, index: 0, nonce: 7, credits: 1_000_000n}],
      },
    })
  })

  it('prices an identity creation from the source address', () => {
    expect(feeQueryFor(TransferOperation.IdentityCreate, params())).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'identityCreateFromAddresses',
        inputs: [{platformAddress: SOURCE.platformAddress, index: 0, nonce: 7, credits: 1_000_000n}],
      },
    })
  })

  it('passes the nonce through untouched', () => {
    const query = feeQueryFor(TransferOperation.IdentityCreate, params({source: {...SOURCE, nonce: 0}}))
    expect(query).toMatchObject({query: {inputs: [{nonce: 0}]}})
  })

  it('prices identity credits to a platform address', () => {
    expect(feeQueryFor(TransferOperation.IdentityToAddress, params())).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'identityCreditsToAddresses',
        identityId: IDENTITY,
        recipients: [{address: 'tdash1qrecipient', amountCredits: 1_000_000n}],
      },
    })
  })

  it('prices an identity-to-identity transfer', () => {
    expect(feeQueryFor(TransferOperation.IdentityToIdentity, params({recipient: IDENTITY}))).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'identityCreditTransfer',
        identityId: IDENTITY,
        recipientId: IDENTITY,
        amountCredits: 1_000_000n,
      },
    })
  })

  it('prices an identity withdrawal to a core address', () => {
    expect(feeQueryFor(TransferOperation.IdentityWithdrawal, params({recipient: 'yTestCoreAddress'}))).toEqual({
      endpoint: FeeEndpoint.Transition,
      query: {
        kind: 'identityWithdrawal',
        identityId: IDENTITY,
        amountCredits: 1_000_000n,
        coreAddress: 'yTestCoreAddress',
      },
    })
  })

  it('prices a core send in duffs against the core endpoint', () => {
    expect(feeQueryFor(TransferOperation.CoreSend, params({amountDuffs: 100_000n, recipient: 'yCoreRecipient', fromAddress: 'yCoreSource'}))).toEqual({
      endpoint: FeeEndpoint.Core,
      query: {shape: CoreFeeShape.Send, amountDuffs: 100_000n, toAddress: 'yCoreRecipient', fromAddress: 'yCoreSource'},
    })
  })

  it('prices the four asset-lock operations with one L1 shape', () => {
    for (const operation of ASSET_LOCK_OPERATIONS) {
      expect(feeQueryFor(operation, params({amountDuffs: 100_000n}))).toEqual({
        endpoint: FeeEndpoint.Core,
        query: {shape: CoreFeeShape.AssetLock, amountDuffs: 100_000n},
      })
    }
  })

  it('is null for pool-paid operations, which are priced per note count', () => {
    for (const operation of [
      TransferOperation.ShieldedTransfer,
      TransferOperation.Unshield,
      TransferOperation.ShieldedWithdrawal,
      TransferOperation.IdentityCreateFromPool,
    ]) {
      expect(feeQueryFor(operation, params())).toBeNull()
    }
  })

  it('is null for Dash operations until an amount is entered', () => {
    for (const operation of DASH_OPERATIONS) {
      expect(feeQueryFor(operation, params({amountDuffs: 0n}))).toBeNull()
    }
  })

  it('is null for Dash operations while the destination is invalid', () => {
    for (const operation of DASH_OPERATIONS) {
      expect(feeQueryFor(operation, params({amountDuffs: 100_000n, destinationValid: false}))).toBeNull()
    }
  })

  it('is null without an operation', () => {
    expect(feeQueryFor(null, params())).toBeNull()
  })

  it('is null while the destination is invalid', () => {
    for (const operation of [
      TransferOperation.AddressFundsTransfer,
      TransferOperation.AddressWithdrawal,
      TransferOperation.IdentityToIdentity,
    ]) {
      expect(feeQueryFor(operation, params({destinationValid: false}))).toBeNull()
    }
  })

  it('is null for amount-carrying kinds until the amount is positive', () => {
    for (const operation of [
      TransferOperation.IdentityTopUp,
      TransferOperation.IdentityCreate,
      TransferOperation.IdentityToAddress,
      TransferOperation.IdentityToIdentity,
      TransferOperation.IdentityWithdrawal,
    ]) {
      expect(feeQueryFor(operation, params({amountCredits: 0n}))).toBeNull()
    }
  })

  it('still prices amount-free kinds with no amount entered', () => {
    expect(feeQueryFor(TransferOperation.AddressWithdrawal, params({amountCredits: 0n}))).not.toBeNull()
    expect(feeQueryFor(TransferOperation.AddressFundsTransfer, params({amountCredits: 0n}))).not.toBeNull()
    expect(feeQueryFor(TransferOperation.Shield, params({amountCredits: 0n}))).not.toBeNull()
  })

  it('is null for address-funded kinds without a source address', () => {
    expect(feeQueryFor(TransferOperation.IdentityTopUp, params({source: null}))).toBeNull()
    expect(feeQueryFor(TransferOperation.IdentityCreate, params({source: null}))).toBeNull()
  })

  it('is null for identity-funded kinds without a source identity', () => {
    for (const operation of [
      TransferOperation.IdentityToAddress,
      TransferOperation.IdentityToIdentity,
      TransferOperation.IdentityWithdrawal,
    ]) {
      expect(feeQueryFor(operation, params({identityId: null}))).toBeNull()
    }
  })
})
