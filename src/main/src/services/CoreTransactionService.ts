import {DashPlatformSDK} from 'dash-platform-sdk'
import {
  Input,
  Output,
  PrivateKey,
  Script,
  Transaction as SDKTransaction,
  utils as sdkUtils,
} from 'dash-core-sdk'
import {Base58Check} from 'dash-core-sdk/src/base58check.js'
import {Network} from '../types'
import {ADDRESS_PREFIX, SEQUENCE_FINAL} from '../constants'

export type RecipientType = 'p2pkh' | 'p2sh'

const ADDRESS_DECODED_LENGTH = 21

export interface TransferInput {
  txId: string
  vOut: number
  script: Script
  derivationPath: string
  address: string
}

export interface BuildSignedTransferParams {
  inputs: TransferInput[]
  toAddress: string
  recipientType: RecipientType
  amount: bigint
  changeAddress: string
  inputTotal: bigint
  mnemonic: string
  network: Network
}

export class CoreTransactionService {
  constructor(
    private readonly sdk: DashPlatformSDK,
  ) {}

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

  async buildSignedTransfer(params: BuildSignedTransferParams): Promise<SDKTransaction> {
    const {inputs, toAddress, recipientType, amount, changeAddress, inputTotal, mnemonic, network} = params

    const seed = this.sdk.keyPair.mnemonicToSeed(mnemonic)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)

    const transaction = new SDKTransaction()
    const privateKeys: PrivateKey[] = []

    for (const input of inputs) {
      transaction.addInput(new Input(input.txId, input.vOut, input.script, SEQUENCE_FINAL))

      const derived = await this.sdk.keyPair.derivePath(hdKey, input.derivationPath)
      if (!derived.privateKey) {
        throw new Error(`Failed to derive private key for ${input.address}`)
      }
      privateKeys.push(PrivateKey.fromBytes(derived.privateKey as Uint8Array, network, true))
    }

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
