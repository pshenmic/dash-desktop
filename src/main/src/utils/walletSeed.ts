import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../database/WalletDAO'
import {UnlockedWallet} from '../types/UnlockedWallet'
import {decryptMnemonic} from './index'

// Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
// evonode list to do local maths.
const keyPair = new KeyPairController()


// Decrypts the mnemonic once and keeps only the seed, so the password stops at
// whichever method the user handed it to. Callers own the seed's lifetime.
export async function unlockWallet(walletDAO: WalletDAO, walletId: string, password: string): Promise<UnlockedWallet> {
  const wallet = await walletDAO.getWalletById(walletId)
  if (wallet == null) {
    throw new Error('Wallet not found')
  }

  let mnemonic: string
  try {
    mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
  } catch {
    throw new Error('Invalid wallet password')
  }

  return {wallet, seed: keyPair.mnemonicToSeed(mnemonic)}
}

// Every spending key in the wallet derives from this seed, and an asset lock
// job holds it across minutes of waiting for a lock. Overwrite it the moment
// the job settles rather than leaving it for the GC to maybe reclaim.
//
// This narrows the window, it does not close it: decryptMnemonic returns a JS
// string, which cannot be overwritten, so the mnemonic behind the seed outlives
// every call here.
export function zeroSeed(unlocked: {seed: Uint8Array}): void {
  unlocked.seed.fill(0)
}

// For work that finishes before the caller returns. A funding job outlives its
// entry method, so it unlocks directly and zeroes in its own settlement.
export async function withUnlockedWallet<T>(
  walletDAO: WalletDAO,
  walletId: string,
  password: string,
  work: (unlocked: UnlockedWallet) => Promise<T>,
): Promise<T> {
  const unlocked = await unlockWallet(walletDAO, walletId, password)
  try {
    return await work(unlocked)
  } finally {
    zeroSeed(unlocked)
  }
}