import {describe, it, expect} from 'vitest'
import {ScanCursorGate} from '../../src/main/src/utils/scanCursorGate'

describe('ScanCursorGate', () => {
  it('passes the requested height through while nothing has failed', () => {
    const gate = new ScanCursorGate()
    expect(gate.allowedHeight('w1', 1000)).toBe(1000)
    expect(gate.allowsBlockCursor('w1', 1000)).toBe(true)
    expect(gate.hasFailures()).toBe(false)
  })

  it('caps the cursor below the lowest failed height', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 700)
    gate.fail('w1', 500)
    gate.fail('w1', 900)

    expect(gate.lowestFailed('w1')).toBe(500)
    expect(gate.allowedHeight('w1', 1000)).toBe(499)
    expect(gate.failedHeights('w1')).toEqual([500, 700, 900])
  })

  it('keeps a request that is already below the gap', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 500)
    expect(gate.allowedHeight('w1', 200)).toBe(200)
  })

  it('refuses to move the cursor at all when the gap starts at genesis', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 0)
    expect(gate.allowedHeight('w1', 1000)).toBeNull()
  })

  it('blocks a later block from carrying its own cursor advance', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 500)
    expect(gate.allowsBlockCursor('w1', 501)).toBe(false)
    expect(gate.allowsBlockCursor('w1', 499)).toBe(true)
  })

  it('is per wallet', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 500)
    expect(gate.allowedHeight('w2', 1000)).toBe(1000)
    expect(gate.hasFailures('w2')).toBe(false)
    expect(gate.hasFailures('w1')).toBe(true)
  })

  it('releases the cursor once the failed height lands', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 500)
    gate.fail('w1', 900)
    gate.succeed('w1', 500)
    expect(gate.allowedHeight('w1', 1000)).toBe(899)
    gate.succeed('w1', 900)
    expect(gate.allowedHeight('w1', 1000)).toBe(1000)
    expect(gate.hasFailures()).toBe(false)
  })

  it('ignores a success for a height that never failed', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 500)
    gate.succeed('w1', 501)
    gate.succeed('w2', 500)
    expect(gate.lowestFailed('w1')).toBe(500)
  })

  it('clears a wallet wholesale', () => {
    const gate = new ScanCursorGate()
    gate.fail('w1', 500)
    gate.clear('w1')
    expect(gate.allowedHeight('w1', 1000)).toBe(1000)
  })
})