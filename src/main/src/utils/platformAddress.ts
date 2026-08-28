import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../database/WalletDAO'
import {Network} from '../types/Network'
import {Wallet} from '../types/Wallet'
import {AddressDeriver} from '../types/AddressWindow'
import {COIN_TYPE, PLATFORM_ACCOUNT} from '../constants/addresses'

const keyPair = new KeyPairController()

// The DIP-17 account xpub every platform address derives from. It is persisted,
// but wallets created before that column have to derive it once — and only a
// caller holding the seed can. Doing the backfill here keeps one derivation of
// the account node rather than one per call site.
export async function platformAccountXpub(walletDAO: WalletDAO, wallet: Wallet, seed: Uint8Array): Promise<string> {
  if (wallet.platformXpub != null) return wallet.platformXpub

  const xpub = await keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
  await walletDAO.setPlatformXpub(wallet.walletId, xpub)
  return xpub
}

// DIP-17 clear-funds chain of the persisted account xpub. The address index is
// non-hardened, so this reproduces the seed-derived address without a password.
export function platformAddressDeriver(xpub: string, network: Network): AddressDeriver {
  const chainPath = `m/9'/${COIN_TYPE[network]}'/17'/${PLATFORM_ACCOUNT}'/0'`
  return {
    derive: index => ({
      index,
      address: keyPair.derivePlatformAddressFromXpub(xpub, network, index).toBech32m(network),
      derivationPath: `${chainPath}/${index}`,
    }),
  }
}
