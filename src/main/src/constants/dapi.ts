export const DAPI_URL_PROTOCOL_PATTERN = /^https?$/

// Matched against the parsed hostname, which keeps IPv6 brackets and turns IPv4 shorthands into dotted quads.
export const DAPI_URL_HOSTNAME_PATTERN = /^(\d{1,3}(\.\d{1,3}){3}|\[[\da-f:.]+\])$/i
