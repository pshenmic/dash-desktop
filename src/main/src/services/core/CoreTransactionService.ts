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
import {Network} from '../../types/Network'
import {ADDRESS_DECODED_LENGTH, ADDRESS_PREFIX} from '../../constants/addresses'
import {DUST_THRESHOLD_DUFFS, SEQUENCE_FINAL} from '../../constants/chain'
import {
  BuildAssetLockParams,
  BuildSignedAssetLockParams,
  BuildSignedTransferParams,
  BuildTransferParams,
  RecipientType,
  TransferInput,
} from '../../types/CoreTransaction'
import {buildAssetLockOutputs} from '../../utils/assetLockTx'


export class CoreTransactionService {
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  classifyAddress(address: string, network: Network): RecipientType {
    let decoded: Uint8Array
    try {
      decoded = Base58Check.decode(address)
    } catch {
      throw new Error(`Invalid address: ${address}`)
    }
    if (decoded.length !== ADDRESS_DECODED_LENGTH) {
      throw new Error(`Invalid address: ${address}`)
    }
    const prefixes = ADDRESS_PREFIX[network]
    const version = decoded[0]
    if (version === prefixes.p2pkh) return 'p2pkh'
    if (version === prefixes.p2sh) return 'p2sh'
    throw new Error(`${address} is not a valid ${network} address`)
  }

  // Change is paid to a P2PKH output by construction, so a P2SH address named
  // as change would lock the change to a pubkey-hash script no one can spend.
  requireChangeAddress(address: string, network: Network): void {
    if (this.classifyAddress(address, network) !== 'p2pkh') {
      throw new Error('Change address must be a P2PKH address')
    }
  }

  // An input carries the script of the output it spends, which is what sighash
  // reads; signing replaces each one with the signature script. So an unsigned
  // transaction is these bytes with that substitution still to come.
  private addInputs(transaction: SDKTransaction, inputs: TransferInput[]): void {
    for (const input of inputs) {
      transaction.addInput(new Input(input.txId, input.vOut, input.script, SEQUENCE_FINAL))
    }
  }

  private async privateKeys(inputs: TransferInput[], seed: Uint8Array, network: Network): Promise<PrivateKey[]> {
    const hdKey = this.keyPair.seedToHdKey(seed, network)

    const privateKeys: PrivateKey[] = []
    for (const input of inputs) {
      const derived = await this.keyPair.derivePath(hdKey, input.derivationPath)
      if (!derived.privateKey) {
        throw new Error(`Failed to derive private key for ${input.address}`)
      }
      privateKeys.push(PrivateKey.fromBytes(derived.privateKey as Uint8Array, network, true))
    }
    return privateKeys
  }

  buildAssetLock(params: BuildAssetLockParams): SDKTransaction {
    const {inputs, amountDuffs, creditAddress, changeAddress, inputTotal, feeDuffs} = params

    const {burnOutput, extraPayload} = buildAssetLockOutputs(amountDuffs, creditAddress)
    const transaction = new SDKTransaction(undefined, undefined, undefined, 3, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload)

    this.addInputs(transaction, inputs)
    transaction.addOutput(burnOutput)
    this.addChange(transaction, inputTotal - amountDuffs - feeDuffs, changeAddress)

    return transaction
  }

  async buildSignedAssetLock(params: BuildSignedAssetLockParams): Promise<SDKTransaction> {
    const transaction = this.buildAssetLock(params)
    transaction.sign(await this.privateKeys(params.inputs, params.seed, params.network))

    return transaction
  }

  private addChange(transaction: SDKTransaction, change: bigint, changeAddress: string): void {
    if (change < 0n) {
      throw new Error('Selected inputs do not cover the amount and network fee')
    }
    if (change >= DUST_THRESHOLD_DUFFS) {
      transaction.addOutput(Output.createP2PKH(change, changeAddress))
    }
  }

  buildTransfer(params: BuildTransferParams): SDKTransaction {
    const {inputs, outputs, changeAddress, inputTotal, feeDuffs} = params

    const transaction = new SDKTransaction()
    this.addInputs(transaction, inputs)

    let outputTotal = 0n
    for (const output of outputs) {
      const recipientOutput = new Output(output.amountDuffs)
      if (output.recipientType === 'p2sh') {
        recipientOutput.script = this.p2shScript(output.address)
      } else {
        recipientOutput.generateP2PKH(output.address)
      }
      transaction.addOutput(recipientOutput)
      outputTotal += output.amountDuffs
    }

    this.addChange(transaction, inputTotal - outputTotal - feeDuffs, changeAddress)

    return transaction
  }

  async buildSignedTransfer(params: BuildSignedTransferParams): Promise<SDKTransaction> {
    const transaction = this.buildTransfer(params)
    transaction.sign(await this.privateKeys(params.inputs, params.seed, params.network))

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
