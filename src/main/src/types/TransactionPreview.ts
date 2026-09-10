import {FeeParams} from '../../platform/types/messages'

// Which coin an entry is counted in. Per entry rather than per preview because
// an asset lock is two transactions and carries one of each.
export type PreviewUnit = 'duffs' | 'credits'

// What an entry is, so a caller names it without re-deriving the operation.
// `feeInput` is the input consensus charges an address-funded transition to,
// and `credit` is the asset lock output whose key signs the proof its L2 half
// spends.
export type PreviewRole = 'input' | 'feeInput' | 'recipient' | 'change' | 'credit'

export interface PreviewEntry {
  role: PreviewRole
  // Empty where the operation creates what it pays: an identity has no address
  // until its transition lands, and a shielded change note is diversified in
  // the worker, from a seed no preview holds.
  address: string
  amount: bigint
  unit: PreviewUnit
  // What names the coin where the address does not: an outpoint, or a note.
  reference: string | null
}

// A send stopped one step short of signing: the coins it would spend, what it
// would pay, and the price. Every number comes from the selection the send
// itself runs, so a preview and the transaction it previews cannot disagree.
export interface TransactionPreview {
  inputs: PreviewEntry[]
  outputs: PreviewEntry[]
  // The split OperationFee carries: what L1 charges on top of the amount, what
  // L2 takes out of it, null where that layer is not involved.
  feeDuffs: bigint | null
  feeCredits: bigint | null
  // The transaction or transition the send would submit, serialized before
  // anything signs it. Null only where those bytes cannot exist yet: creating an
  // identity carries public keys the seed derives, anything the pool proves —
  // a shield or a spend — needs that seed and seconds of proving, and the L2
  // half of an asset lock spends a proof the lock has not created, which is why
  // a lock carries its L1 half here.
  //
  // Not a txid to check against later: the signatures still missing are part of
  // what both a Core txid and a transition hash cover.
  unsignedHex: string | null
}

// One output as the caller named it, in the unit that operation's send method
// takes: duffs wherever L1 funds the transaction, credits everywhere else.
export interface PreviewRecipient {
  address: string
  amount: bigint
}

// What a quote does not need and a preview does: what each recipient is paid
// rather than how many there are, and the two addresses no price depends on.
export interface PreviewParams extends Omit<FeeParams, 'recipient'> {
  recipients: PreviewRecipient[]
  // L1 sends only, and only where the caller named one — otherwise change goes
  // to the wallet's own next change address.
  changeTo?: string | null
  // Shield only: the platform address it spends. Every other platform-funded
  // operation names its addresses through platformSource.
  fromAddress?: string | null
}
