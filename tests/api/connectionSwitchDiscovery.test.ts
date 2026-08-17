import {describe, it, expect, beforeEach, vi} from 'vitest'
import {SetConnectionTypeHandler} from '../../src/main/src/api/setConnectionType'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {CoreDiscoveryService} from '../../src/main/src/services/core/CoreDiscoveryService'
import {ApplicationService} from '../../src/main/src/services/app/ApplicationService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

describe('connection type switch', () => {
  let walletService: WalletService
  let discovery: CoreDiscoveryService
  let applicationService: ApplicationService
  let createWalletHandler: CreateWalletHandler
  let walletDAO: WalletDAO
  let handler: SetConnectionTypeHandler
  let rediscover: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    const wired = await harness()
    walletService = wired.walletService
    discovery = wired.coreDiscoveryService
    applicationService = wired.applicationService
    createWalletHandler = wired.createWalletHandler
    walletDAO = wired.walletDAO
    // Discovery under 'rpc' would reach the Dashscan API.
    rediscover = vi.spyOn(discovery, 'rediscoverCoreAddresses').mockResolvedValue(undefined)
    handler = new SetConnectionTypeHandler(applicationService, walletService, discovery)
  })

  it('rediscovers addresses for the selected wallet when the mode changes', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    await walletDAO.setSelectedWallet(walletId)

    const result = await handler.handle(null as never, 'rpc')

    expect(result).toEqual({success: true, errorMessage: null})
    expect(applicationService.preferences.general.connectionType).toBe('rpc')
    expect(rediscover).toHaveBeenCalledWith(walletId)
  })

  it('does not rediscover when the mode is re-applied unchanged', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    await walletDAO.setSelectedWallet(walletId)

    await handler.handle(null as never, 'p2p')

    expect(rediscover).not.toHaveBeenCalled()
  })

  it('still applies the preference with no wallet selected', async () => {
    const result = await handler.handle(null as never, 'rpc')

    expect(result).toEqual({success: true, errorMessage: null})
    expect(rediscover).not.toHaveBeenCalled()
  })
})