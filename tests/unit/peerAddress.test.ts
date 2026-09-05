import {describe, it, expect} from 'vitest'
import {entryTarget, isDnsSeedHost, parsePeerAddress, peerListEntry} from '../../src/main/p2p/net/peerAddress'

const PORT = 9999

describe('parsePeerAddress', () => {
  it('defaults the port to the network default', () => {
    expect(parsePeerAddress('1.2.3.4', PORT)).toEqual({ip: {v4: '1.2.3.4'}, port: PORT})
  })

  it('takes an explicit port', () => {
    expect(parsePeerAddress('1.2.3.4:19999', PORT)).toEqual({ip: {v4: '1.2.3.4'}, port: 19999})
  })

  it('keeps hostnames — the socket resolves them', () => {
    expect(parsePeerAddress('node.example.com', PORT)).toEqual({ip: {v4: 'node.example.com'}, port: PORT})
  })

  it('trims surrounding whitespace', () => {
    expect(parsePeerAddress('  1.2.3.4  ', PORT)).toEqual({ip: {v4: '1.2.3.4'}, port: PORT})
  })

  it('reads a bare v6 literal as v6', () => {
    expect(parsePeerAddress('2001:db8::1', PORT)).toEqual({ip: {v6: '2001:db8::1'}, port: PORT})
  })

  it('reads a bracketed v6 literal with and without a port', () => {
    expect(parsePeerAddress('[2001:db8::1]', PORT)).toEqual({ip: {v6: '2001:db8::1'}, port: PORT})
    expect(parsePeerAddress('[2001:db8::1]:19999', PORT)).toEqual({ip: {v6: '2001:db8::1'}, port: 19999})
  })

  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    [':9999', 'no host'],
    ['1.2.3.4:', 'no port'],
    ['1.2.3.4:0', 'port zero'],
    ['1.2.3.4:65536', 'port out of range'],
    ['1.2.3.4:abc', 'non-numeric port'],
    ['1.2.3.4:99.5', 'fractional port'],
    ['[2001:db8::1', 'unclosed bracket'],
    ['[]', 'empty brackets'],
    ['[2001:db8::1]x', 'trailing junk'],
  ])('rejects %j (%s)', input => {
    expect(parsePeerAddress(input, PORT)).toBeNull()
  })
})

describe('peerListEntry', () => {
  it.each([
    ['1.2.3.4', '1.2.3.4:9999'],
    ['1.2.3.4:19999', '1.2.3.4:19999'],
    ['node.example.com', 'node.example.com:9999'],
    ['[2001:db8::1]', '[2001:db8::1]:9999'],
    ['2001:db8::1', '[2001:db8::1]:9999'],
  ])('spells %j with its port as %j', (input, expected) => {
    expect(peerListEntry(parsePeerAddress(input, PORT)!, PORT)).toBe(expected)
  })

  // The stored entry has to survive a round trip, which is what the brackets
  // are for: a bare v6 with a port appended reads as another v6.
  it('parses back to the address it came from', () => {
    const addr = parsePeerAddress('2001:db8::1', PORT)!
    expect(parsePeerAddress(peerListEntry(addr, PORT), PORT)).toEqual({ip: {v6: '2001:db8::1'}, port: PORT})
  })
})

describe('entryTarget', () => {
  // The pair a duplicate check has to collapse: dialling one node twice from
  // one host drops both connections.
  it('spells one node the same however it was typed', () => {
    expect(entryTarget('1.2.3.4', PORT)).toBe(entryTarget('1.2.3.4:9999', PORT))
    expect(entryTarget('[2001:db8::1]', PORT)).toBe(entryTarget('2001:db8::1', PORT))
  })

  it('keeps entries on different ports apart', () => {
    expect(entryTarget('1.2.3.4:9999', PORT)).not.toBe(entryTarget('1.2.3.4:19999', PORT))
  })

  it('stands an unparseable entry for itself', () => {
    expect(entryTarget('  1.2.3.4:99999  ', PORT)).toBe('1.2.3.4:99999')
  })
})

describe('isDnsSeedHost', () => {
  it.each([
    'dnsseed.dash.org',
    'testnet-seed.dashdot.io',
    'seed-1.pshenmic.dev',
    '  seed.example.com  ',
    'SEED.EXAMPLE.COM',
  ])('accepts %j', input => {
    expect(isDnsSeedHost(input)).toBe(true)
  })

  it.each([
    ['', 'empty'],
    ['seed.example.com:19999', 'carries a port'],
    ['1.2.3.4', 'v4 literal'],
    ['2001:db8::1', 'v6 literal'],
    ['localhost', 'single label'],
    ['-seed.example.com', 'label starts with a hyphen'],
    ['seed..example.com', 'empty label'],
    ['http://seed.example.com', 'scheme'],
    ['seed.example.com/', 'trailing slash'],
    ['seed example.com', 'inner space'],
  ])('rejects %j (%s)', input => {
    expect(isDnsSeedHost(input)).toBe(false)
  })
})
