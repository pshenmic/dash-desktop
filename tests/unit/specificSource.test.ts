import { describe, expect, it } from 'vitest'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import {
  initialSpecificSourcePreferences,
  specificSourceKindForOperation,
  updateSpecificSourceAddress,
  updateSpecificSourceEnabled,
} from '../../src/renderer/src/utils/specificSource'

describe('specific source preferences', () => {
  it('stays enabled when switching from a Core method to a Shielded method', () => {
    const preferences = updateSpecificSourceEnabled(initialSpecificSourcePreferences(), true)

    expect(preferences.enabled).toBe(true)
    expect(specificSourceKindForOperation(TransferOperation.CoreSend)).toBe(SourceKind.Core)
    expect(specificSourceKindForOperation(TransferOperation.ShieldedTransfer)).toBe(SourceKind.Shielded)
    expect(preferences.enabled).toBe(true)
  })

  it('keeps Core and Shielded addresses independent when the shared setting is toggled', () => {
    const withCore = updateSpecificSourceAddress(initialSpecificSourcePreferences(), SourceKind.Core, 'core-address')
    const withShielded = updateSpecificSourceAddress(withCore, SourceKind.Shielded, 'shielded-address')
    const enabled = updateSpecificSourceEnabled(withShielded, true)
    const disabled = updateSpecificSourceEnabled(enabled, false)
    const enabledAgain = updateSpecificSourceEnabled(disabled, true)

    expect(enabledAgain).toEqual({
      enabled: true,
      addresses: {
        [SourceKind.Core]: 'core-address',
        [SourceKind.Shielded]: 'shielded-address',
      },
    })
  })

  it.each([
    [TransferOperation.CoreSend, SourceKind.Core],
    [TransferOperation.ShieldedTransfer, SourceKind.Shielded],
    [TransferOperation.Unshield, SourceKind.Shielded],
    [TransferOperation.ShieldedWithdrawal, SourceKind.Shielded],
    [TransferOperation.IdentityCreateFromShielded, null],
    [TransferOperation.AssetLockFunding, null],
  ])('maps %s to its applicable preference', (operation, expected) => {
    expect(specificSourceKindForOperation(operation)).toBe(expected)
  })
})
