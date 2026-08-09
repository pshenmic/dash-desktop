import {describe, it, expect} from 'vitest'
import {parsePeerAddress} from '../../src/main/p2p/peerAddress'

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