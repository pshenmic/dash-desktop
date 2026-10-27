import {describe, it, expect, beforeEach, vi} from 'vitest'
import {IdentityService} from '../../src/main/src/services/platform/IdentityService'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {UsernameCheck} from '../../src/main/src/types/Username'
import {DashPayContactRequest} from '../../src/main/src/types/DashPay'
import {DashPayCache} from '../../src/main/src/database/DashPayCache'
import {IdentityKeyRequest} from '../../src/main/src/types/IdentityKeys'
import {MAX_KEYS_PER_TRANSITION} from '../../src/main/src/constants/credits'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {PlatformExplorerProvider} from '../../src/main/src/providers/PlatformExplorerProvider'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const IDENTIFIER = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

const ALICE = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

function dashPayContactRequest(id: string, ownerId: string, toUserId: string, createdAt: number): DashPayContactRequest {
  return {id, ownerId, toUserId, senderKeyIndex: 3, recipientKeyIndex: 4, accountReference: 7, encryptedPublicKey: Buffer.alloc(96, 1), createdAt, coreHeightCreatedAt: 0, contactXpub: null, paymentChannelBroken: false}
}

const UNCHECKED: UsernameCheck = {
  status: 'missing', isContested: true, documentId: null, votesLock: null, votesAbstain: null, voteEndsAt: null,
  voteOutcome: null, voteWinner: null, contenders: [],
}

// What Platform holds, changed by each test; the worker answers from it.
let network: {
  requests: DashPayContactRequest[]
  names: Map<string, string[]>
  // Running contests by normalized label, as the explorer lists them, with their contenders.
  contests: Map<string, string[]>
  status: (label: string) => UsernameCheck
  contactKey: string | null
}

async function answer(kind: string, _network: string, payload: {identifier: string; identifiers: string[]; label: string; labels: string[]}): Promise<unknown> {
  switch (kind) {
    case 'dashPayContactRequests': return {
      sent: network.requests.filter(request => request.ownerId === payload.identifier),
      received: network.requests.filter(request => request.toUserId === payload.identifier),
    }
    case 'identityInfos': return {
      infos: payload.identifiers.map(identifier => ({identifier, balance: 0n, usernames: network.names.get(identifier) ?? [], keys: []})),
    }
    case 'usernameStatus': return network.status(payload.label)
    case 'usernameContests': return {
      contests: payload.labels.flatMap(label => (network.contests.get(label) ?? [])
        .filter(contender => payload.identifiers.includes(contender))
        .map(identifier => ({identifier, label}))),
    }
    case 'usernameRegister': return network.status(payload.label)
    case 'dashPayContactRequestSend': return {stHash: 'hash'}
    case 'dashPayContactKey': return {xpub: network.contactKey}
    default: throw new Error(`unexpected request ${kind}`)
  }
}

describe('listing identities', () => {
  let identities: IdentityService
  let identityDAO: IdentityDAO
  let dashPayCache: DashPayCache
  let walletService: WalletService
  let createWalletHandler: CreateWalletHandler
  let request: ReturnType<typeof vi.fn>
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    identities = wired.identityService
    identityDAO = wired.identityDAO
    dashPayCache = wired.dashPayCache
    walletService = wired.walletService
    createWalletHandler = wired.createWalletHandler
    request = wired.request
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    await identityDAO.insertIdentities([{
      walletId, identityIndex: 0, derivationPath: "m/9'/1'/5'/0'/0'/0'", identifier: IDENTIFIER,
    }])
    network = {requests: [], names: new Map(), contests: new Map(), status: () => UNCHECKED, contactKey: 'tpub-alice'}
    request.mockImplementation(answer)
    vi.spyOn(PlatformExplorerProvider.prototype, 'runningDpnsContests').mockImplementation(async () => [...network.contests.keys()])
  })

  // The one caller that displays aliases, so it has to keep paying for them.
  it('asks for aliases', async () => {
    request.mockResolvedValue({infos: [{identifier: IDENTIFIER, balance: 5n, usernames: ['alice.dash', 'bob.dash']}]})

    const listed = await identities.getIdentities(walletId)

    expect(request).toHaveBeenCalledWith(
      'identityInfos',
      'testnet',
      expect.objectContaining({skipDPNS: false}),
    )
    expect(listed[0]).toMatchObject({alias: 'alice.dash', usernames: ['alice.dash', 'bob.dash']})
  })

  it('skips an identity Platform does not know yet', async () => {
    request.mockResolvedValue({infos: []})

    expect(await identities.getIdentities(walletId)).toEqual([])
  })

  // Only this process knows the contest: no domain document lists it until it wins.
  it('follows a contested name it registered through its vote to its outcome', async () => {
    const contenders = [{identifier: IDENTIFIER, votes: 4}, {identifier: ALICE, votes: 1}]
    network.status = () => ({...UNCHECKED, status: 'voting', votesLock: 1, votesAbstain: 0, voteEndsAt: 5_400_000, contenders})
    await identities.registerUsername(walletId, IDENTIFIER, 'owl', PASSWORD)
    await identities.refreshDashPay(walletId)
    expect(await identities.getUsernames(walletId)).toMatchObject([{status: 'voting', voteEndsAt: 5_400_000, contenders}])

    // Drive keeps a finished contest's final tally; the name now has its domain.
    const final = [{identifier: IDENTIFIER, votes: 6}, {identifier: ALICE, votes: 2}]
    network.names.set(IDENTIFIER, ['owl.dash'])
    network.status = () => ({...UNCHECKED, status: 'registered', documentId: 'doc', voteOutcome: 'WonByIdentity', voteWinner: IDENTIFIER, contenders: final})
    await identities.refreshDashPay(walletId)
    expect(await identities.getUsernames(walletId)).toMatchObject([
      {status: 'registered', documentId: 'doc', voteOutcome: 'WonByIdentity', voteWinner: IDENTIFIER, contenders: final},
    ])
  })

  // Nothing is stored: the first read after a start fetches, and only a refresh fetches again.
  it('reads names from memory until a refresh, which finds names registered elsewhere and drops one sold away', async () => {
    network.names.set(IDENTIFIER, ['Owl.dash'])
    network.status = () => ({...UNCHECKED, status: 'registered', isContested: false, documentId: 'doc'})
    expect(await identities.getUsernames(walletId)).toMatchObject([
      {identifier: IDENTIFIER, label: 'Owl', normalizedLabel: '0w1', status: 'registered', documentId: 'doc'},
    ])

    network.names.set(IDENTIFIER, [])
    request.mockClear()
    expect(await identities.getUsernames(walletId)).toHaveLength(1)
    expect(request).not.toHaveBeenCalled()
    await identities.refreshDashPay(walletId)
    expect(await identities.getUsernames(walletId)).toEqual([])
  })

  // A contender has no domain document until it wins: only the explorer's index lists it.
  it('lists a contest this identity joined elsewhere, confirmed by its vote', async () => {
    network.contests.set('0w1', [ALICE, IDENTIFIER])
    network.contests.set('fr0g', [ALICE])
    network.status = () => ({...UNCHECKED, status: 'voting', voteEndsAt: 9})

    expect(await identities.getUsernames(walletId)).toMatchObject([{identifier: IDENTIFIER, label: '0w1', status: 'voting'}])
  })

  // The explorer lists a contest by its normalized label only.
  it('shows a name in a contest under the label its domain carries', async () => {
    network.names.set(IDENTIFIER, ['Owl.dash'])
    network.contests.set('0w1', [IDENTIFIER])
    network.status = () => ({...UNCHECKED, status: 'registered', documentId: 'doc'})

    expect((await identities.getUsernames(walletId)).map(username => username.label)).toEqual(['Owl'])
  })

  // The name is paid for once registerName returns, so a retry must not be invited.
  it('reports a registered name as sent even when the refresh after it fails', async () => {
    request.mockImplementation(async (kind: string, ...rest: [string, never]) => kind === 'identityInfos' ? Promise.reject(new Error('DAPI down')) : answer(kind, ...rest))

    network.status = () => ({...UNCHECKED, status: 'voting'})
    expect(await identities.registerUsername(walletId, IDENTIFIER, 'owl', PASSWORD)).toMatchObject({status: 'voting'})
  })

  it('keeps what was known of a name whose check fails', async () => {
    network.names.set(IDENTIFIER, ['owl.dash'])
    network.status = () => ({...UNCHECKED, status: 'registered', documentId: 'doc'})
    await identities.refreshDashPay(walletId)

    network.status = () => { throw new Error('DAPI down') }
    await identities.refreshDashPay(walletId)
    expect(await identities.getUsernames(walletId)).toMatchObject([{label: 'owl', status: 'registered', documentId: 'doc'}])
  })

  it('shares one refresh between reads that arrive together', async () => {
    await Promise.all([identities.getUsernames(walletId), identities.getDashPayContacts(walletId)])

    expect(request.mock.calls.filter(([kind]) => kind === 'dashPayContactRequests')).toHaveLength(1)
  })

  it('updates nothing for an empty or oversized update, a key listed twice, an identity outside the wallet or a wrong password', async () => {
    const key: IdentityKeyRequest = {purpose: 'AUTHENTICATION', securityLevel: 'HIGH', contractBounds: null}
    const update = (add: IdentityKeyRequest[], disable: number[] = []) => ({add, disable})
    await expect(identities.updateIdentityKeys(walletId, IDENTIFIER, update([]), PASSWORD)).rejects.toThrow('add or disable')
    await expect(identities.updateIdentityKeys(walletId, IDENTIFIER, update(Array(MAX_KEYS_PER_TRANSITION + 1).fill(key)), PASSWORD)).rejects.toThrow('at most')
    await expect(identities.updateIdentityKeys(walletId, IDENTIFIER, update([], Array.from({length: 11}, (_, i) => i)), PASSWORD)).rejects.toThrow('at most')
    await expect(identities.updateIdentityKeys(walletId, IDENTIFIER, update([], [1, 1]), PASSWORD)).rejects.toThrow('twice')
    await expect(identities.updateIdentityKeys(walletId, 'someone-else', update([key]), PASSWORD)).rejects.toThrow('Identity not found')
    await expect(identities.updateIdentityKeys(walletId, IDENTIFIER, update([key]), 'wrong')).rejects.toThrow('Invalid wallet password')
    expect(request).not.toHaveBeenCalledWith('identityUpdateKeys', expect.anything(), expect.anything())
  })

  it('pairs contact requests into contacts with their names, fetched again only on a refresh', async () => {
    network.requests = [dashPayContactRequest('sent', IDENTIFIER, ALICE, 10)]
    network.names.set(ALICE, ['alice.dash'])
    expect(await identities.getDashPayContacts(walletId)).toEqual([
      {identifier: IDENTIFIER, contactId: ALICE, relationship: 'outgoing', usernames: ['alice.dash'], incomingCreatedAt: null, outgoingCreatedAt: 10, paymentChannelBroken: false},
    ])
    expect(request).toHaveBeenCalledWith('dashPayContactRequests', 'testnet', {identifier: IDENTIFIER, since: 0})

    network.requests.push(dashPayContactRequest('received', ALICE, IDENTIFIER, 20))
    expect((await identities.getDashPayContacts(walletId))[0].relationship).toBe('outgoing')
    await identities.refreshDashPay(walletId)
    expect((await identities.getDashPayContacts(walletId))[0]).toMatchObject({relationship: 'established', incomingCreatedAt: 20})
  })

  // Paying a contact then needs no extra unlock to read the key they sent us.
  it("decrypts the key of a contact's request when accepting it, and keeps it across refreshes", async () => {
    network.requests = [dashPayContactRequest('theirs', ALICE, IDENTIFIER, 10)]

    await identities.sendDashPayContactRequest(walletId, IDENTIFIER, ALICE, PASSWORD)
    await identities.refreshDashPay(walletId)

    expect(dashPayCache.wallet(walletId).requests?.find(({id}) => id === 'theirs')?.contactXpub).toBe('tpub-alice')
  })

  it("decrypts a contact's key once and reads it from memory after that", async () => {
    network.requests = [dashPayContactRequest('theirs', ALICE, IDENTIFIER, 10)]
    const seed = new Uint8Array(64)

    expect(await identities.dashPayContactXpub(walletId, 'testnet', seed, IDENTIFIER, ALICE)).toBe('tpub-alice')
    expect(await identities.dashPayContactXpub(walletId, 'testnet', seed, IDENTIFIER, ALICE)).toBe('tpub-alice')
    expect(request.mock.calls.filter(([kind]) => kind === 'dashPayContactKey')).toHaveLength(1)
  })

  // A name alone carries no L1 address; only the contact's request does.
  it('refuses to pay someone who never sent this identity a contact request', async () => {
    network.requests = [dashPayContactRequest('ours', IDENTIFIER, ALICE, 10)]

    await expect(walletService.sendDashPayPayment(walletId, IDENTIFIER, ALICE, 100_000n, PASSWORD))
      .rejects.toThrow('This contact has not sent this identity a contact request')
    await expect(walletService.sendDashPayPayment(walletId, IDENTIFIER, ALICE, 100_000n, 'wrong'))
      .rejects.toThrow('Invalid wallet password')
  })

  // A request is immutable, so a fault in it is not retried on every payment.
  it('marks a contact unpayable when their key can never be decrypted, and stops trying', async () => {
    network.requests = [dashPayContactRequest('theirs', ALICE, IDENTIFIER, 10)]
    network.contactKey = null
    const seed = new Uint8Array(64)

    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(identities.dashPayContactXpub(walletId, 'testnet', seed, IDENTIFIER, ALICE)).rejects.toThrow('ask them to send you a new contact request')
    }
    expect(request.mock.calls.filter(([kind]) => kind === 'dashPayContactKey')).toHaveLength(1)
    expect((await identities.getDashPayContacts(walletId))[0].paymentChannelBroken).toBe(true)
  })
})
