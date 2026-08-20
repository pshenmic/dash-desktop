import { afterEach, describe, expect, it } from 'vitest'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import {
  clearSendDraft,
  createSendDraft,
  getOrCreateSendDraft,
  saveSendDraft,
} from '../../src/renderer/src/utils/sendDraft'

describe('send drafts', () => {
  afterEach(() => {
    clearSendDraft('wallet-a')
    clearSendDraft('wallet-b')
  })

  it('uses valid URL endpoints only when creating a draft', () => {
    expect(createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress)).toMatchObject({
      fromKind: SourceKind.Identity,
      toKind: DestinationKind.PlatformAddress,
    })
    expect(createSendDraft('invalid', 'invalid')).toMatchObject({
      fromKind: SourceKind.Core,
      toKind: DestinationKind.CoreAddress,
    })
  })

  it('restores the complete form draft for the same wallet without applying new URL endpoints', () => {
    const draft = {
      ...createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress),
      fromAddress: 'platform-source',
      fromIdentity: 'identity-source',
      toValue: 'recipient',
      amount: '1.25',
      acked: true,
      specificSourcePreferences: {
        enabled: true,
        addresses: {
          [SourceKind.Core]: 'core-source',
          [SourceKind.Shielded]: 'shielded-source',
        },
      },
    }
    saveSendDraft('wallet-a', draft)

    expect(getOrCreateSendDraft('wallet-a', SourceKind.Core, DestinationKind.CoreAddress)).toEqual(draft)
  })

  it('keeps drafts isolated by wallet and removes a cleared draft', () => {
    const walletA = { ...createSendDraft(), toValue: 'wallet-a-recipient' }
    saveSendDraft('wallet-a', walletA)

    expect(getOrCreateSendDraft('wallet-b', SourceKind.Shielded, DestinationKind.Shielded)).toMatchObject({
      fromKind: SourceKind.Shielded,
      toKind: DestinationKind.Shielded,
      toValue: '',
    })

    clearSendDraft('wallet-a')
    expect(getOrCreateSendDraft('wallet-a', SourceKind.Core, DestinationKind.PlatformAddress)).toMatchObject({
      fromKind: SourceKind.Core,
      toKind: DestinationKind.PlatformAddress,
      toValue: '',
    })
  })
})
