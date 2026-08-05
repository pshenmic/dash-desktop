import {
  Input,
  Output,
  Script,
  Transaction as SDKTransaction,
  TransactionType,
  utils as sdkUtils,
} from 'dash-core-sdk'
import {ASSET_LOCK_TX_VERSION, SEQUENCE_FINAL} from '../constants'
import {BuildAssetLockTxParams, BuildTransferTxParams, DraftInput} from '../types/CoreTransaction'
import {buildAssetLockOutputs} from './assetLockTx'

function addInputs(transaction: SDKTransaction, inputs: DraftInput[]): void {
  for (const input of inputs) {
    transaction.addInput(new Input(input.txId, input.vOut, input.script, SEQUENCE_FINAL))
  }
}

function p2shScript(address: string): Script {
  const script = new Script()
  script.pushOpCode('OP_HASH160')
  script.pushOpCode('OP_PUSHBYTES_20', sdkUtils.addressToPublicKeyHash(address))
  script.pushOpCode('OP_EQUAL')
  return script
}

export function buildTransferTx(params: BuildTransferTxParams): SDKTransaction {
  const {inputs, toAddress, recipientType, amountDuffs, changeAddress, inputTotal} = params

  const transaction = new SDKTransaction()
  addInputs(transaction, inputs)

  const recipientOutput = new Output(amountDuffs)
  if (recipientType === 'p2sh') {
    recipientOutput.script = p2shScript(toAddress)
  } else {
    recipientOutput.generateP2PKH(toAddress)
  }
  transaction.addOutput(recipientOutput)
  transaction.generateChange(changeAddress, inputTotal)

  return transaction
}

export function buildAssetLockTx(params: BuildAssetLockTxParams): SDKTransaction {
  const {inputs, amountDuffs, creditAddress, changeAddress, inputTotal} = params

  const {burnOutput, extraPayload} = buildAssetLockOutputs(amountDuffs, creditAddress)
  const transaction = new SDKTransaction(undefined, undefined, undefined, ASSET_LOCK_TX_VERSION, TransactionType.TRANSACTION_ASSET_LOCK, extraPayload)
  addInputs(transaction, inputs)

  transaction.addOutput(burnOutput)
  transaction.generateChange(changeAddress, inputTotal)

  return transaction
}
