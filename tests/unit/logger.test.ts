import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Logger, configureLogger, currentLogLevel, replaceSecrets } from '../../src/main/src/utils/logger'
import { DEFAULT_LOG_LEVEL } from '../../src/main/src/constants/logging'

describe('replaceSecrets', () => {
  it('removes a BIP-39 phrase, label and all', () => {
    const phrase = 'abandon ability able about above absent absorb abstract absurd abuse access accident'
    expect(replaceSecrets(`mnemonic: ${phrase}`)).toBe('mnemonic: [redacted:mnemonic]')
  })

  it('removes a 24-word phrase', () => {
    const phrase = Array.from({ length: 24 }, () => 'abandon').join(' ')
    expect(replaceSecrets(phrase)).toBe('[redacted:mnemonic]')
  })

  it('removes both halves of an extended key', () => {
    const xpub = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8'
    expect(replaceSecrets(`account ${xpub}`)).toBe('account [redacted:extended-key]')
    const xprv = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi'
    expect(replaceSecrets(xprv)).toBe('[redacted:extended-key]')
  })

  it('tells a 52-character WIF key from a 34-character address sharing its prefix', () => {
    const wif = 'XK4qF4kJ9NfEcnzFZ2vYQqCPQiSHTZ5CkRoLQNc8ycNSHDHNSAA9'
    const address = 'XdAUmwtig27HBG6WfYyHAzP8n6XC9jESEw'
    expect(replaceSecrets(wif)).toBe('[redacted:private-key]')
    expect(replaceSecrets(address)).toBe('[redacted:address]')
  })

  it('removes core and platform addresses on both networks', () => {
    expect(replaceSecrets('h=1 (yWjXfqPFDrqGRVJRHkKgvfAknCbYbknCbd)')).toBe('h=1 ([redacted:address])')
    expect(replaceSecrets('credit dash1kp2ld9lldeh43ajshkt3djk48rqgrggy5ue2cayd'))
      .toBe('credit [redacted:address]')
  })

  it('removes labelled secrets whatever the surrounding syntax', () => {
    expect(replaceSecrets('{"password":"hunter2","user":"bob"}')).toBe('{"password":"[redacted]","user":"bob"}')
    expect(replaceSecrets('seed=deadbeefdeadbeefdeadbeefdeadbeef')).toBe('seed=[redacted]')
  })

  it('leaves txids, heights and peer addresses alone', () => {
    const line = '[cfilter] match h=2210144 block=0093d045fb4cc527 from 1.2.3.4:9999'
    expect(replaceSecrets(line)).toBe(line)
  })

  it('leaves ordinary log prose alone', () => {
    const line = 'nothing heard from any of these ready peers for a while now so we are dropping them and redialling'
    expect(replaceSecrets(line)).toBe(line)
  })

  it('is idempotent, so redacting in a child and again in its parent is a no-op', () => {
    const once = replaceSecrets('paid XdAUmwtig27HBG6WfYyHAzP8n6XC9jESEw for password=hunter2')
    expect(replaceSecrets(once)).toBe(once)
  })
})

describe('Logger', () => {
  const calls: [string, unknown[]][] = []

  beforeEach(() => {
    calls.length = 0
    for (const name of ['error', 'warn', 'info', 'debug'] as const) {
      vi.spyOn(console, name).mockImplementation((...args: unknown[]) => { calls.push([name, args]) })
    }
    configureLogger({ level: DEFAULT_LOG_LEVEL, levelPrefix: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    configureLogger({ level: DEFAULT_LOG_LEVEL, levelPrefix: false })
  })

  it('renders the scope and routes each level to its console channel', () => {
    configureLogger({ level: 'debug' })
    const log = new Logger('cfilter')
    log.info('block h=1')
    log.warn('slow')
    log.error('boom')
    log.debug('detail')
    expect(calls).toEqual([
      ['info', ['[cfilter] block h=1']],
      ['warn', ['[cfilter] slow']],
      ['error', ['[cfilter] boom']],
      ['debug', ['[cfilter] detail']],
    ])
  })

  it('drops records more verbose than the threshold', () => {
    configureLogger({ level: 'warn' })
    const log = new Logger('p2p')
    log.error('kept')
    log.warn('kept')
    log.info('dropped')
    log.debug('dropped')
    expect(calls.map(([, args]) => args[0])).toEqual(['[p2p] kept', '[p2p] kept'])
  })

  it('stamps the level for a parent that only sees bytes on a pipe', () => {
    configureLogger({ levelPrefix: true })
    new Logger('p2p').warn('reorg')
    expect(calls).toEqual([['warn', ['[warn] [p2p] reorg']]])
  })

  it('redacts every argument, not just string ones', () => {
    new Logger('assetLock').info('credit', { address: 'XdAUmwtig27HBG6WfYyHAzP8n6XC9jESEw' })
    expect(calls[0][1][0]).toBe("[assetLock] credit { address: '[redacted:address]' }")
  })

  it('renders an Error with its stack', () => {
    const err = new Error('nope')
    new Logger('p2p').error('failed:', err)
    expect(String(calls[0][1][0])).toContain('[p2p] failed: Error: nope')
  })

  it('reports the active level, which is what a forked child is handed', () => {
    configureLogger({ level: 'error' })
    expect(currentLogLevel()).toBe('error')
  })
})
