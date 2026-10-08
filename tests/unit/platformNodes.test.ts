import {describe, expect, it} from 'vitest'
import type {DapiUrlStatus} from '@renderer/api/types'
import {
  appendPlatformNode,
  buildPlatformNodeRows,
  getPlatformNodeEmptyLabel,
  platformNodeIdentity,
  removePlatformNode,
} from '@renderer/utils/platformNodes'

describe('Platform node empty labels', () => {
  it('asks to select a wallet before showing a loading message', () => {
    expect(getPlatformNodeEmptyLabel(null, true, 'active'))
      .toBe('Select a wallet to manage Platform nodes.')
  })

  it('shows a loading message for either node list', () => {
    expect(getPlatformNodeEmptyLabel('mainnet', true, 'active')).toBe('Loading Platform nodes…')
    expect(getPlatformNodeEmptyLabel('testnet', true, 'static')).toBe('Loading Platform nodes…')
  })

  it('identifies an empty active node list', () => {
    expect(getPlatformNodeEmptyLabel('mainnet', false, 'active')).toBe('No active Platform nodes.')
  })

  it('identifies an empty static node list', () => {
    expect(getPlatformNodeEmptyLabel('testnet', false, 'static')).toBe('No static Platform nodes.')
  })
})

describe('Platform node URLs', () => {
  it('matches equivalent URL spellings without folding path case', () => {
    expect(platformNodeIdentity(' HTTPS://NODE.example.org:443 '))
      .toBe(platformNodeIdentity('https://node.example.org/'))
    expect(platformNodeIdentity('https://node.example.org/Drive'))
      .not.toBe(platformNodeIdentity('https://node.example.org/drive'))
    expect(platformNodeIdentity(' malformed saved entry ')).toBe('malformed saved entry')
  })

  it('rejects missing, malformed, and non-HTTPS entries with a useful error', () => {
    for (const input of ['', 'node.example.org:1443', 'https://', 'http://node.example.org', 'ftp://node.example.org']) {
      expect(() => appendPlatformNode([], input)).toThrow('Enter a valid HTTPS URL')
    }
    expect(appendPlatformNode([], ' https://[2001:db8::1]:1443 '))
      .toEqual(['https://[2001:db8::1]:1443'])
  })

  it('adds and removes normalized targets without rewriting unrelated saved entries', () => {
    const entries = [' HTTPS://NODE.example.org:443 ', 'https://other.example.org:1443', 'https://other.example.org:1443/']
    expect(appendPlatformNode(entries, 'https://node.example.org/')).toEqual([
      'HTTPS://NODE.example.org:443', 'https://other.example.org:1443', 'https://other.example.org:1443/',
    ])
    expect(appendPlatformNode(entries, ' https://third.example.org:1443 ')).toEqual([
      'HTTPS://NODE.example.org:443', 'https://other.example.org:1443', 'https://other.example.org:1443/',
      'https://third.example.org:1443',
    ])
    expect(removePlatformNode(entries, 'https://node.example.org/')).toEqual([
      'https://other.example.org:1443', 'https://other.example.org:1443/',
    ])
    expect(removePlatformNode(['https://node.example.org:443'], 'https://node.example.org/')).toEqual([])
  })
})

describe('Platform node table rows', () => {
  const responding: DapiUrlStatus = {
    dapiUrl: 'https://node.example.org:1443',
    proTxHash: 'pro-tx-hash',
    pingMs: 12.6,
    driveVersion: '2.0.1',
    blockHeight: 9007199254740993n,
    error: null,
  }
  const noResponse: DapiUrlStatus = {
    dapiUrl: 'https://unavailable.example.org:1443',
    proTxHash: null,
    pingMs: null,
    driveVersion: null,
    blockHeight: null,
    error: 'Request timed out',
  }

  it('displays probe results without equating pool membership with a response', () => {
    const rows = buildPlatformNodeRows([responding, noResponse], [], 'dynamic')
    expect(rows.active[0]).toMatchObject({
      entry: responding.dapiUrl,
      url: responding.dapiUrl,
      driveVersion: '2.0.1',
      pingTime: '13 ms',
      blockHeight: responding.blockHeight!.toLocaleString(),
      proTxHash: 'pro-tx-hash',
      available: true,
      status: 'Available',
      error: null,
    })
    expect(rows.active[1]).toMatchObject({
      driveVersion: '—',
      pingTime: '—',
      blockHeight: '—',
      proTxHash: null,
      available: false,
      status: 'No response',
      error: 'Request timed out',
    })
  })

  it('matches saved URLs to active probes while preserving the saved spelling', () => {
    const saved = [' HTTPS://NODE.example.org:1443/ ', noResponse.dapiUrl, 'https://saved.example.org:1443']
    const automatic = buildPlatformNodeRows([responding, noResponse], saved, 'dynamic').static
    expect(automatic[0]).toMatchObject({entry: 'HTTPS://NODE.example.org:1443/', status: 'Available automatically', pingTime: '13 ms'})
    expect(automatic[1]).toMatchObject({status: 'No response', available: false})
    expect(automatic[2]).toMatchObject({status: 'Saved', available: false, error: null})
    const manual = buildPlatformNodeRows([responding], saved, 'static').static
    expect(manual[0].status).toBe('Available')
    expect(manual[2].status).toBe('Not active')
    expect(buildPlatformNodeRows([], saved, null).static[0].status).toBe('Saved')
  })

  it('deduplicates equivalent row identities and handles partial probe metrics', () => {
    const node = {...responding, dapiUrl: 'https://node.example.org:443', pingMs: Number.NaN, driveVersion: null, blockHeight: 0n}
    const rows = buildPlatformNodeRows(
      [node, {...node, dapiUrl: 'HTTPS://NODE.example.org/'}],
      ['https://node.example.org', 'https://node.example.org:443/'],
      'static',
    )
    expect(rows.active).toHaveLength(1)
    expect(rows.static).toHaveLength(1)
    expect(rows.active[0]).toMatchObject({available: true, pingTime: '—', blockHeight: '0'})
  })

  it('keeps failed probes unavailable even when partial metrics remain', () => {
    const failed = {...responding, error: 'Status response was incomplete'}
    const rows = buildPlatformNodeRows([failed], [failed.dapiUrl], 'dynamic')
    for (const row of [rows.active[0], rows.static[0]]) {
      expect(row).toMatchObject({
        available: false,
        status: 'No response',
        error: 'Status response was incomplete',
        driveVersion: '2.0.1',
        pingTime: '13 ms',
        blockHeight: responding.blockHeight!.toLocaleString(),
      })
    }
  })
})
