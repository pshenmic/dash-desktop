import {describe, it, expect, beforeEach, vi} from 'vitest'
import {IdentityService} from '../../src/main/src/services/platform/IdentityService'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AliasDAO} from '../../src/main/src/database/AliasDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {AliasCheck} from '../../src/main/src/types/Alias'
import {ContactRequest} from '../../src/main/src/types/Contact'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const IDENTIFIER = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

const SALT = Buffer.alloc(32, 1)

const ALICE = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

function contactRequest(id: string, ownerId: string, toUserId: string, createdAt: number): ContactRequest {
  return {id, ownerId, toUserId, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 7, encryptedPublicKey: Buffer.alloc(96, 1), createdAt}
}

const UNCHECKED: AliasCheck = {
  status: 'missing', isContested: true, documentId: null, votesFor: null, votesLock: null, votesAbstain: null, voteEndsAt: null,
}

describe('listing identities', () => {
  let identities: IdentityService
  let identityDAO: IdentityDAO
  let aliasDAO: AliasDAO
  let createWalletHandler: CreateWalletHandler
  let request: ReturnType<typeof vi.fn>
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    identities = wired.identityService
    identityDAO = wired.identityDAO
    aliasDAO = wired.aliasDAO
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

    await identities.getIdentities(walletId)
    expect((await aliasDAO.getAliases(walletId))[0]).toMatchObject({status: 'pending'})

    check = {...UNCHECKED, status: 'voting', votesFor: 4, votesLock: 1, votesAbstain: 0, voteEndsAt: 5_400_000}
    await identities.getIdentities(walletId)
    expect((await aliasDAO.getAliases(walletId))[0]).toMatchObject({status: 'voting', votesFor: 4, voteEndsAt: 5_400_000})

    check = {...check, status: 'registered', documentId: 'doc'}
    await identities.getIdentities(walletId)
    expect((await aliasDAO.getAliases(walletId))[0]).toMatchObject({status: 'registered', documentId: 'doc'})
    expect(request).toHaveBeenCalledWith('aliasStatus', 'testnet', {identifier: IDENTIFIER, label: 'owl'})

    request.mockClear()
    await identities.getIdentities(walletId)
    expect(request).not.toHaveBeenCalledWith('aliasStatus', expect.anything(), expect.anything())
  })

  it('records a registered name as pending under the identity that sent it', async () => {
    request.mockResolvedValue({...UNCHECKED, preorderSalt: SALT, error: null})

    const alias = await identities.registerAlias(walletId, IDENTIFIER, 'Owl', PASSWORD)

    expect(request).toHaveBeenCalledWith('aliasRegister', 'testnet', expect.objectContaining({
      identifier: IDENTIFIER, identityIndex: 0, label: 'Owl', preorderSalt: null,
    }))
    expect(alias).toMatchObject({status: 'pending', label: 'Owl', normalizedLabel: '0w1', isContested: true})
    expect(await identities.getAliases(walletId)).toEqual([alias])
  })

  it('keeps the salt of a domain refused after its preorder, and resumes the preorder next time', async () => {
    request.mockResolvedValue({...UNCHECKED, preorderSalt: SALT, error: 'insufficient balance'})

    await expect(identities.registerAlias(walletId, IDENTIFIER, 'owl', PASSWORD)).rejects.toThrow('insufficient balance')
    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'missing', preorderSalt: SALT})

    request.mockResolvedValue({...UNCHECKED, preorderSalt: SALT, error: null})
    await identities.registerAlias(walletId, IDENTIFIER, 'OWL', PASSWORD)
    expect(request).toHaveBeenLastCalledWith('aliasRegister', 'testnet', expect.objectContaining({preorderSalt: SALT}))
    expect(await identities.getAliases(walletId)).toHaveLength(1)
    expect((await identities.getAliases(walletId))[0]).toMatchObject({status: 'pending', label: 'OWL'})
  })

  it('registers nothing for an identity outside the wallet or with a wrong password', async () => {
    await expect(identities.registerAlias(walletId, 'someone-else', 'owl', PASSWORD)).rejects.toThrow('Identity not found')
    await expect(identities.registerAlias(walletId, IDENTIFIER, 'owl', 'wrong')).rejects.toThrow('Invalid wallet password')
    expect(request).not.toHaveBeenCalledWith('aliasRegister', expect.anything(), expect.anything())
    expect(await identities.getAliases(walletId)).toEqual([])
  })

  // Only what is newer than the newest stored request is asked for, and the
  // boundary millisecond is asked for again, so what comes back twice is kept once.
  it('stores new contact requests from the refresh and pairs them into contacts', async () => {
    const sent = contactRequest('sent', IDENTIFIER, ALICE, 10)
    const received = contactRequest('received', ALICE, IDENTIFIER, 20)
    request.mockImplementation(async (kind: string) => kind === 'contactRequests' ? {sent: [sent], received: []} : {infos: []})
    await identities.getIdentities(walletId)
    expect(request).toHaveBeenCalledWith('contactRequests', 'testnet', {identifier: IDENTIFIER, since: 0})
    expect(await identities.getContacts(walletId)).toEqual([{identifier: IDENTIFIER, contactId: ALICE, sent, received: null}])

    request.mockImplementation(async (kind: string) => kind === 'contactRequests' ? {sent: [sent], received: [received]} : {infos: []})
    await identities.getIdentities(walletId)
    expect(request).toHaveBeenLastCalledWith('contactRequests', 'testnet', {identifier: IDENTIFIER, since: 10})
    expect(await identities.getContacts(walletId)).toEqual([{identifier: IDENTIFIER, contactId: ALICE, sent, received}])
  })

  it('sends a contact request and returns it among the contacts', async () => {
    const sent = contactRequest('sent', IDENTIFIER, ALICE, 10)
    request.mockImplementation(async (kind: string) => kind === 'contactRequestSend' ? {stHash: 'hash'} : {sent: [sent], received: []})

    expect(await identities.sendContactRequest(walletId, IDENTIFIER, ALICE, PASSWORD)).toEqual([{identifier: IDENTIFIER, contactId: ALICE, sent, received: null}])
    expect(request).toHaveBeenCalledWith('contactRequestSend', 'testnet', expect.objectContaining({identifier: IDENTIFIER, identityIndex: 0, recipient: ALICE}))
  })

  it('refuses a contact request to itself or from an identity it does not hold', async () => {
    await expect(identities.sendContactRequest(walletId, IDENTIFIER, IDENTIFIER, PASSWORD)).rejects.toThrow('itself')
    await expect(identities.sendContactRequest(walletId, ALICE, IDENTIFIER, PASSWORD)).rejects.toThrow('Identity not found')
    expect(request).not.toHaveBeenCalledWith('contactRequestSend', expect.anything(), expect.anything())
  })
})
