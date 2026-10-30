# Address derivation and windows

## Platform (L2) addresses are DIP-17

`m/9'/coinType'/17'/account'/0'/index`, account 0: rows in `platform_addresses`
— not a count, never re-derived on read, and NOT mirrors of L1 addresses. The
account xpub is persisted in `wallet.platform_xpub`; `platformAccountXpub()` in
`utils/platformAddress.ts` is the only place it is derived or backfilled, and
every address comes from `platformAddressDeriver(xpub, network)`, so no code
path derives a platform address from the seed. Signing keys still come from the
seed, in the worker.

`wallet.platform_address_count` is legacy: it survives only so
`PlatformAddressService.seedLegacyWindow` can recover an address revealed by hand
before the table existed. Nothing writes it, and it can be dropped once every
wallet has grown rows. `wallet.shielded_address_count` is fully dead — nothing
reads or writes it — and can be dropped whenever.

## Address windows (`utils/addressWindow.ts`)

All four key classes run the same gap walk. `runAddressWindow` knows nothing
about a key class and takes three collaborators:

- `AddressDeriver` — index → address + path (`coreAddressDeriver`,
  `platformAddressDeriver`, `shieldedAddressDeriver`)
- `UsageOracle` — `scan(gapLimit)` for a source that can walk the gap itself
  (returns `null` when it cannot, and the walk then widens round by round
  through `probe`)
- `AddressWindowStore` — what has been materialised, and how to reveal more

DashPay (DIP-15) is the fourth, with two chains per friendship, both at DIP-15's
gap of 10. They are not stored: `DashPayCache` holds them in memory, derived
again from the contact requests `refreshDashPay` fetches, so after a start p2p
rescans each of our chains from its request's height.

- **`receiving`** is ours, `m/9'/coinType'/15'/0'/<us>/<them>/index`, one per
  request we sent. It derives from `wallet.dashpay_xpub` (both identity-id levels
  are non-hardened, so no seed), reaches every owned-address reader as
  `GroupedAddresses.dashPay`, and enters the p2p watch set at
  `DASHPAY_WATCH_INDEX` so the child's BIP-44 gap tracking ignores it. rpc mode
  reads it by address: Dashscan's xpub endpoints only walk branches 0/1. Signing
  walks its `0x…` levels through `derivePath256`.
- **`external`** is theirs, from the key their request carried. It is never
  owned or watched; its used flags only pick the next address to pay them on,
  which `nextDashPayPayAddress` marks used before the transaction is built.

`planWindow` is the pure half and takes `known` (materialised) separately from
`usage` (just observed, and allowed to reach past it). Everything keys on the
**index**, never on the address string. Every address-window gap number lives in
the three policy constants in `constants/addresses.ts` — and nowhere else, though
that file also holds unrelated gap numbers (`IDENTITY_LOOKAHEAD`,
`TOPUP_KEY_GAP_LIMIT`).

Shielded is included because `shielded_notes.address` is our own diversified
address, which makes it a genuine per-index usage oracle (local rather than a
chain query, which `UsageOracle` does not care about). Note *discovery* is
separate and IVK-based — one viewing key finds every note whether or not its
diversifier was revealed; the window only governs which indexes are known and
flagged.

Shielded differs in two ways that are protocol, not design:

- **The deriver needs the seed.** ZIP-32 has no watch-only equivalent to an
  xpub, so the walk runs only inside an already-unlocked operation, on the seed
  that operation is holding. It must NOT be scheduled at boot or on a timer like
  core and platform, and **nothing may cache a seed, IVK or FVK** to make that
  possible. Its triggers are the end of `syncNotes` (after the notes are
  written — that is what the used flags are read from) and the spend paths,
  which already hold a seed.
- **There is no per-index derivation path.** A diversifier is not a path
  element, so `shielded_addresses` has no `derivation_path` column — it would
  hold `m/32'/coinType'/account'` on every row. The account is implied by the
  wallet and `address_index` carries the diversifier.

`ShieldedService.addAddress` refuses while the wallet is behind the pool (an
undecoded note may already own the diversifier it is about to hand out), and is
serialised per wallet rather than deduped, because two reveals must produce two
addresses.

**Revealing an address never needs the password on L1 or platform.** Both derive
from a persisted account xpub, so `addAddress`/`addPlatformAddress` take none
and the UI shows no form. Only shielded unlocks, for the reason above.
