import {describe, it, expect, beforeEach, vi} from 'vitest'
import {IdentityService} from '../../src/main/src/services/platform/IdentityService'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {AliasDAO} from '../../src/main/src/database/AliasDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {AliasCheck} from '../../src/main/src/types/Alias'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const IDENTIFIER = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

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
    request.mockResolvedValue({infos: [{identifier: IDENTIFIER, balance: 5n, alias: 'alice.dash'}]})

    const listed = await identities.getIdentities(walletId)

    expect(request).toHaveBeenCalledWith(
      'identityInfos',
      'testnet',
      expect.objectContaining({skipDPNS: false}),
    )
    expect(listed[0]!.alias).toBe('alice.dash')
  })

  it('skips an identity Platform does not know yet', async () => {
    request.mockResolvedValue({infos: []})

    expect(await identities.getIdentities(walletId)).toEqual([])
  })

  it('keeps a pending name pending until the chain shows it, then follows its vote', async () => {
    await aliasDAO.save({
      ...UNCHECKED, walletId, identifier: IDENTIFIER, label: 'owl', normalizedLabel: '0w1',
      status: 'pending', createdAt: 1, checkedAt: null,
    })
    let check = UNCHECKED
    request.mockImplementation(async (kind: string) => kind === 'aliasStatus' ? check : {infos: []})

    await identities.getIdentities(walletId)
    expect((await aliasDAO.getUnsettled(walletId))[0]).toMatchObject({status: 'pending'})

    check = {...UNCHECKED, status: 'voting', votesFor: 4, votesLock: 1, votesAbstain: 0, voteEndsAt: 5_400_000}
    await identities.getIdentities(walletId)
    expect((await aliasDAO.getUnsettled(walletId))[0]).toMatchObject({status: 'voting', votesFor: 4, voteEndsAt: 5_400_000})

    check = {...check, status: 'registered', documentId: 'doc'}
    await identities.getIdentities(walletId)
    expect(await aliasDAO.getUnsettled(walletId)).toEqual([])
    expect(request).toHaveBeenCalledWith('aliasStatus', 'testnet', {identifier: IDENTIFIER, label: 'owl'})
  })
})
