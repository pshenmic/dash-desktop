import {
  Input,
  Output,
  PrivateKey,
  Script,
  Transaction as SDKTransaction,
  TransactionType,
  utils as sdkUtils,
} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {Network} from '../types/Network'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX, SEQUENCE_FINAL} from '../constants'
import {BuildSignedTransferParams, RecipientType, TransferInput} from '../types/CoreTransaction'
import {buildAssetLockOutputs} from '../utils/assetLockTx'


export class CoreTransactionService {
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  classifyRecipientAddress(address: string, network: Network): RecipientType {
    let decoded: Uint8Array
    try {
      decoded = Base58Check.decode(address)
    } catch {
      throw new Error('Invalid recipient address')
    }
    if (decoded.length !== ADDRESS_DECODED_LENGTH) {
      throw new Error('Invalid recipient address')
    }
    const prefixes = ADDRESS_PREFIX[network]
    const version = decoded[0]
    if (version === prefixes.p2pkh) return 'p2pkh'
    if (version === prefixes.p2sh) return 'p2sh'
    throw new Error(`Recipient address is not a valid ${network} address`)
  }

  private async addSignableInputs(transaction: SDKTransaction, inputs: TransferInput[], seed: Uint8Array, network: Network): Promise<PrivateKey[]> {
    const hdKey = this.keyPair.seedToHdKey(seed, network)

    const privateKeys: PrivateKey[] = []
    for (const input of inputs) {
      transaction.addInput(new Input(input.txId, input.vOut, input.script, SEQUENCE_FINAL))

      const derived = await this.keyPair.derivePath(hdKey, input.derivationPath)
      if (!derived.privateKey) {
        throw new Error(`Failed to derive private key for ${input.address}`)
      }
      privateKeys.push(PrivateKey.fromBytes(derived.privateKey as Uint8Array, network, true))
    }
    return privateKeys
  }

  async buildSignedAssetLock(params: {
    inputs: TransferInput[]
    amountDuffs: bigint
    creditAddress: string
    changeAddress: string
    inputTotal: bigint
    seed: Uint8Array
    network: Network
  }): Promise<SDKTransaction> {
    const {inputs, amountDuffs, creditAddress, changeAddress, inputTotal, seed, network} = params

    const {burnOutput, extraPayload} = buildAssetLockOutputs(amountDuffs, creditAddress)
    const transaction = new SDKTransaction(undefined, undefined, undefined, 3, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload)

    const privateKeys = await this.addSignableInputs(transaction, inputs, seed, network)

    transaction.addOutput(burnOutput)
    transaction.generateChange(changeAddress, inputTotal)
    transaction.sign(privateKeys)

    return transaction
  }

  async buildSignedTransfer(params: BuildSignedTransferParams): Promise<SDKTransaction> {
    const {inputs, toAddress, recipientType, amount, changeAddress, inputTotal, seed, network} = params

    const transaction = new SDKTransaction()
    const privateKeys = await this.addSignableInputs(transaction, inputs, seed, network)

    const recipientOutput = new Output(amount)
    if (recipientType === 'p2sh') {
      recipientOutput.script = this.p2shScript(toAddress)
    } else {
      recipientOutput.generateP2PKH(toAddress)
    }
    transaction.addOutput(recipientOutput)
    transaction.generateChange(changeAddress, inputTotal)
    transaction.sign(privateKeys)

    return transaction
  }

  private p2shScript(address: string): Script {
    const script = new Script()
    script.pushOpCode('OP_HASH160')
    script.pushOpCode('OP_PUSHBYTES_20', sdkUtils.addressToPublicKeyHash(address))
    script.pushOpCode('OP_EQUAL')
    return script
  }
}
