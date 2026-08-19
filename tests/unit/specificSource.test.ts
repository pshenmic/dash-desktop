import { describe, expect, it } from 'vitest'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import {
  initialSpecificSourcePreferences,
  specificSourceKindForOperation,
  updateSpecificSourcePreference,
} from '../../src/renderer/src/utils/specificSource'

describe('specific source preferences', () => {
  it('keeps Core and Shielded settings independent', () => {
    const initial = initialSpecificSourcePreferences()
    const withCore = updateSpecificSourcePreference(initial, SourceKind.Core, {
      enabled: true,
      address: 'core-address',
    })
    const withShielded = updateSpecificSourcePreference(withCore, SourceKind.Shielded, {
      address: 'shielded-address',
    })

    expect(withShielded[SourceKind.Core]).toEqual({
      enabled: true,
      address: 'core-address',
    })
    expect(withShielded[SourceKind.Shielded]).toEqual({
      enabled: false,
      address: 'shielded-address',
    })
  })

  it('keeps the selected address when a method preference is toggled', () => {
    const selected = updateSpecificSourcePreference(
      initialSpecificSourcePreferences(),
      SourceKind.Core,
      { enabled: true, address: 'core-address' },
    )
    const disabled = updateSpecificSourcePreference(selected, SourceKind.Core, { enabled: false })
    const enabledAgain = updateSpecificSourcePreference(disabled, SourceKind.Core, { enabled: true })

    expect(enabledAgain[SourceKind.Core]).toEqual({
      enabled: true,
      address: 'core-address',
    })
  })

  it.each([
    [TransferOperation.CoreSend, SourceKind.Core],
    [TransferOperation.ShieldedTransfer, SourceKind.Shielded],
    [TransferOperation.Unshield, SourceKind.Shielded],
    [TransferOperation.ShieldedWithdrawal, SourceKind.Shielded],
    [TransferOperation.IdentityCreateFromPool, null],
    [TransferOperation.AssetLockFunding, null],
  ])('maps %s to its applicable preference', (operation, expected) => {
    expect(specificSourceKindForOperation(operation)).toBe(expected)
  })
})
