import {describe, it, expect, beforeEach} from 'vitest'
import {AssetLockDAO} from '../../src/main/src/database/AssetLockDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AssetLockFundingStatus} from '../../src/main/src/enums/AssetLockFundingStatus'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import type {Knex} from 'knex'

const A = 'walletA'
const B = 'walletB'
const TXID_A = 'a'.repeat(64)
const TXID_B = 'b'.repeat(64)

const funding = (walletId: string, txid: string): Parameters<AssetLockDAO['insertFunding']>[0] => ({
  walletId,
  txid,
  outputIndex: 0,
  creditDerivationPath: "m/9'/1'/5'/2'/0",
  amountDuffs: 100000n,
  toPlatformAddress: 'dest',
  kind: 'address',
  status: AssetLockFundingStatus.L1Broadcast,
  identityIndex: null,
  txHex: 'aa',
  createdAt: 0,
})

describe('asset lock funding writes', () => {
  let knex: Knex
  let dao: AssetLockDAO

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    const walletDAO = new WalletDAO(knex)
    // encrypted_mnemonic is unique, so the two wallets cannot share one.
    await walletDAO.saveWallet('encrypted-a', A, 'testnet', null)
    await walletDAO.saveWallet('encrypted-b', B, 'testnet', null)
    dao = new AssetLockDAO(knex)
    await dao.insertFunding(funding(A, TXID_A))
    await dao.insertFunding(funding(B, TXID_B))
  })

  const statusOf = async (txid: string): Promise<string> => {
    const row = await knex('asset_lock_fundings').where({txid}).first()
    return row.status
  }

  // txid is globally unique in this table, so the where clause cannot reach
  // another wallet's row today — these hold if that index is ever relaxed.
  it('advances only the funding it names', async () => {
    await dao.updateStatus(A, TXID_A, AssetLockFundingStatus.Done, {stHash: 'st'})

    expect(await statusOf(TXID_A)).toBe(AssetLockFundingStatus.Done)
    expect(await statusOf(TXID_B)).toBe(AssetLockFundingStatus.L1Broadcast)
  })

  it('writes no status when the wallet does not own the txid', async () => {
    await dao.updateStatus(B, TXID_A, AssetLockFundingStatus.Done)

    expect(await statusOf(TXID_A)).toBe(AssetLockFundingStatus.L1Broadcast)
  })

  it('writes no proof when the wallet does not own the txid', async () => {
    await dao.saveProof(B, TXID_A, {type: 'chainLock', coreChainLockedHeight: 1534829})

    expect((await dao.getActiveFunding(A))?.assetLockProof).toBeNull()
  })

  it('stores the proof against the owning wallet', async () => {
    await dao.saveProof(A, TXID_A, {type: 'chainLock', coreChainLockedHeight: 1534829})

    expect((await dao.getActiveFunding(A))?.assetLockProof).toEqual({
      type: 'chainLock', coreChainLockedHeight: 1534829,
    })
  })

  // error is only ever set by the failing path, so a funding that failed and
  // then succeeded on resume must not keep the stale message.
  it('clears a stale error when the funding moves on', async () => {
    await dao.updateStatus(A, TXID_A, AssetLockFundingStatus.Error, {error: 'broadcast rejected'})
    expect(await dao.getActiveFunding(A)).toBeNull()

    await dao.updateStatus(A, TXID_A, AssetLockFundingStatus.ChainLocked)

    expect((await dao.getActiveFunding(A))?.error).toBeNull()
  })

  it('keeps the error it was given', async () => {
    await dao.updateStatus(A, TXID_A, AssetLockFundingStatus.L1Broadcast, {error: 'proof timed out'})

    expect((await dao.getActiveFunding(A))?.error).toBe('proof timed out')
  })
})
