import {DashPlatformSDK} from 'dash-platform-sdk'
import {
  Input,
  Output,
  PrivateKey,
  Transaction as SDKTransaction,
  utils as sdkUtils,
} from 'dash-core-sdk'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {WalletProvider} from '../providers/WalletProvider'
import {ProviderResolver} from '../providers/makeWalletProvider'
import {Network} from '../types'
import {Address} from '../types/Address'
import {UTXO} from '../types/UTXO'
import {decryptMnemonic} from '../utils'

const {addressToPublicKeyHash, publicKeyHashToAddress} = sdkUtils

const SEQUENCE_FINAL = 0xffffffff
// dash-core-sdk's NetworkLike uses capitalized enum keys; our app-wide
// Network is lowercase. Map at the boundary instead of widening Network.
const SDK_NETWORK: Record<Network, 'Mainnet' | 'Testnet'> = {mainnet: 'Mainnet', testnet: 'Testnet'}

export class TransactionService {
  constructor(
    private readonly walletDAO: WalletDAO,
    private readonly addressDAO: AddressDAO,
    private readonly sdk: DashPlatformSDK,
    private readonly getProvider: ProviderResolver,
  ) {}

  // Build, sign and broadcast a P2PKH transaction spending the wallet's
  // UTXOs to `toAddress`. amountSatoshis crosses IPC as a string because
  // BigInt is not IPC-serializable. Returns the broadcast txid.
  //
  // UTXOs and broadcast are both routed through the connection-mode
  // provider (P2P → SQL + Insight fallback for broadcast; RPC → Insight).
  async sendCoins(
    walletId: string,
    toAddress: string,
    amountSatoshis: string,
    password: string,
  ): Promise<string> {
    const amount = BigInt(amountSatoshis)
    if (amount <= 0n) {
      throw new Error('Amount must be greater than 0')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    this.assertAddressOnNetwork(toAddress, wallet.network)

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid password')
    }

    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const allAddresses = [...grouped.receiving, ...grouped.change]
    if (allAddresses.length === 0) {
      throw new Error('Wallet has no addresses')
    }

    const provider = this.getProvider(wallet.walletId, wallet.network)

    const utxosWithMeta = await this.collectUtxos(provider, allAddresses)
    if (utxosWithMeta.length === 0) {
      throw new Error('Insufficient funds')
    }

    const selected = this.selectUtxosGreedy(utxosWithMeta, amount)
    if (selected.totalIn < amount) {
      throw new Error('Insufficient funds')
    }

    const changeAddress = this.pickChangeAddress(grouped.change)

    const tx = this.buildTransaction(selected.utxos, toAddress, amount, changeAddress, selected.totalIn)

    const seed = this.sdk.keyPair.mnemonicToSeed(mnemonic)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, wallet.network)

    const privateKeys = await Promise.all(
      selected.utxos.map(async u => {
        const derived = await this.sdk.keyPair.derivePath(hdKey, u.address.derivationPath)
        if (!derived.privateKey) {
          throw new Error(`Failed to derive private key for ${u.address.address}`)
        }
        return PrivateKey.fromBytes(derived.privateKey, SDK_NETWORK[wallet.network], true)
      })
    )

    this.signTransactionMultiKey(tx, privateKeys)

    return provider.broadcastTx(tx)
  }

  private assertAddressOnNetwork(address: string, network: Network): void {
    let pkh: Uint8Array
    try {
      pkh = addressToPublicKeyHash(address)
    } catch {
      throw new Error('Invalid recipient address')
    }
    const roundTrip = publicKeyHashToAddress(pkh, SDK_NETWORK[network])
    if (roundTrip !== address) {
      throw new Error(`Recipient address is not a valid ${network} address`)
    }
  }

  private async collectUtxos(
    provider: WalletProvider,
    addresses: Address[],
  ): Promise<{utxo: UTXO; address: Address}[]> {
    const perAddress = await Promise.all(
      addresses.map(async addr => ({
        addr,
        utxos: await provider.getUTXOs(addr.address),
      }))
    )
    return perAddress.flatMap(({addr, utxos}) =>
      utxos.map(utxo => ({utxo, address: addr}))
    )
  }

  // Greedy largest-first. Stops once the accumulated input amount covers
  // `target + a generous fee headroom`. Fee math is deferred to
  // SDKTransaction.generateChange, which throws on real shortfall.
  private selectUtxosGreedy(
    candidates: {utxo: UTXO; address: Address}[],
    target: bigint,
  ): {utxos: {utxo: UTXO; address: Address}[]; totalIn: bigint} {
    const sorted = [...candidates].sort((a, b) =>
      a.utxo.satoshis > b.utxo.satoshis ? -1 : a.utxo.satoshis < b.utxo.satoshis ? 1 : 0
    )
    const picked: {utxo: UTXO; address: Address}[] = []
    let totalIn = 0n
    // Headroom: covers signed inputs + change output + recipient output + tx overhead at FEE_PER_BYTE=1.
    const feeHeadroom = (n: number): bigint => BigInt(n * 150 + 100)
    for (const c of sorted) {
      picked.push(c)
      totalIn += c.utxo.satoshis
      if (totalIn >= target + feeHeadroom(picked.length)) break
    }
    return {utxos: picked, totalIn}
  }

  private pickChangeAddress(change: Address[]): string {
    if (change.length === 0) {
      throw new Error('Wallet has no change addresses')
    }
    const unused = change.find(a => !a.isUsed)
    return (unused ?? change[0]).address
  }

  private buildTransaction(
    selected: {utxo: UTXO; address: Address}[],
    toAddress: string,
    amount: bigint,
    changeAddress: string,
    totalIn: bigint,
  ): SDKTransaction {
    const inputs = selected.map(({utxo}) => new Input(utxo.txId, utxo.vOut, utxo.script, SEQUENCE_FINAL))

    const recipientOutput = new Output(amount)
    recipientOutput.generateP2PKH(toAddress)

    const tx = new SDKTransaction(inputs, [recipientOutput])
    // generateChange computes fee internally (FEE_PER_BYTE) and only appends
    // a change output when worthwhile. Throws if totalIn < amount.
    tx.generateChange(changeAddress, totalIn)
    return tx
  }

  // Multi-key P2PKH signing. The SDK's tx.sign(privateKey) signs every input
  // with the same key — useless for an HD wallet whose UTXOs come from
  // different addresses. For each input i we clone the unsigned tx, call
  // sign(privKey[i]) on the clone (which produces a correct signature for
  // input i with the right key, wrong for others), then splice clone.inputs[i]
  // .scriptSig into the final tx. This delegates the secp256k1 / sighash
  // crypto to the SDK while still producing per-input correct signatures.
  private signTransactionMultiKey(tx: SDKTransaction, privateKeys: PrivateKey[]): void {
    if (tx.inputs.length !== privateKeys.length) {
      throw new Error('Input/key count mismatch')
    }
    const unsignedBytes = tx.bytes()
    for (let i = 0; i < tx.inputs.length; i++) {
      const clone = SDKTransaction.fromBytes(unsignedBytes)
      clone.sign(privateKeys[i])
      tx.inputs[i].scriptSig = clone.inputs[i].scriptSig
    }
  }
}
