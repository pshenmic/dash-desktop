import {describe, it, expect, beforeEach, vi} from 'vitest'
import {WalletService} from '../../src/main/src/services/core/WalletService'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const IDENTIFIER = 'GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec'

describe('listing identities', () => {
  let walletService: WalletService
  let identityDAO: IdentityDAO
  let createWalletHandler: CreateWalletHandler
  let request: ReturnType<typeof vi.fn>
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    walletService = wired.walletService
    identityDAO = wired.identityDAO
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

    const identities = await walletService.getIdentities(walletId)

    expect(request).toHaveBeenCalledWith(
      'identityInfos',
      'testnet',
      expect.objectContaining({skipDPNS: false}),
    )
    expect(identities[0]!.alias).toBe('alice.dash')
  })

  it('skips an identity Platform does not know yet', async () => {
    request.mockResolvedValue({infos: []})

    expect(await walletService.getIdentities(walletId)).toEqual([])
  })
})
