import {describe, expect, it} from 'vitest'
import {
  appendPeerEntry,
  buildPeerTableRows,
  dedupePeerEntries,
  formatPeerAddress,
  formatPeerEntry,
  getPeerEmptyState,
  peerIdentity,
  removePeerEntry,
} from '@renderer/utils/peers'

describe('peer formatting', () => {
  it('formats IPv4 and IPv6 endpoints', () => {
    expect(formatPeerAddress('127.0.0.1', 9999)).toBe('127.0.0.1:9999')
    expect(formatPeerAddress('2001:db8::1', 19999)).toBe('[2001:db8::1]:19999')
    expect(formatPeerAddress('[2001:db8::1]', 19999)).toBe('[2001:db8::1]:19999')
  })

  it('adds the network default port and matches optional ports', () => {
    expect(formatPeerEntry('127.0.0.1', 'mainnet')).toBe('127.0.0.1:9999')
    expect(formatPeerEntry('2001:db8::1', 'testnet')).toBe('[2001:db8::1]:19999')
    expect(peerIdentity('127.0.0.1', 'mainnet')).toBe(peerIdentity('127.0.0.1:9999', 'mainnet'))
    expect(peerIdentity('[2001:db8::1]', 'testnet')).toBe(peerIdentity('[2001:db8::1]:19999', 'testnet'))
  })
})

describe('peer list operations', () => {
  it('deduplicates equivalent entries while preserving the first spelling', () => {
    expect(dedupePeerEntries([
      ' node.example.org ',
      'node.example.org:9999',
      '[2001:DB8::1]',
      '[2001:db8::1]:9999',
    ], 'mainnet')).toEqual(['node.example.org', '[2001:DB8::1]'])
  })

  it('appends and removes entries by normalized target', () => {
    expect(appendPeerEntry(['127.0.0.1'], '127.0.0.1:9999', 'mainnet')).toEqual(['127.0.0.1'])
    expect(removePeerEntry(['127.0.0.1', '127.0.0.2:9999'], '127.0.0.1:9999', 'mainnet'))
      .toEqual(['127.0.0.2:9999'])
  })
})

describe('peer empty state', () => {
  const settings = {
    loading: false,
    connectedPeersLoading: false,
    pending: null,
  }

  it('describes loading and connection states for the Active tab', () => {
    expect(getPeerEmptyState('mainnet', 'active', {...settings, loading: true}, false))
      .toEqual({label: 'Loading peers…', loading: true})
    expect(getPeerEmptyState('mainnet', 'active', settings, false))
      .toEqual({label: 'Connecting to peers…', loading: true})
    expect(getPeerEmptyState('mainnet', 'active', settings, true))
      .toEqual({label: 'No connected peers.', loading: false})
  })

  it('describes unavailable and empty peer lists', () => {
    expect(getPeerEmptyState(null, 'active', settings, true))
      .toEqual({label: 'Select a wallet to manage peers.', loading: false})
    expect(getPeerEmptyState('mainnet', 'static', settings, true))
      .toEqual({label: 'No peers in this list.', loading: false})
  })
})

describe('peer table rows', () => {
  it('combines connected peers with configured dynamic peers', () => {
    const rows = buildPeerTableRows({
      network: 'mainnet',
      connectedPeers: [
        {pool: 'lock-pool', host: '127.0.0.1', port: 9999, userAgent: '/Dash Core:23.0.2/', pingMs: 12.6},
        {pool: 'bulk-pool', host: '2001:db8::2', port: 9999, userAgent: '/Dash Core:22.1.0/', pingMs: 48.4},
      ],
      dynamicPeers: ['127.0.0.1', '127.0.0.3'],
      staticPeers: ['[2001:db8::2]:9999', '[2001:db8::4]:9999'],
      bannedPeers: ['127.0.0.5:9999'],
    })

    expect(rows.active).toHaveLength(3)
    expect(rows.active[0]).toMatchObject({
      id: expect.stringContaining('active:dynamic:'),
      entry: '127.0.0.1',
      connected: true,
      configuredList: 'dynamic',
      pingTime: '13 ms',
    })
    expect(rows.active[1]).toMatchObject({
      id: expect.stringContaining('active:connected:bulk-pool:'),
      peer: '[2001:db8::2]:9999',
      userAgent: '/Dash Core:22.1.0/',
      pingTime: '48 ms',
      configuredList: null,
    })
    expect(rows.active[2]).toMatchObject({
      entry: '127.0.0.3',
      peer: '127.0.0.3:9999',
      connected: false,
      configuredList: 'dynamic',
      userAgent: '—',
      pingTime: '—',
    })
    expect(rows.static[0]).toMatchObject({
      id: expect.stringContaining('static:'),
      peer: '[2001:db8::2]:9999',
      connected: true,
      pool: 'bulk-pool',
      userAgent: '/Dash Core:22.1.0/',
      pingTime: '48 ms',
      configuredList: 'static',
    })
    expect(rows.static[1]).toMatchObject({
      id: expect.stringContaining('static:'),
      peer: '[2001:db8::4]:9999',
      connected: false,
      pool: null,
      configuredList: 'static',
    })
    expect(rows.banned[0]).toMatchObject({
      id: expect.stringContaining('banned:'),
      peer: '127.0.0.5:9999',
      configuredList: 'banned',
    })
  })
})
