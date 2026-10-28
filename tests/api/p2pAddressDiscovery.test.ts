import {describe, it, expect, beforeEach} from 'vitest'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {CoreDiscoveryService} from '../../src/main/src/services/core/CoreDiscoveryService'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {CORE_ADDRESS_WINDOW, DASHPAY_ADDRESS_WINDOW, DASHPAY_RESCAN_MARGIN_BLOCKS} from '../../src/main/src/constants/addresses'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {HDKey} from '@scure/bip32'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const receiveTo = (walletId: string, height: number, address: string): AppliedBlock => ({
  walletId,
  height,
  blockHash: `hash-${height}`,
  blockTime: 1_700_000_000,
  txs: [{
    txid: `txid-${height}`,
    raw: new Uint8Array([1, 2, 3]),
    inputs: [],
    outputs: [{vout: 0, address, satoshis: '100000', isMine: true}],
  }],
  spends: [],
})

describe('p2p address discovery', () => {
  let discovery: CoreDiscoveryService
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let addressDAO: AddressDAO
  let identityDAO: IdentityDAO
  let wired: Awaited<ReturnType<typeof harness>>

  beforeEach(async () => {
    wired = await harness()
    discovery = wired.coreDiscoveryService
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    addressDAO = wired.addressDAO
    identityDAO = wired.identityDAO
  })

  it('reports an address as used once a block paying it is applied', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const paid = receiving[3].address
    const all = receiving.map(a => a.address)

    expect(await transactionDAO.getUsedAddresses(walletId, all)).toEqual([])

    await transactionDAO.applyBlock(receiveTo(walletId, 100, paid))

    expect(await transactionDAO.getUsedAddresses(walletId, all)).toEqual([paid])
  })

  it('counts an output paying an address the wallet has not derived yet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const foreign = receiving[0].address

    await transactionDAO.applyBlock({
      ...receiveTo(walletId, 100, foreign),
      txs: [{
        txid: 'txid-100',
        raw: new Uint8Array([1, 2, 3]),
        inputs: [],
        outputs: [{vout: 0, address: foreign, satoshis: '100000', isMine: false}],
      }],
    })

    expect(await transactionDAO.getUsedAddresses(walletId, [foreign])).toEqual([foreign])
  })

  it('extends the receiving chain past a used address at the gap edge', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const before = await addressDAO.getAddressesByWalletId(walletId)
    expect(before.receiving).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)

    const last = before.receiving[CORE_ADDRESS_WINDOW.gapLimit - 1]
    await transactionDAO.applyBlock(receiveTo(walletId, 100, last.address))

    await discovery.discoverCoreAddresses(walletId)

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving).toHaveLength(last.index + 1 + CORE_ADDRESS_WINDOW.gapLimit)
    expect(after.receiving.find(a => a.address === last.address)?.isUsed).toBe(true)
    expect(after.change).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
  })

  it('extends past an address whose only output was stored is_mine=false', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const before = await addressDAO.getAddressesByWalletId(walletId)
    await transactionDAO.applyBlock(receiveTo(walletId, 100, before.receiving[CORE_ADDRESS_WINDOW.gapLimit - 1].address))
    await discovery.discoverCoreAddresses(walletId)

    const extended = await addressDAO.getAddressesByWalletId(walletId)
    const missed = extended.receiving[CORE_ADDRESS_WINDOW.gapLimit + 5]
    expect(missed.isUsed).toBe(false)

    await transactionDAO.applyBlock({
      walletId,
      height: 200,
      blockHash: 'hash-200',
      blockTime: 1_700_000_000,
      txs: [{
        txid: 'txid-200',
        raw: new Uint8Array([1, 2, 3]),
        inputs: [],
        outputs: [
          {vout: 0, address: extended.receiving[5].address, satoshis: '100000', isMine: true},
          {vout: 1, address: missed.address, satoshis: '50000', isMine: false},
        ],
      }],
      spends: [],
    })

    await discovery.discoverCoreAddresses(walletId)

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving.find(a => a.address === missed.address)?.isUsed).toBe(true)
    // At least a full gap above the used index — the extension rounds up to a
    // batch, so the exact count is not the contract.
    expect(after.receiving.length).toBeGreaterThanOrEqual(missed.index + 1 + CORE_ADDRESS_WINDOW.gapLimit)
  })

  it('adds nothing when no address has been paid', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    await discovery.discoverCoreAddresses(walletId)

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
    expect(after.change).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
  })

  describe('DashPay chains', () => {
    const OURS = '7cBLvT9A6nkU5jPoLak8o97rU4WrARr3xHv7ttFh9n64'
    const THEIRS = '3vNcXuGDZkFbE2WLNLcSWCFPTF7vyB6CRo1pUtBxpcjE'
    const THEIR_XPUB = HDKey.fromMasterSeed(new Uint8Array(32).fill(5)).publicExtendedKey
    const theirAddress = (index: number) => new KeyPairController().p2pkhAddress(HDKey.fromExtendedKey(THEIR_XPUB).deriveChild(index).publicKey!, 'testnet')

    type Request = {ownerId: string; toUserId: string; contactXpub?: string; coreHeightCreatedAt?: number}
    // What refreshDashPay leaves in memory for the wallet.
    const save = (walletId: string, requests: Request[], from = 0) => {
      const cache = wired.dashPayCache.wallet(walletId)
      cache.requests = [...cache.requests ?? [], ...requests.map((request, i) => ({
        id: `request-${from + i}`, ownerId: request.ownerId, toUserId: request.toUserId, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 0,
        encryptedPublicKey: new Uint8Array(96), createdAt: from + i, coreHeightCreatedAt: request.coreHeightCreatedAt ?? 0,
      }))]
      requests.forEach((request, i) => {
        if (request.contactXpub != null) cache.contactKeys.set(`request-${from + i}`, request.contactXpub)
      })
    }

    async function walletWith(...requests: Request[]): Promise<string> {
      const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
      await identityDAO.insertIdentities([{walletId, identityIndex: 0, derivationPath: "m/9'/1'/5'/0'/0'/0'", identifier: OURS}])
      save(walletId, requests)
      return walletId
    }

    it('watches our chain for a contact we sent a request to, apart from both BIP-44 chains', async () => {
      const walletId = await walletWith({ownerId: OURS, toUserId: THEIRS})
      await discovery.discoverCoreAddresses(walletId)

      const {receiving, change, dashPay = []} = await addressDAO.getAddressesByWalletId(walletId)
      expect(dashPay).toHaveLength(DASHPAY_ADDRESS_WINDOW.gapLimit)
      expect(dashPay[0].derivationPath).toMatch(/^m\/9'\/1'\/15'\/0'\/0x[0-9a-f]{64}\/0x[0-9a-f]{64}\/0$/)
      expect(receiving).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
      expect(change).toHaveLength(CORE_ADDRESS_WINDOW.gapLimit)
    })

    it('extends our chain past a payment at its edge', async () => {
      const walletId = await walletWith({ownerId: OURS, toUserId: THEIRS})
      await discovery.discoverCoreAddresses(walletId)
      const {dashPay = []} = await addressDAO.getAddressesByWalletId(walletId)
      await transactionDAO.applyBlock(receiveTo(walletId, 100, dashPay[DASHPAY_ADDRESS_WINDOW.gapLimit - 1].address))

      await discovery.discoverCoreAddresses(walletId)

      const after = (await addressDAO.getAddressesByWalletId(walletId)).dashPay ?? []
      expect(after.length).toBeGreaterThanOrEqual(2 * DASHPAY_ADDRESS_WINDOW.gapLimit)
      expect(after[DASHPAY_ADDRESS_WINDOW.gapLimit - 1].isUsed).toBe(true)
    })

    // Their chain holds their money: tracked for what we paid, never counted as ours.
    it('keeps their chain once their key is stored, outside the addresses we own', async () => {
      const walletId = await walletWith({ownerId: THEIRS, toUserId: OURS, contactXpub: THEIR_XPUB})
      await discovery.discoverCoreAddresses(walletId)

      expect((await addressDAO.getAddressesByWalletId(walletId)).dashPay).toEqual([])
      expect(discovery.dashPayChain(walletId, OURS, THEIRS, 'external')).toHaveLength(DASHPAY_ADDRESS_WINDOW.gapLimit)
    })

    it('lists what they paid our chain and what we paid theirs as payments between us', async () => {
      const walletId = await walletWith({ownerId: OURS, toUserId: THEIRS}, {ownerId: THEIRS, toUserId: OURS, contactXpub: THEIR_XPUB})
      await discovery.discoverCoreAddresses(walletId)
      const ours = ((await addressDAO.getAddressesByWalletId(walletId)).dashPay ?? [])[0].address
      await transactionDAO.applyBlock(receiveTo(walletId, 100, ours))
      await transactionDAO.applyBlock({
        ...receiveTo(walletId, 101, theirAddress(0)),
        txs: [{txid: 'paid', raw: new Uint8Array([1]), inputs: [], outputs: [{vout: 0, address: theirAddress(0), satoshis: '7000', isMine: false}]}],
      })

      const payments = await wired.walletService.getDashPayPayments(walletId, OURS, THEIRS)
      expect(payments.map(({txid, amountDuffs, direction}) => ({txid, amountDuffs, direction})).sort((a, b) => a.txid.localeCompare(b.txid))).toEqual([
        {txid: 'paid', amountDuffs: 7000n, direction: 'sent'},
        {txid: 'txid-100', amountDuffs: 100_000n, direction: 'received'},
      ])
    })

    it('pays each payment on a fresh address of their chain, past what history already paid', async () => {
      const walletId = await walletWith({ownerId: THEIRS, toUserId: OURS, contactXpub: THEIR_XPUB})
      await transactionDAO.applyBlock({
        ...receiveTo(walletId, 100, theirAddress(0)),
        txs: [{txid: 'paid', raw: new Uint8Array([1]), inputs: [], outputs: [{vout: 0, address: theirAddress(0), satoshis: '1000', isMine: false}]}],
      })
      const wallet = (await wired.walletDAO.getWalletById(walletId))!

      expect(await discovery.nextDashPayPayAddress(wallet, OURS, THEIRS, THEIR_XPUB)).toBe(theirAddress(1))
      expect(await discovery.nextDashPayPayAddress(wallet, OURS, THEIRS, THEIR_XPUB)).toBe(theirAddress(2))
    })
  
    // A contact who re-keys sends a new request; paying the old key could land
    // on addresses they no longer watch.
    it("rebuilds their chain from the key of their newest request", async () => {
      const walletId = await walletWith({ownerId: THEIRS, toUserId: OURS, contactXpub: THEIR_XPUB})
      await discovery.discoverCoreAddresses(walletId)
      const newXpub = HDKey.fromMasterSeed(new Uint8Array(32).fill(6)).publicExtendedKey
      save(walletId, [{ownerId: THEIRS, toUserId: OURS, contactXpub: newXpub}], 1)

      await discovery.discoverCoreAddresses(walletId)

      const [first] = discovery.dashPayChain(walletId, OURS, THEIRS, 'external')
      const newFirst = new KeyPairController().p2pkhAddress(HDKey.fromExtendedKey(newXpub).deriveChild(0).publicKey!, 'testnet')
      expect(first.address).toBe(newFirst)
      const wallet = (await wired.walletDAO.getWalletById(walletId))!
      expect(await discovery.nextDashPayPayAddress(wallet, OURS, THEIRS, newXpub)).toBe(newFirst)
    })

    // Derived again after every start, a chain of ours rescans at most the margin
    // below the cursor: an earlier run watched it up to there.
    it("rescans a new chain of ours from its request's height, at most the margin below the cursor", async () => {
      const recent = await walletWith({ownerId: OURS, toUserId: THEIRS, coreHeightCreatedAt: 49_990})
      await transactionDAO.markInitialScanComplete(recent)
      await transactionDAO.resetCursor(recent, 50_000)
      await discovery.discoverCoreAddresses(recent)
      expect(await transactionDAO.getCursor(recent)).toBe(49_990)

      const old = await walletWith({ownerId: OURS, toUserId: THEIRS, coreHeightCreatedAt: 1_000})
      await transactionDAO.markInitialScanComplete(old)
      await transactionDAO.resetCursor(old, 50_000)
      await discovery.discoverCoreAddresses(old)
      expect(await transactionDAO.getCursor(old)).toBe(50_000 - DASHPAY_RESCAN_MARGIN_BLOCKS)

      const behind = await walletWith({ownerId: OURS, toUserId: THEIRS, coreHeightCreatedAt: 1_000})
      await transactionDAO.resetCursor(behind, 500)
      await discovery.discoverCoreAddresses(behind)
      expect(await transactionDAO.getCursor(behind)).toBe(500)
    })
})
})