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

  it('restores the complete form draft while applying valid URL endpoints', () => {
    const draft = {
      ...createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress),
      fromAddress: 'platform-source',
      fromIdentity: 'identity-source',
      toValue: 'recipient',
      amount: '1.25',
      acked: true,
    }
    saveSendDraft('wallet-a', draft)

    expect(getOrCreateSendDraft('wallet-a', SourceKind.Core, DestinationKind.CoreAddress)).toEqual({
      ...draft,
      fromKind: SourceKind.Core,
      toKind: DestinationKind.CoreAddress,
    })
  })

  it('only applies URL endpoints that are explicitly provided and valid', () => {
    const draft = createSendDraft(SourceKind.Identity, DestinationKind.PlatformAddress)
    saveSendDraft('wallet-a', draft)

    expect(getOrCreateSendDraft('wallet-a', null, DestinationKind.Shielded)).toMatchObject({
      fromKind: SourceKind.Identity,
      toKind: DestinationKind.Shielded,
    })
    expect(getOrCreateSendDraft('wallet-a', 'invalid', null)).toMatchObject({
      fromKind: SourceKind.Identity,
      toKind: DestinationKind.Shielded,
    })
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
