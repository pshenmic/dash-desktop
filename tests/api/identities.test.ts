import {describe, it, expect, beforeEach, vi} from 'vitest'
import {IdentityService} from '../../src/main/src/services/platform/IdentityService'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AliasDAO} from '../../src/main/src/database/AliasDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {AliasCheck} from '../../src/main/src/types/Alias'
import {DashPayContactRequest} from '../../src/main/src/types/DashPay'
import {DashPayContactRequestDAO} from '../../src/main/src/database/DashPayContactRequestDAO'
import {IdentityKeyRequest} from '../../src/main/src/types/IdentityKeys'
import {MAX_KEYS_PER_TRANSITION} from '../../src/main/src/constants/credits'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const IDENTIFIER = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

const SALT = Buffer.alloc(32, 1)

const ALICE = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

function dashPayContactRequest(id: string, ownerId: string, toUserId: string, createdAt: number): DashPayContactRequest {
  return {id, ownerId, toUserId, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 7, encryptedPublicKey: Buffer.alloc(96, 1), createdAt, coreHeightCreatedAt: 0, contactXpub: null, paymentChannelBroken: false}
}

const UNCHECKED: AliasCheck = {
  status: 'missing', isContested: true, documentId: null, votesFor: null, votesLock: null, votesAbstain: null, voteEndsAt: null,
}

describe('listing identities', () => {
  let identities: IdentityService
  let identityDAO: IdentityDAO
  let aliasDAO: AliasDAO
  let dashPayContactRequestDAO: DashPayContactRequestDAO
  let walletService: WalletService
  let createWalletHandler: CreateWalletHandler
  let request: ReturnType<typeof vi.fn>
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    identities = wired.identityService
    identityDAO = wired.identityDAO
    aliasDAO = wired.aliasDAO
    dashPayContactRequestDAO = wired.dashPayContactRequestDAO
    walletService = wired.walletService
    createWalletHandler = wired.createWalletHandler
    request = wired.request
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    await identityDAO.insertIdentities([{
      walletId, identityIndex: 0, derivationPath: "m/9'/1'/5'/0'/0'/0'", identifier: IDENTIFIER,
    }])
  })

  // The one caller that displays aliases, so it has to keep paying for them.
  it('asks for aliases', async () => {
    request.mockResolvedValue({infos: [{identifier: IDENTIFIER, balance: 5n, aliasesList: ['alice.dash', 'bob.dash']}]})

    const listed = await identities.getIdentities(walletId)

    expect(request).toHaveBeenCalledWith(
      'identityInfos',
      'testnet',
      expect.objectContaining({skipDPNS: false}),
    )
    expect(listed[0]).toMatchObject({alias: 'alice.dash', aliasesList: ['alice.dash', 'bob.dash']})
  })

  it('skips an identity Platform does not know yet', async () => {
    request.mockResolvedValue({infos: []})

    expect(await identities.getIdentities(walletId)).toEqual([])
  })

  it('keeps a pending name pending until the chain shows it, then follows its vote', async () => {
    await aliasDAO.save({
      ...UNCHECKED, walletId, identifier: IDENTIFIER, label: 'owl', normalizedLabel: '0w1',
      status: 'pending', preorderSalt: null, createdAt: 1, checkedAt: null,
    })
    let check = UNCHECKED
    request.mockImplementation(async (kind: string) => kind === 'aliasStatus' ? check : {infos: []})

    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'pending'})

    check = {...UNCHECKED, status: 'voting', votesFor: 4, votesLock: 1, votesAbstain: 0, voteEndsAt: 5_400_000}
    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'voting', votesFor: 4, voteEndsAt: 5_400_000})

    check = {...check, status: 'registered', documentId: 'doc'}
    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'registered', documentId: 'doc'})
    expect(request).toHaveBeenCalledWith('aliasStatus', 'testnet', {identifier: IDENTIFIER, label: 'owl'})

    request.mockClear()
    await identities.getAliases(walletId)
    expect(request).not.toHaveBeenCalledWith('aliasStatus', expect.anything(), expect.anything())
  })

  // The same mnemonic on a fresh database finds the names it registered before.
  it('stores a name the chain shows that this wallet has no row for', async () => {
    request.mockImplementation(async (kind: string) => kind === 'aliasStatus'
      ? {...UNCHECKED, status: 'registered', isContested: false, documentId: 'doc'}
      : {infos: [{identifier: IDENTIFIER, balance: 0n, aliasesList: ['Owl.dash']}]})

    expect(await identities.getAliases(walletId)).toMatchObject([
      {identifier: IDENTIFIER, label: 'Owl', normalizedLabel: '0w1', status: 'registered', documentId: 'doc', preorderSalt: null},
    ])
    request.mockClear()
    await identities.getAliases(walletId)
    expect(request).not.toHaveBeenCalledWith('aliasStatus', expect.anything(), expect.anything())
  })

  it('records a registered name as pending under the identity that sent it', async () => {
    request.mockImplementation(async (kind: string) => ({
      identityInfos: {infos: []},
      aliasStatus: UNCHECKED,
      aliasRegister: {...UNCHECKED, preorderSalt: SALT, error: null},
    })[kind])

    const alias = await identities.registerAlias(walletId, IDENTIFIER, 'Owl', PASSWORD)

    expect(request).toHaveBeenCalledWith('aliasRegister', 'testnet', expect.objectContaining({
      identifier: IDENTIFIER, identityIndex: 0, label: 'Owl', preorderSalt: null,
    }))
    expect(alias).toMatchObject({status: 'pending', label: 'Owl', normalizedLabel: '0w1', isContested: true})
    expect(await identities.getAliases(walletId)).toMatchObject([{...alias, checkedAt: expect.any(Number)}])
  })

  it('keeps the salt of a domain refused after its preorder, and resumes the preorder next time', async () => {
    let error: string | null = 'insufficient balance'
    request.mockImplementation(async (kind: string) => kind === 'identityInfos' ? {infos: []} : {...UNCHECKED, preorderSalt: SALT, error})

    await expect(identities.registerAlias(walletId, IDENTIFIER, 'owl', PASSWORD)).rejects.toThrow('insufficient balance')
    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'missing', preorderSalt: SALT})

    error = null
    await identities.registerAlias(walletId, IDENTIFIER, 'OWL', PASSWORD)
    expect(request).toHaveBeenLastCalledWith('aliasRegister', 'testnet', expect.objectContaining({preorderSalt: SALT}))
    expect(await identities.getAliases(walletId)).toHaveLength(1)
    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'pending', label: 'OWL'})
  })

  it('registers nothing for an identity outside the wallet or with a wrong password', async () => {
    request.mockResolvedValue({infos: []})
    await expect(identities.registerAlias(walletId, 'someone-else', 'owl', PASSWORD)).rejects.toThrow('Identity not found')
    await expect(identities.registerAlias(walletId, IDENTIFIER, 'owl', 'wrong')).rejects.toThrow('Invalid wallet password')
    expect(request).not.toHaveBeenCalledWith('aliasRegister', expect.anything(), expect.anything())
    expect(await identities.getAliases(walletId)).toEqual([])
  })

  it('creates nothing for no keys, too many keys, an identity outside the wallet or a wrong password', async () => {
    const key: IdentityKeyRequest = {purpose: 'AUTHENTICATION', securityLevel: 'HIGH', contractBounds: null}
    await expect(identities.createIdentityKeys(walletId, IDENTIFIER, [], PASSWORD)).rejects.toThrow('at least one key')
    await expect(identities.createIdentityKeys(walletId, IDENTIFIER, Array(MAX_KEYS_PER_TRANSITION + 1).fill(key), PASSWORD)).rejects.toThrow('at most')
    await expect(identities.createIdentityKeys(walletId, 'someone-else', [key], PASSWORD)).rejects.toThrow('Identity not found')
    await expect(identities.createIdentityKeys(walletId, IDENTIFIER, [key], 'wrong')).rejects.toThrow('Invalid wallet password')
    expect(request).not.toHaveBeenCalledWith('identityCreateKeys', expect.anything(), expect.anything())
  })

  // Only what is newer than the newest stored request is asked for, and the
  // boundary millisecond is asked for again, so what comes back twice is kept once.
  it('fetches new contact requests and pairs them into contacts', async () => {
    const sent = dashPayContactRequest('sent', IDENTIFIER, ALICE, 10)
    const received = dashPayContactRequest('received', ALICE, IDENTIFIER, 20)
    request.mockImplementation(async (kind: string) => kind === 'dashPayContactRequests' ? {sent: [sent], received: []} : {infos: []})
    expect(await identities.getDashPayContacts(walletId)).toEqual([
      {identifier: IDENTIFIER, contactId: ALICE, relationship: 'outgoing', aliasesList: [], incomingCreatedAt: null, outgoingCreatedAt: 10, paymentChannelBroken: false},
    ])
    expect(request).toHaveBeenCalledWith('dashPayContactRequests', 'testnet', {identifier: IDENTIFIER, since: 0})

    request.mockImplementation(async (kind: string) => kind === 'dashPayContactRequests' ? {sent: [sent], received: [received]} : {infos: []})
    expect(await identities.getDashPayContacts(walletId)).toEqual([
      {identifier: IDENTIFIER, contactId: ALICE, relationship: 'established', aliasesList: [], incomingCreatedAt: 20, outgoingCreatedAt: 10, paymentChannelBroken: false},
    ])
    expect(request).toHaveBeenCalledWith('dashPayContactRequests', 'testnet', {identifier: IDENTIFIER, since: 10})
  })

  it('refuses a contact request to itself or from an identity it does not hold', async () => {
    await expect(identities.sendDashPayContactRequest(walletId, IDENTIFIER, IDENTIFIER, PASSWORD)).rejects.toThrow('itself')
    await expect(identities.sendDashPayContactRequest(walletId, ALICE, IDENTIFIER, PASSWORD)).rejects.toThrow('Identity not found')
    expect(request).not.toHaveBeenCalledWith('dashPayContactRequestSend', expect.anything(), expect.anything())
  })

  // Paying a contact then needs no extra unlock to read the key they sent us.
  it("stores the key of a contact's request when accepting it", async () => {
    await dashPayContactRequestDAO.saveAll(walletId, [dashPayContactRequest('theirs', ALICE, IDENTIFIER, 10)])
    request.mockImplementation(async (kind: string) => ({
      dashPayContactRequestSend: {stHash: 'hash'},
      dashPayContactRequests: {sent: [], received: []},
      dashPayContactKey: {xpub: 'tpub-alice'},
      identityInfos: {infos: []},
    })[kind])

    await identities.sendDashPayContactRequest(walletId, IDENTIFIER, ALICE, PASSWORD)

    expect((await dashPayContactRequestDAO.getContactRequests(walletId))[0].contactXpub).toBe('tpub-alice')
  })

  it("decrypts a contact's key once and reads it from storage after that", async () => {
    await dashPayContactRequestDAO.saveAll(walletId, [dashPayContactRequest('theirs', ALICE, IDENTIFIER, 10)])
    request.mockImplementation(async (kind: string) => kind === 'dashPayContactKey' ? {xpub: 'tpub-alice'} : undefined)
    const seed = new Uint8Array(64)

    expect(await identities.dashPayContactXpub(walletId, 'testnet', seed, IDENTIFIER, ALICE)).toBe('tpub-alice')
    expect(await identities.dashPayContactXpub(walletId, 'testnet', seed, IDENTIFIER, ALICE)).toBe('tpub-alice')
    expect(request.mock.calls.filter(([kind]) => kind === 'dashPayContactKey')).toHaveLength(1)
  })

  // A name alone carries no L1 address; only the contact's request does.
  it('refuses to pay someone who never sent this identity a contact request', async () => {
    await dashPayContactRequestDAO.saveAll(walletId, [dashPayContactRequest('ours', IDENTIFIER, ALICE, 10)])

    await expect(walletService.sendDashPayPayment(walletId, IDENTIFIER, ALICE, 100_000n, PASSWORD))
      .rejects.toThrow('This contact has not sent this identity a contact request')
    await expect(walletService.sendDashPayPayment(walletId, IDENTIFIER, ALICE, 100_000n, 'wrong'))
      .rejects.toThrow('Invalid wallet password')
  })

  // A request is immutable, so a fault in it is not retried on every payment.
  it('marks a contact unpayable when their key can never be decrypted, and stops trying', async () => {
    await dashPayContactRequestDAO.saveAll(walletId, [dashPayContactRequest('theirs', ALICE, IDENTIFIER, 10)])
    request.mockImplementation(async (kind: string) => kind === 'dashPayContactKey' ? {xpub: null} : {infos: []})
    const seed = new Uint8Array(64)

    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(identities.dashPayContactXpub(walletId, 'testnet', seed, IDENTIFIER, ALICE)).rejects.toThrow('ask them to send you a new contact request')
    }
    expect(request.mock.calls.filter(([kind]) => kind === 'dashPayContactKey')).toHaveLength(1)
    expect((await identities.getDashPayContacts(walletId))[0].paymentChannelBroken).toBe(true)
  })
})
