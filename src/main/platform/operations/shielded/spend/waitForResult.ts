import {DashPlatformSDK} from 'dash-platform-sdk'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {SpendKind} from '../../../types/messages'
import {consensusMessage} from '../../consensusMessage'

export async function waitForResult(
  sdk: DashPlatformSDK,
  st: StateTransitionWASM,
  kind: SpendKind,
): Promise<void> {
  try {
    await sdk.stateTransitions.waitForStateTransitionResult(st)
  } catch (e) {
    const message = consensusMessage(e)
    // The withdrawal is already included; the SDK just cannot verify the proof
    // without the withdrawals contract.
    if (kind === 'withdrawal' && /withdrawals contract not available/i.test(message)) {
      console.warn('[platform] skipping local proof verification:', message)
      return
    }
    throw new Error(message)
  }
}