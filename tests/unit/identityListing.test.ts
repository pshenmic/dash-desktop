import {describe, expect, it, vi} from 'vitest'
import type {DashPlatformSDK} from 'dash-platform-sdk'
import {WalletService} from '../../src/main/src/services/WalletService'
import type {WalletDAO} from '../../src/main/src/database/WalletDAO'
import type {AddressDAO} from '../../src/main/src/database/AddressDAO'
import type {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import type {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import type {ApplicationService} from '../../src/main/src/services/ApplicationService'
import type {WalletSyncService} from '../../src/main/src/services/WalletSyncService'
import type {SdkProvider} from '../../src/main/src/providers/SdkProvider'
import type {ShieldedService} from '../../src/main/src/services/ShieldedService'

const WALLET_ID = 'wallet-1'
const IDENTITY_ID = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

describe('WalletService.getIdentities', () => {
  it('keeps a valid imported identity visible when its optional DPNS lookup fails', async () => {
    const walletDAO = {
      getWalletById: vi.fn().mockResolvedValue({
        walletId: WALLET_ID,
        network: 'mainnet',
      }),
    } as unknown as WalletDAO
    const identityDAO = {
      getIdentitiesByWalletId: vi.fn().mockResolvedValue([{
        walletId: WALLET_ID,
        identityIndex: -1,
        derivationPath: '',
        identifier: IDENTITY_ID,
        assetLockTxid: null,
        isImported: true,
      }]),
    } as unknown as IdentityDAO
    const sdk = {
      identities: {
        getIdentityByIdentifier: vi.fn().mockResolvedValue({
          id: {base58: () => IDENTITY_ID},
          balance: 42_000_000n,
        }),
      },
      names: {
        searchByIdentity: vi.fn().mockRejectedValue(new Error('DPNS unavailable')),
      },
    } as unknown as DashPlatformSDK
    const sdkProvider = {
      getPlatformSDK: vi.fn().mockReturnValue(sdk),
    } as unknown as SdkProvider

    const service = new WalletService(
      walletDAO,
      {} as AddressDAO,
      identityDAO,
      {} as TransactionDAO,
      {} as ApplicationService,
      {} as WalletSyncService,
      sdkProvider,
      1_000,
      {} as ShieldedService,
    )

    await expect(service.getIdentities(WALLET_ID)).resolves.toEqual([{
      identityIndex: -1,
      identifier: IDENTITY_ID,
      alias: null,
      balance: {
        amount: 42_000_000n,
        usdAmount: '0.0',
      },
      derivationPath: '',
      assetLockTxid: null,
      isImported: true,
    }])
  })
})
