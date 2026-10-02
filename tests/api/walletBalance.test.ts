import {describe, it, expect, beforeEach, vi} from 'vitest'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletProvider} from '../../src/main/src/providers/WalletProvider'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {CoreDiscoveryService} from '../../src/main/src/services/core/CoreDiscoveryService'
import {ApplicationService} from '../../src/main/src/services/app/ApplicationService'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const providerStub = (walletBalance: bigint): WalletProvider => ({
  getWalletBalance: async () => walletBalance,
  // Reaching this means the wallet total went back to summing whatever address
  // list the caller passed.
  getBalance: async () => { throw new Error('per-address balance is not the wallet total') },
  getWalletUtxos: async () => [],
  ensureReady: async () => undefined,
  getConnectionStatus: async () => 'online',
  scanAddressUsage: async () => null,
  getUsedAddresses: async () => [],
  getWalletTransactions: async () => [],
  getAddressInfos: async () => [],
  getTransactionByHash: async () => { throw new Error('unused') },
  getTxLockStatus: async () => ({instantLocked: false, chainlocked: false, confirmed: false}),
  nextUnusedAddress: async () => '',
})

describe('wallet balance', () => {
  let walletService: WalletService
  let providers: WalletProviderFactory
  let discovery: CoreDiscoveryService
  let applicationService: ApplicationService
  let createWalletHandler: CreateWalletHandler
  let request: ReturnType<typeof vi.fn>
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    walletService = wired.walletService
    providers = wired.providers
    discovery = wired.coreDiscoveryService
    applicationService = wired.applicationService
    createWalletHandler = wired.createWalletHandler
    request = wired.request
    walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
  })

  it('reports the provider total rather than a per-address sum', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub(4_820_046_182_581n))
    request.mockResolvedValue({infos: []})

    const balance = await walletService.getWalletBalance(walletId)

    expect(balance.dash.amount).toBe(4_820_046_182_581n)
    expect(balance.credits.amount).toBe(0n)
  })

  it('waits for xpub discovery before reading RPC balance and history', async () => {
    applicationService.preferences.general.connectionType = 'rpc'
    const order: string[] = []
    vi.spyOn(discovery, 'ensureXpubAddressWindow').mockImplementation(async () => {
      order.push('discovery')
    })
    vi.spyOn(providers, 'forWallet').mockImplementation(() => {
      order.push('provider')
      return providerStub(0n)
    })
    request.mockResolvedValue({infos: []})

    await walletService.getWalletBalance(walletId)
    await walletService.getTransactions(walletId)

    expect(order).toEqual(['discovery', 'provider', 'discovery', 'provider'])
  })

  it('does not run xpub discovery for p2p reads', async () => {
    const ensureXpubAddressWindow = vi.spyOn(discovery, 'ensureXpubAddressWindow')
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub(0n))
    request.mockResolvedValue({infos: []})

    await walletService.getWalletBalance(walletId)
    await walletService.getTransactions(walletId)

    expect(ensureXpubAddressWindow).not.toHaveBeenCalled()
  })

  // An alias costs a DPNS document search per identity, and the total never
  // reads one.
  it('does not pay for aliases it never reads', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub(0n))
    request.mockResolvedValue({infos: []})

    await walletService.getWalletBalance(walletId)

    expect(request).toHaveBeenCalledWith(
      'identityInfos',
      'testnet',
      expect.objectContaining({skipDPNS: true}),
    )
  })

  it('still adds identity credits alongside it', async () => {
    vi.spyOn(providers, 'forWallet').mockReturnValue(providerStub(1_000n))
    request.mockResolvedValue({infos: [{balance: 500n}, {balance: 250n}]})

    const balance = await walletService.getWalletBalance(walletId)

    expect(balance.dash.amount).toBe(1_000n)
    expect(balance.credits.amount).toBe(750n)
  })
})
