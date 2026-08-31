import {GroupedAddresses} from '../types/GroupedAddresses'
import {CoreFeeForInputs, CoreSpendSource, SelectableUtxo} from '../types/CoinSelection'
import {CoreRecipient, TransferInput, TransferInputSelection} from '../types/CoreTransaction'
import {UTXO} from '../types/UTXO'
import {DUST_THRESHOLD_DUFFS, MAX_CORE_RECIPIENTS} from '../constants/chain'
import {selectCoins} from './coinSelection'

const outpointKey = (txid: string, vout: number): string => `${txid}:${vout}`

const pickedOutpointKeys = (source?: CoreSpendSource): Set<string> | null =>
  source?.kind === 'outpoints'
    ? new Set(source.outpoints.map(outpoint => outpointKey(outpoint.txid, outpoint.vout)))
    : null

// Every output a send carries, and the amount it has to fund. An output under
// the dust threshold is one no peer relays, so it is refused rather than sent.
export function requireCoreRecipients(recipients: CoreRecipient[]): bigint {
  if (recipients.length === 0 || recipients.length > MAX_CORE_RECIPIENTS) {
    throw new Error(`Recipient count must be between 1 and ${MAX_CORE_RECIPIENTS}`)
  }
  for (const recipient of recipients) {
    if (recipient.amountDuffs < DUST_THRESHOLD_DUFFS) {
      throw new Error(`Minimum amount per recipient is ${DUST_THRESHOLD_DUFFS.toString()} duffs`)
    }
  }
  return recipients.reduce((sum, recipient) => sum + recipient.amountDuffs, 0n)
}

// Falls back to the last change address, then to a receiving one, so change
// never leaves the wallet.
export function pickChangeAddress(grouped: GroupedAddresses): string {
  const unusedChange = grouped.change.find(a => !a.isUsed)
  if (unusedChange) return unusedChange.address
  if (grouped.change.length > 0) return grouped.change[grouped.change.length - 1].address
  if (grouped.receiving.length > 0) return grouped.receiving[0].address
  throw new Error('Wallet has no change address')
}

// Kept off the change address so the credit output and the change of the same
// transaction do not land on one address.
export function pickCreditChangeAddress(
  grouped: GroupedAddresses,
  changeAddress: string,
): {address: string; derivationPath: string} {
  const credit = grouped.change.find(a => !a.isUsed && a.address !== changeAddress)
    ?? grouped.change.find(a => !a.isUsed)
    ?? grouped.change[grouped.change.length - 1]
  if (credit == null) {
    throw new Error('Wallet has no change address for the asset lock credit output')
  }
  return {address: credit.address, derivationPath: credit.derivationPath}
}

// The provider answers for the whole wallet, including indexes discovery has
// not derived — those have no derivation path and cannot be signed.
export function selectableTransferUtxos(
  grouped: GroupedAddresses,
  utxos: UTXO[],
  source?: CoreSpendSource,
): SelectableUtxo[] {
  const owned = new Set([...grouped.receiving, ...grouped.change].map(a => a.address))
  const picked = pickedOutpointKeys(source)

  return utxos
    .filter(utxo => owned.has(utxo.address))
    .filter(utxo => source?.kind !== 'address' || utxo.address === source.address)
    .filter(utxo => picked == null || picked.has(outpointKey(utxo.txId, utxo.vOut)))
    .map(utxo => ({
      txid: utxo.txId,
      vout: utxo.vOut,
      satoshis: utxo.satoshis,
      address: utxo.address,
      height: utxo.height,
    }))
}

export function selectTransferInputs(
  grouped: GroupedAddresses,
  utxos: UTXO[],
  amountDuffs: bigint,
  feeForInputs: CoreFeeForInputs,
  source?: CoreSpendSource,
): TransferInputSelection {
  const pathByAddress = new Map(
    [...grouped.receiving, ...grouped.change].map(a => [a.address, a.derivationPath]),
  )

  const selectable = selectableTransferUtxos(grouped, utxos, source)

  if (selectable.length === 0) {
    throw new Error('No spendable funds in this wallet')
  }

  // A quote prices whatever survived, but a send that quietly spent fewer coins
  // than were picked would break the one promise picking them makes.
  const picked = pickedOutpointKeys(source)
  if (picked != null && selectable.length !== picked.size) {
    throw new Error('Selected UTXO no longer available')
  }

  const selection = selectCoins(selectable, amountDuffs, feeForInputs, source)
  const utxoByKey = new Map(utxos.map(u => [outpointKey(u.txId, u.vOut), u]))

  const transferInputs: TransferInput[] = selection.inputs.map(input => {
    const owned = utxoByKey.get(outpointKey(input.txid, input.vout))
    if (!owned) throw new Error('Selected UTXO no longer available')

    const derivationPath = pathByAddress.get(input.address)
    if (derivationPath == null) throw new Error(`No derivation path for address ${input.address}`)

    return {
      txId: owned.txId,
      vOut: owned.vOut,
      script: owned.script,
      derivationPath,
      address: input.address,
    }
  })

  return {transferInputs, inputTotal: selection.inputTotal, changeAddress: pickChangeAddress(grouped), feeDuffs: selection.fee}
}
