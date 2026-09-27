import {describe, expect, it} from 'vitest'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {Preferences} from '../../src/main/src/preferences'
import {ShieldedSend} from '../../src/main/src/types/PlatformTransaction'

const WALLET = 'wallet-1'
const FROM = 'tdash1kq79z66rh34l4u2axlz3jv34zwshggnenul6cvwn'
const OURS = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
const THEIRS = 'tdash1zq2j8jgzspy42499wzc4xd4ez6tj6nvuhuw20ucdugrys2xjfgqaplc32zja5kx62w6qu8sylj2vk'

function service(ourShielded: string[]) {
  const sends: ShieldedSend[] = []
  const svc = new ShieldedService(
    null as never,
    null as never,
    null as never,
    null as never,
    {getAddresses: async () => ourShielded.map(address => ({address}))} as never,
    null as never,
    null as never,
    {recordShieldedSend: async (_walletId: string, send: ShieldedSend) => { sends.push(send) }} as never,
    Preferences.default(),
  )
  return {svc, sends}
}

describe('ShieldedService.recordShield', () => {
  // Both ends are this wallet's, so the credits never left it: the row has to
  // say so, or the list reads a move between two of our own as a loss.
  it('records both ends of a shield into our own pool', async () => {
    const {svc, sends} = service([OURS])

    await svc.recordShield(WALLET, 'HASH', {from: FROM, to: OURS, credits: 443_567_314_000n})

    expect(sends[0].sides).toEqual([
      {address: FROM, credits: -443_567_314_000n},
      {address: OURS, credits: 443_567_314_000n},
    ])
    expect(sends[0].paid).toBeNull()
  })

  it('records a shield to somebody else as the payment out it is', async () => {
    const {svc, sends} = service([OURS])

    await svc.recordShield(WALLET, 'HASH', {from: FROM, to: THEIRS, credits: 500n})

    expect(sends[0].sides).toEqual([{address: FROM, credits: -500n}])
    expect(sends[0].paid).toEqual({source: THEIRS, amount: 500n})
  })

  it('names the type the explorer will use for it', async () => {
    const {svc, sends} = service([OURS])

    await svc.recordShield(WALLET, 'HASH', {from: FROM, to: OURS, credits: 1n})

    expect(sends[0].type).toBe('SHIELD')
  })
})
