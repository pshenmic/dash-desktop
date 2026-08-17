import {WalletDAO} from '../database/WalletDAO'
import {Wallet} from '../types/Wallet'

export async function requireWallet(walletDAO: WalletDAO, walletId: string): Promise<Wallet> {
  const wallet = await walletDAO.getWalletById(walletId)
  if (wallet == null) {
    throw new Error('Wallet not found')
  }
  return wallet
}

export async function requireSelectedWallet(walletDAO: WalletDAO): Promise<Wallet> {
  const wallet = await walletDAO.getSelectedWallet()
  if (wallet == null) {
    throw new Error('No selected wallet found')
  }
  return wallet
}
