import {describe, expect, it} from 'vitest'
import {ShieldedService} from '../../src/main/src/services/ShieldedService'

function service(): ShieldedService {
  return new ShieldedService(
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  )
}

describe('ShieldedService.startShieldFromL1', () => {
  it.each(['', '   '])('requires an explicit shielded recipient for %j', async recipient => {
    await expect(service().startShieldFromL1('wallet-1', recipient, 10_000_000n, 'password'))
      .rejects.toThrow('Shielded recipient address is required')
  })
})
