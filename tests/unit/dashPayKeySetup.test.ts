import { describe, expect, it } from 'vitest'
import { dashPayEnabledHeadline, enableDashPayDescription } from '../../src/renderer/src/utils/dashPayKeySetup'

describe('Enable DashPay copy', () => {
  it('names the identity', () => {
    expect(enableDashPayDescription('alice.dash')).toBe('Adds the keys alice.dash needs for contacts.')
    expect(dashPayEnabledHeadline('alice.dash')).toBe('DashPay enabled for alice.dash')
  })
})
