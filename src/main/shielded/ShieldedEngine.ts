import {DashPlatformSDK} from 'dash-platform-sdk'
import {
  IdentityCreateFromShieldedPoolTransitionWASM,
  OrchardAddressWASM,
  OutPointWASM,
  PrivateKeyWASM,
  RecoveredNoteWASM,
  ShieldedMemoWASM,
  ShieldedTransferTransitionWASM,
  ShieldedWithdrawalTransitionWASM,
  StateTransitionWASM,
  UnshieldTransitionWASM,
} from 'pshenmic-dpp'
import {InputAddressWASM, AddressFundsFeeStrategyStepWASM, AssetLockProofWASM, IdentityPublicKeyInCreation} from 'dash-platform-sdk/types.js'
import {Network} from '../src/types'
import {coreAddressToScript} from '../src/utils/coreScript'
import {IDENTITY_KEY_DEFINITIONS} from '../src/utils/identityKeys'
import {maxSpendableCredits, selectSpendNotes, SpendFeeForCount} from '../src/utils/shieldedNoteSelection'
import {minimumShieldedFeeCredits, shieldedWithdrawalFeeCredits, unshieldFeeCredits} from '../src/utils/shieldedFee'
import {ShieldedCommand, ShieldedEvent, ShieldedNoteSnapshot, ShieldedSpendKind} from './types/messages'

type SyncCommand = Extract<ShieldedCommand, {type: 'sync'}>
type SpendCommand = Extract<ShieldedCommand, {type: 'spend'}>
type ShieldCommand = Extract<ShieldedCommand, {type: 'shield'}>
type ShieldFromAssetLockCommand = Extract<ShieldedCommand, {type: 'shieldFromAssetLock'}>

type EncryptedNote = Awaited<ReturnType<DashPlatformSDK['shielded']['getShieldedEncryptedNotes']>>[number]

const SHIELDED_ACCOUNT = 0
const PLATFORM_ACCOUNT = 0
const COIN_TYPE: Record<Network, number> = { mainnet: 5, testnet: 1 }
const WITHDRAWAL_CORE_FEE_PER_BYTE = 1
// Platform caps state transitions at ~20KB and the Halo2 proof grows with the
// number of Orchard actions, so spends are limited to 6 notes per transition.
const MAX_SPEND_NOTES = 6
// Notes spent before local bookkeeping existed (or by another install) are
// only detectable on-chain: a built transition exposes its action nullifiers,
// so stale selections are caught before broadcast and repaired by re-selecting.
const MAX_SPEND_ATTEMPTS = 3
const SHIELD_FUNDING_DUMMY_OUTPUTS = 1

export class ShieldedEngine {
  private sdk: DashPlatformSDK
  private emit: (event: ShieldedEvent) => void
  private proverReady = false
  private proverInit: Promise<void> | null = null

  constructor(sdk: DashPlatformSDK, emit: (event: ShieldedEvent) => void) {
    this.sdk = sdk
    this.emit = emit
  }

  async initProver(): Promise<void> {
    if (this.proverReady) {
      this.emit({type: 'proverStatus', state: 'ready', error: null})
      return
    }
    if (this.proverInit == null) {
      this.emit({type: 'proverStatus', state: 'preparing', error: null})
      this.proverInit = this.sdk.shielded.init().then(() => {
        this.proverReady = true
        this.emit({type: 'proverStatus', state: 'ready', error: null})
      }).catch(e => {
        this.proverInit = null
        const message = e instanceof Error ? e.message : String(e)
        console.error('[shielded] prover init failed', e)
        this.emit({type: 'proverStatus', state: 'error', error: message})
        throw e
      })
    }
    await this.proverInit
  }

  // Trial-decrypts the ciphertexts passed in by the main process (which
  // downloads new pool notes in the background) — no network fetch here.
  // recoverNotes indexes by array position, so each recovered index is
  // mapped back to the pool index carried by its payload.
  async sync(command: SyncCommand): Promise<void> {
    try {
      this.sdk.setNetwork(command.network)

      const all = command.notes

      this.emit({type: 'syncProgress', requestId: command.requestId, phase: 'recovering', fetched: all.length, total: all.length})
      const recovered = this.sdk.shielded.recoverNotes(all, command.seed, SHIELDED_ACCOUNT)
      const spent = new Set(command.spentIndexes)

      let balance = 0n
      const notes: ShieldedNoteSnapshot[] = []
      for (const note of recovered) {
        const value = note.note.value
        const poolIndex = all[note.index]?.index ?? note.index
        const isSpent = spent.has(poolIndex)
        if (!isSpent) balance += value
        notes.push({
          index: poolIndex,
          amount: value.toString(),
          spent: isSpent,
          address: note.note.address.toBech32m(command.network),
        })
      }
      notes.sort((a, b) => b.index - a.index)

      this.emit({type: 'syncResult', requestId: command.requestId, ok: true, balance: balance.toString(), notes, error: null})
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Shielded note sync failed', e)
      this.emit({type: 'syncResult', requestId: command.requestId, ok: false, balance: null, notes: [], error: message})
    }
  }

  async spend(command: SpendCommand): Promise<void> {
    const {requestId, seed, network, kind} = command
    try {
      const amount = BigInt(command.amountCredits)
      if (amount <= 0n) throw new Error('Amount must be greater than zero')

      this.sdk.setNetwork(network)
      await this.initProver()
      const coinType = COIN_TYPE[network]

      const all = command.notes

      const recovered = this.sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
      const changeAddress = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)
      const memo = ShieldedMemoWASM.empty() as unknown as string
      const spent = new Set(command.spentIndexes)

      for (let attempt = 0; ; attempt++) {
        const unspent = recovered.filter((note) => !spent.has(note.index))
        if (unspent.length === 0) throw new Error('No shielded notes available to spend')

        const available = command.noteIndexes != null
          ? unspent.filter((note) => command.noteIndexes!.includes(note.index))
          : unspent
        if (available.length === 0) throw new Error('Selected note is no longer available to spend')

        const feeForCount: SpendFeeForCount =
          kind === 'identityCreate' ? () => 0n
          : kind === 'transfer' ? minimumShieldedFeeCredits
          : kind === 'unshield' ? unshieldFeeCredits
          : shieldedWithdrawalFeeCredits
        const selectable = available.map((note) => ({ index: note.index, value: note.note.value }))
        const selection = selectSpendNotes(selectable, amount, MAX_SPEND_NOTES, feeForCount)
        if (selection == null) {
          const max = maxSpendableCredits(selectable, MAX_SPEND_NOTES, feeForCount)
          throw new Error(
            selectable.length > MAX_SPEND_NOTES
              ? `Amount plus the network fee needs more than ${MAX_SPEND_NOTES} notes (transaction size limit). ` +
                `Max per transaction right now: ${max.toLocaleString('en-US')} credits. ` +
                `Send a smaller amount, or consolidate notes by sending to your own shielded address.`
              : `Amount plus the network fee exceeds your spendable notes. ` +
                `Max per transaction right now: ${max.toLocaleString('en-US')} credits.`
          )
        }
        const selectedIndexes = new Set(selection.selected.map((note) => note.index))
        const toSpend = available.filter((note) => selectedIndexes.has(note.index))

        const { spends, anchor } = this.sdk.shielded.buildSpendableNotes(all, toSpend)

        this.emit({type: 'spendProgress', requestId, phase: 'proving', fetched: all.length, total: all.length})
        const base = { spends, changeAddress, seed, coinType, account: SHIELDED_ACCOUNT, anchor, memo }
        let stateTransition: StateTransitionWASM
        if (kind === 'transfer') {
          stateTransition = await this.sdk.shielded.createStateTransition('shieldedTransfer', {
            ...base,
            recipient: OrchardAddressWASM.fromBech32m(command.recipient),
            transferAmount: amount,
          })
        } else if (kind === 'unshield') {
          stateTransition = await this.sdk.shielded.createStateTransition('unshield', {
            ...base,
            outputAddress: command.recipient,
            unshieldAmount: amount,
          })
        } else if (kind === 'identityCreate') {
          if (command.identityIndex == null || command.failureAddress == null) {
            throw new Error('Identity creation needs an identity index and a failure refund address')
          }
          const keys = this.buildIdentityCreationKeys(seed, network, command.identityIndex)
          stateTransition = await this.sdk.shielded.createStateTransition('identityCreateFromShieldedPool', {
            ...base,
            publicKeys: keys.publicKeys,
            privateKeys: keys.privateKeys,
            denomination: amount,
            sendToAddressOnCreationFailure: command.failureAddress,
          })
        } else {
          stateTransition = await this.sdk.shielded.createStateTransition('shieldedWithdrawal', {
            ...base,
            withdrawalAmount: amount,
            outputScript: coreAddressToScript(command.recipient, network),
            coreFeePerByte: WITHDRAWAL_CORE_FEE_PER_BYTE,
            pooling: 'Never',
          })
        }

        const nullifiers = this.extractActionNullifiers(stateTransition, kind)
        const statuses = await this.sdk.shielded.getShieldedNullifiers(nullifiers)
        if (statuses.some((status) => status.isSpent)) {
          if (attempt >= MAX_SPEND_ATTEMPTS - 1) {
            throw new Error('Selected notes were already spent on-chain. Re-sync your notes and try again.')
          }
          console.warn('[shielded] selection includes already-spent notes, probing', toSpend.map((n) => n.index))
          const stale = await this.probeSpentNotes(all, toSpend, seed, network)
          if (stale.length === 0) {
            throw new Error('An already-spent note was detected but could not be identified. Re-sync your notes and try again.')
          }
          stale.forEach(index => spent.add(index))
          this.emit({type: 'notesSpent', requestId, indexes: stale})
          console.warn('[shielded] marked stale notes as spent, retrying', stale)
          continue
        }

        const stBytes = stateTransition.bytes()
        console.log('[shielded] state transition ready', {
          kind,
          spends: spends.length,
          sizeBytes: stBytes.length,
          hash: stateTransition.hash(false),
        })

        const identityId = kind === 'identityCreate'
          ? IdentityCreateFromShieldedPoolTransitionWASM.fromStateTransition(stateTransition).identityId.base58()
          : null

        this.emit({type: 'spendProgress', requestId, phase: 'broadcasting', fetched: all.length, total: all.length})
        await this.sdk.stateTransitions.broadcast(stateTransition)
        this.emit({type: 'notesSpent', requestId, indexes: toSpend.map((note) => note.index)})
        await this.waitForResult(stateTransition, kind)

        this.emit({type: 'spendResult', requestId, ok: true, stHash: stateTransition.hash(false), identityId, error: null})
        return
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Shielded spend failed', e)
      this.emit({type: 'spendResult', requestId, ok: false, stHash: null, error: message})
    }
  }

  async shield(command: ShieldCommand): Promise<void> {
    const {requestId, seed, network, source} = command
    try {
      this.sdk.setNetwork(network)
      await this.initProver()

      const privateKey = await this.sdk.keyPair.derivePlatformAddressPrivateKey(seed, network, PLATFORM_ACCOUNT, source.index)
      const recipient = OrchardAddressWASM.fromBech32m(command.recipient)
      const senderOvk = this.sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

      const inputs = [new InputAddressWASM(source.platformAddress, source.nonce + 1, BigInt(source.balanceCredits))]
      const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

      const stateTransition = await this.sdk.shielded.createStateTransition('shield', {
        recipient,
        shieldAmount: BigInt(command.amountCredits),
        inputs,
        privateKeys: [privateKey],
        feeStrategy,
        userFeeIncrease: 0,
        memo: ShieldedMemoWASM.empty() as unknown as string,
        senderOvk,
      })

      await this.sdk.stateTransitions.broadcast(stateTransition)
      await this.sdk.stateTransitions.waitForStateTransitionResult(stateTransition)

      this.emit({type: 'shieldResult', requestId, ok: true, stHash: stateTransition.hash(false), error: null})
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Shield failed', e)
      this.emit({type: 'shieldResult', requestId, ok: false, stHash: null, error: message})
    }
  }

  async shieldFromAssetLock(command: ShieldFromAssetLockCommand): Promise<void> {
    const {requestId, seed, network} = command
    try {
      this.sdk.setNetwork(network)
      await this.initProver()

      const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)
      const derived = await this.sdk.keyPair.derivePath(hdKey, command.creditDerivationPath)
      if (!derived.privateKey) {
        throw new Error('Failed to derive the asset lock credit key')
      }
      const privateKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)

      const proof = command.assetLockProof.type === 'instantLock'
        ? AssetLockProofWASM.createInstantAssetLockProof(
            Uint8Array.from(Buffer.from(command.assetLockProof.instantLock, 'hex')),
            Uint8Array.from(Buffer.from(command.assetLockProof.transaction, 'hex')),
            command.outputIndex,
          )
        : AssetLockProofWASM.createChainAssetLockProof(
            command.assetLockProof.coreChainLockedHeight,
            new OutPointWASM(command.txid, command.outputIndex),
          )
      const recipient = OrchardAddressWASM.fromBech32m(command.recipient)
      const senderOvk = this.sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

      const stateTransition = await this.sdk.shielded.createStateTransition('shieldFromAssetLock', {
        recipient,
        shieldAmount: BigInt(command.shieldAmountCredits),
        assetLockProof: proof,
        privateKey,
        memo: ShieldedMemoWASM.empty() as unknown as string,
        dummyOutputs: SHIELD_FUNDING_DUMMY_OUTPUTS,
        senderOvk,
        ...(command.surplusAddress != null ? {surplusOutput: command.surplusAddress} : {}),
      })

      await this.sdk.stateTransitions.broadcast(stateTransition)
      await this.sdk.stateTransitions.waitForStateTransitionResult(stateTransition)

      this.emit({type: 'shieldResult', requestId, ok: true, stHash: stateTransition.hash(false), error: null})
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('Shield from asset lock failed', e)
      this.emit({type: 'shieldResult', requestId, ok: false, stHash: null, error: message})
    }
  }

  private async waitForResult(st: StateTransitionWASM, kind: ShieldedSpendKind): Promise<void> {
    try {
      await this.sdk.stateTransitions.waitForStateTransitionResult(st)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (kind === 'withdrawal' && /withdrawals contract not available/i.test(message)) {
        console.warn('[shielded] withdrawal included; skipping local proof verification (SDK lacks withdrawals contract):', message)
        return
      }
      throw e
    }
  }

  private extractActionNullifiers(st: StateTransitionWASM, kind: ShieldedSpendKind): Uint8Array[] {
    const transition = kind === 'transfer'
      ? ShieldedTransferTransitionWASM.fromStateTransition(st)
      : kind === 'unshield'
        ? UnshieldTransitionWASM.fromStateTransition(st)
        : kind === 'identityCreate'
          ? IdentityCreateFromShieldedPoolTransitionWASM.fromStateTransition(st)
          : ShieldedWithdrawalTransitionWASM.fromStateTransition(st)
    return transition.actions.map((action) => action.nullifier)
  }

  // The SDK's shielded.createStateTransition destructures plain
  // {id, purpose, ...} objects and builds the WASM key instances itself —
  // passing IdentityPublicKeyInCreationWASM here breaks (its field is keyId).
  private buildIdentityCreationKeys(seed: Uint8Array, network: Network, identityIndex: number): {publicKeys: IdentityPublicKeyInCreation[]; privateKeys: PrivateKeyWASM[]} {
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)
    const privateKeys = IDENTITY_KEY_DEFINITIONS.map(({id}) => {
      const derived = this.sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, id, network)
      if (derived.privateKey == null) {
        throw new Error(`Could not derive identity key ${id}`)
      }
      return PrivateKeyWASM.fromBytes(derived.privateKey, network)
    })
    const publicKeys = IDENTITY_KEY_DEFINITIONS.map(({id, purpose, securityLevel, keyType}, i) => ({
      id,
      purpose,
      securityLevel,
      keyType,
      readOnly: false,
      data: Uint8Array.from(privateKeys[i].getPublicKey().bytes()),
    }))
    return {publicKeys, privateKeys}
  }

  // Identifies which of the candidate notes are already spent on-chain. Own
  // nullifiers can't be derived directly (no nullifier-key accessor in the
  // SDK), so each note is probed by proving a throwaway single-note
  // self-transfer — never broadcast — and checking its action nullifiers
  // against the pool. Dummy actions carry random nullifiers and read unspent.
  private async probeSpentNotes(
    all: EncryptedNote[],
    candidates: RecoveredNoteWASM[],
    seed: Uint8Array,
    network: Network,
  ): Promise<number[]> {
    const selfAddress = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)
    const spentIndexes: number[] = []
    for (const candidate of candidates) {
      let probe: StateTransitionWASM
      try {
        const { spends, anchor } = this.sdk.shielded.buildSpendableNotes(all, [candidate])
        probe = await this.sdk.shielded.createStateTransition('shieldedTransfer', {
          spends,
          changeAddress: selfAddress,
          seed,
          coinType: COIN_TYPE[network],
          account: SHIELDED_ACCOUNT,
          anchor,
          memo: ShieldedMemoWASM.empty() as unknown as string,
          recipient: selfAddress,
          transferAmount: 1n,
        })
      } catch (e) {
        console.warn('[shielded] note probe failed, skipping note', candidate.index, e)
        continue
      }
      const nullifiers = ShieldedTransferTransitionWASM.fromStateTransition(probe).actions.map((a) => a.nullifier)
      const statuses = await this.sdk.shielded.getShieldedNullifiers(nullifiers)
      if (statuses.some((status) => status.isSpent)) spentIndexes.push(candidate.index)
    }
    return spentIndexes
  }
}
