// Loose shape check for an Orchard (shielded) bech32m address. The exact HRP
// lives in the WASM binary, so this only gates obviously-invalid input; the
// main process validates authoritatively via OrchardAddressWASM.fromBech32m.
// An Orchard address is 43 bytes → a long (~75+ char) bech32m data section.
export function isLikelyShieldedAddress(address: string): boolean {
  const a = address.trim().toLowerCase()
  return /^[a-z0-9]{1,20}1[a-z0-9]{60,}$/.test(a)
}
