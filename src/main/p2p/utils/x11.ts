// Dash's block-header hash. crypto-toothpick is a Rust implementation behind an
// N-API addon, ~40x the pure-JS one and the difference between minutes and
// seconds over a full header sync; it falls back to its own WebAssembly build on
// a platform with no prebuilt addon.
//
// The digest comes back in internal (wire) byte order, which is what the chain
// index and the cf* stop hashes are keyed by.
export {x11Hash as x11Wire} from 'crypto-toothpick'
