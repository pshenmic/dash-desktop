import {beforeEach, describe, expect, it, vi} from 'vitest'

const harness = vi.hoisted(() => ({
  refreshDashPay: vi.fn(),
  refreshContacts: vi.fn(),
  refreshUsernames: vi.fn(),
  invalidatePrefix: vi.fn(),
}))

vi.mock('@renderer/api', () => ({API: {refreshDashPay: harness.refreshDashPay}}))
vi.mock('../../src/renderer/src/hooks/useDashPayContacts', () => ({refreshDashPayContacts: harness.refreshContacts}))
vi.mock('../../src/renderer/src/hooks/useDashPayUsernames', () => ({refreshDashPayUsernames: harness.refreshUsernames}))
vi.mock('../../src/renderer/src/hooks/useAsyncWithCache', () => ({invalidateAsyncCachePrefix: harness.invalidatePrefix}))

import {refreshDashPay} from '../../src/renderer/src/hooks/useDashPayRefresh'

describe('refreshDashPay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    harness.refreshContacts.mockResolvedValue(undefined)
    harness.refreshUsernames.mockResolvedValue(undefined)
  })

  it('shares one backend refresh between concurrent callers and re-reads every DashPay list after it', async () => {
    let finish: () => void = () => {}
    harness.refreshDashPay.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))

    const first = refreshDashPay('wallet')
    const second = refreshDashPay('wallet')
    expect(second).toBe(first)
    finish()
    await first

    expect(harness.refreshDashPay).toHaveBeenCalledOnce()
    expect(harness.invalidatePrefix).toHaveBeenCalledWith('dashpay-payments', 'wallet:')
    expect(harness.refreshContacts).toHaveBeenCalledWith('wallet')
    expect(harness.refreshUsernames).toHaveBeenCalledWith('wallet')
  })

  it('leaves the lists alone when the backend refresh fails, reports the failure and allows a new run', async () => {
    harness.refreshDashPay.mockRejectedValueOnce(new Error('offline'))
    await expect(refreshDashPay('wallet')).rejects.toThrow('offline')
    expect(harness.invalidatePrefix).not.toHaveBeenCalled()
    expect(harness.refreshContacts).not.toHaveBeenCalled()
    expect(harness.refreshUsernames).not.toHaveBeenCalled()

    harness.refreshDashPay.mockResolvedValueOnce(undefined)
    await refreshDashPay('wallet')
    expect(harness.refreshDashPay).toHaveBeenCalledTimes(2)
  })
})
