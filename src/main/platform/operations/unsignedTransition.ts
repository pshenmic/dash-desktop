import {OutputAddressWASM, StateTransitionWASM} from 'dash-platform-sdk/types.js'
import {coreAddressToScript} from '../../src/utils/coreScript'
import {PlatformOperations, Recipient, UnsignedTransition} from '../types/messages'
import {OperationContext} from './types'
import {toFeeStrategy, toInputAddresses} from './address/signInputs'

type Result = PlatformOperations['previewTransition']['result']

const outputAddresses = (recipients: Recipient[]): OutputAddressWASM[] =>
  recipients.map(recipient => new OutputAddressWASM(recipient.address, recipient.amountCredits))

// Every transition the wallet builds, before anything signs it. The sends build
// theirs here too and then fill in their signatures, so what a preview
// serializes is the transition that will be broadcast rather than a second
// construction of one.
export function unsignedTransition(request: UnsignedTransition, ctx: OperationContext): StateTransitionWASM {
  const {sdk, network} = ctx

  switch (request.kind) {
    case 'addressFundsTransfer':
      return sdk.platformAddresses.createStateTransition('addressFundsTransfer', {
        inputs: toInputAddresses(request.inputs),
        feeStrategy: toFeeStrategy(request.feeStrategy),
        outputs: outputAddresses(request.recipients),
        inputWitness: [],
        userFeeIncrease: 0,
      })

    case 'addressWithdrawal':
      return sdk.platformAddresses.createStateTransition('addressCreditWithdrawal', {
        inputs: toInputAddresses(request.inputs),
        feeStrategy: toFeeStrategy(request.feeStrategy),
        outputScript: coreAddressToScript(request.coreAddress, network),
        coreFeePerByte: request.coreFeePerByte,
        pooling: 'Never',
        inputWitness: [],
        userFeeIncrease: 0,
      })

    case 'identityTopUpFromAddresses':
      return sdk.platformAddresses.createStateTransition('identityTopUpFromAddresses', {
        identityId: request.identifier,
        inputs: toInputAddresses(request.inputs),
        feeStrategy: toFeeStrategy(request.feeStrategy),
        inputWitness: [],
        userFeeIncrease: 0,
      })

    case 'identityCreditsToAddresses':
      return sdk.platformAddresses.createStateTransition('identityCreditTransferToAddresses', {
        identityId: request.identifier,
        recipients: outputAddresses(request.recipients),
        nonce: request.nonce,
        userFeeIncrease: 0,
      })

    case 'identityCreditTransfer':
      return sdk.identities.createStateTransition('creditTransfer', {
        identityId: request.identifier,
        recipientId: request.recipientIdentifier,
        amount: request.amountCredits,
        identityNonce: request.nonce,
      })

    case 'identityWithdrawal':
      return sdk.identities.createStateTransition('withdrawal', {
        identityId: request.identifier,
        amount: request.amountCredits,
        coreFeePerByte: request.coreFeePerByte,
        pooling: 'Never',
        identityNonce: request.nonce,
        outputScript: coreAddressToScript(request.coreAddress, network),
      })
  }
}

export function previewTransition(payload: UnsignedTransition, ctx: OperationContext): Result {
  return {unsignedHex: unsignedTransition(payload, ctx).hex()}
}
