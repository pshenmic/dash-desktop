import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {setTimeout as delay} from 'node:timers/promises'
import type {DashPlatformSDK} from 'dash-platform-sdk'
import type {StateTransitionWASM} from 'pshenmic-dpp'
import {broadcast} from '../../src/main/platform/operations/broadcast'
import type {OperationContext} from '../../src/main/platform/operations/types'
import {CORE_HEIGHT_POLL_MS, CORE_HEIGHT_WAIT_MS} from '../../src/main/platform/constants'

vi.mock('node:timers/promises', () => ({setTimeout: vi.fn()}))

function setup() {
  const send = vi.fn().mockResolvedValue(undefined)
  const result = vi.fn().mockResolvedValue(undefined)
  const status = vi.fn().mockResolvedValue({chain: {coreChainLockedHeight: 1564252}})
  const sdk = {stateTransitions: {broadcast: send, waitForStateTransitionResult: result}, node: {status}} as unknown as DashPlatformSDK
  const st = {hash: () => 'st-hash'} as unknown as StateTransitionWASM
  const controller = new AbortController()
  const ctx: OperationContext = {
    sdk, network: 'testnet', signal: controller.signal, progress: vi.fn(), notesSpent: vi.fn(),
  }
  return {sdk, st, ctx, controller, send, result, status}
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  vi.mocked(delay).mockReset()
  vi.mocked(delay).mockImplementation(async ms => {
    vi.setSystemTime(Date.now() + (ms ?? 0))
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('asset lock consensus Core height preflight', () => {
  it('does not broadcast until Platform reaches the required height', async () => {
    const {sdk, st, ctx, send, result, status} = setup()
    status.mockImplementationOnce(async () => {
      expect(send).not.toHaveBeenCalled()
      expect(ctx.progress).not.toHaveBeenCalledWith('broadcasting', 0, 0)
      return {chain: {coreChainLockedHeight: 1564251}}
    })

    await expect(broadcast(sdk, st, ctx, {idempotent: true, requiredCoreHeight: 1564252})).resolves.toBe('st-hash')

    expect(status).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledExactlyOnceWith(st)
    expect(result).toHaveBeenCalledExactlyOnceWith(st)
    expect(ctx.progress).toHaveBeenCalledWith('fetching', 1564251, 1564252)
    expect(delay).toHaveBeenCalledWith(CORE_HEIGHT_POLL_MS, undefined, {signal: ctx.signal})
  })

  it('broadcasts without a polling delay when Platform is already ready', async () => {
    const {sdk, st, ctx, send, status} = setup()
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).resolves.toBe('st-hash')
    expect(status).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledOnce()
    expect(delay).not.toHaveBeenCalled()
  })

  it('accepts a consensus height beyond the proof height', async () => {
    const {sdk, st, ctx, send, status} = setup()
    status.mockResolvedValue({chain: {coreChainLockedHeight: 1564253}})
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).resolves.toBe('st-hash')
    expect(send).toHaveBeenCalledOnce()
  })

  it('keeps polling through missing status data and temporary status failures', async () => {
    const {sdk, st, ctx, send, status} = setup()
    status.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('status unavailable'))
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).resolves.toBe('st-hash')
    expect(status).toHaveBeenCalledTimes(3)
    expect(send).toHaveBeenCalledOnce()
  })

  it('does not broadcast when status reaches the required height at the deadline', async () => {
    const {sdk, st, ctx, send, result, status} = setup()
    status.mockImplementationOnce(async () => {
      vi.setSystemTime(CORE_HEIGHT_WAIT_MS)
      return {chain: {coreChainLockedHeight: 1564252}}
    })
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).rejects.toMatchObject({
      message: 'Timed out waiting for Platform consensus Core height to reach 1564252',
      code: 'network', stHash: null,
    })
    expect(send).not.toHaveBeenCalled()
    expect(result).not.toHaveBeenCalled()
  })

  it('times out without broadcasting while consensus stays behind', async () => {
    const {sdk, st, ctx, send, result, status} = setup()
    status.mockResolvedValue({chain: {coreChainLockedHeight: 1564251}})
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).rejects.toMatchObject({code: 'network', stHash: null})
    expect(Date.now()).toBe(CORE_HEIGHT_WAIT_MS)
    expect(send).not.toHaveBeenCalled()
    expect(result).not.toHaveBeenCalled()
  })

  it('does not retry a height rejection after preflight', async () => {
    const {sdk, st, ctx, send, status} = setup()
    send.mockRejectedValueOnce(new Error('Asset Lock proof core chain height 1564252 is higher than the current consensus core height 1564251'))
    await expect(broadcast(sdk, st, ctx, {idempotent: true, requiredCoreHeight: 1564252})).rejects.toMatchObject({code: 'network', stHash: null})
    expect(send).toHaveBeenCalledOnce()
    expect(status).toHaveBeenCalledOnce()
  })

  it('stops on cancellation without broadcasting', async () => {
    const {sdk, st, ctx, send, status, controller} = setup()
    status.mockImplementationOnce(async () => {
      controller.abort()
      return {chain: {coreChainLockedHeight: 1564252}}
    })
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).rejects.toThrow('request aborted')
    expect(send).not.toHaveBeenCalled()
  })

  it('does not poll status when no required height is passed', async () => {
    const {sdk, st, ctx, send, status} = setup()
    await expect(broadcast(sdk, st, ctx, {idempotent: true})).resolves.toBe('st-hash')
    expect(send).toHaveBeenCalledOnce()
    expect(status).not.toHaveBeenCalled()
  })

  it('preserves the transition hash when waiting for an accepted broadcast fails', async () => {
    const {sdk, st, ctx, send, result} = setup()
    result.mockRejectedValueOnce(new Error('result unavailable'))
    await expect(broadcast(sdk, st, ctx, {requiredCoreHeight: 1564252})).rejects.toMatchObject({
      message: 'result unavailable', code: 'network', stHash: 'st-hash',
    })
    expect(send).toHaveBeenCalledOnce()
  })
})
