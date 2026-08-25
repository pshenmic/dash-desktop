import {GroupedAddresses} from '../types/GroupedAddresses'
import {SelectableUtxo} from '../types/CoinSelection'
import {TransferInput, TransferInputSelection} from '../types/CoreTransaction'
import {UTXO} from '../types/UTXO'
import {selectCoins} from './coinSelection'

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

export function selectTransferInputs(
  grouped: GroupedAddresses,
  utxos: UTXO[],
  amountDuffs: bigint,
  feeDuffs: bigint,
  fromAddress?: string,
): TransferInputSelection {
  const pathByAddress = new Map(
    [...grouped.receiving, ...grouped.change].map(a => [a.address, a.derivationPath]),
  )

  // The provider answers for the whole wallet, including indexes discovery has
  // not derived — those have no derivation path and cannot be signed.
  const ownedUtxos = utxos
    .filter(utxo => pathByAddress.has(utxo.address))
    .filter(utxo => fromAddress == null || utxo.address === fromAddress)

  if (ownedUtxos.length === 0) {
    throw new Error('No spendable funds in this wallet')
  }

  const selectable: SelectableUtxo[] = ownedUtxos.map(utxo => ({
    txid: utxo.txId,
    vout: utxo.vOut,
    satoshis: utxo.satoshis,
    address: utxo.address,
  }))

  const selection = selectCoins(selectable, amountDuffs, {fee: feeDuffs})
  const utxoByKey = new Map(ownedUtxos.map(u => [`${u.txId}:${u.vOut}`, u]))

  const transferInputs: TransferInput[] = selection.inputs.map(input => {
    const owned = utxoByKey.get(`${input.txid}:${input.vout}`)
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

  return {transferInputs, inputTotal: selection.inputTotal, changeAddress: pickChangeAddress(grouped)}
}
