import {DashPlatformSDK} from 'dash-platform-sdk'
import {StateTransitionWASM} from 'pshenmic-dpp'
import {PoolSpendOperation} from '../../../types/messages'
import {consensusMessage} from '../../consensusMessage'

export async function waitForResult(
  sdk: DashPlatformSDK,
  st: StateTransitionWASM,
  kind: PoolSpendOperation,
): Promise<void> {
  try {
    await sdk.stateTransitions.waitForStateTransitionResult(st)
  } catch (e) {
    const message = consensusMessage(e)
    // The withdrawal is already included; the SDK just cannot verify the proof
    // without the withdrawals contract.
    if (kind === 'shieldedWithdrawal' && /withdrawals contract not available/i.test(message)) {
      console.warn('[platform] skipping local proof verification:', message)
      return
    }
    throw new Error(message)
  }
}