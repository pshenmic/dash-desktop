import {HDKey} from '@scure/bip32'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Network} from '../types/Network'
import {WalletDAO} from '../database/WalletDAO'
import {FundingXpubs, Wallet} from '../types/Wallet'
import {AddressDeriver, DerivedAddress} from '../types/AddressWindow'
import {FundingKeyUsage} from '../types/AssetLockRecovery'
import {COIN_TYPE, FUNDING_KEY_USAGE, HD_VERSIONS} from '../constants/addresses'

const keyPair = new KeyPairController()

export function fundingAccountPath(network: Network, usage: FundingKeyUsage): string {
  return `m/9'/${COIN_TYPE[network]}'/5'/${FUNDING_KEY_USAGE[usage]}'`
}

export function fundingKeyPath(network: Network, usage: FundingKeyUsage, index: number): string {
  return `${fundingAccountPath(network, usage)}/${index}`
}

export async function deriveFundingXpubs(seed: Uint8Array, network: Network): Promise<FundingXpubs> {
  const hdKey = keyPair.seedToHdKey(seed, network)
  const [registration, topUp] = await Promise.all([
    keyPair.derivePath(hdKey, fundingAccountPath(network, 'registration')),
    keyPair.derivePath(hdKey, fundingAccountPath(network, 'topUp')),
  ])
  return {registrationFundingXpub: registration.publicExtendedKey, topUpFundingXpub: topUp.publicExtendedKey}
}

// Wallets created before the columns existed are backfilled by whichever caller
// first holds the seed.
export async function fundingXpubs(walletDAO: WalletDAO, wallet: Wallet, seed: Uint8Array): Promise<FundingXpubs> {
  const {registrationFundingXpub, topUpFundingXpub} = wallet
  if (registrationFundingXpub != null && topUpFundingXpub != null) return {registrationFundingXpub, topUpFundingXpub}

  const xpubs = await deriveFundingXpubs(seed, wallet.network)
  await walletDAO.setFundingXpubs(wallet.walletId, xpubs)
  return xpubs
}

// The index level is non-hardened, so the branch xpub reproduces every credit
// address the seed would.
export function fundingAddressDeriver(xpub: string, network: Network, usage: FundingKeyUsage): AddressDeriver {
  const accountNode = HDKey.fromExtendedKey(xpub, HD_VERSIONS[network])
  return {
    derive: index => {
      const {publicKey} = accountNode.deriveChild(index)
      if (publicKey == null) {
        throw new Error(`Could not derive ${usage} funding key at index ${index}`)
      }
      return {index, address: keyPair.p2pkhAddress(publicKey, network), derivationPath: fundingKeyPath(network, usage, index)}
    },
  }
}

export function findDerivedAddress(deriver: AddressDeriver, address: string, limit: number): DerivedAddress | null {
  for (let index = 0; index < limit; index++) {
    const derived = deriver.derive(index)
    if (derived.address === address) return derived
  }
  return null
}
