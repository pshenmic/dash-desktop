import { describe, expect, it } from 'vitest'
import { endpointKindOptions } from '../../src/renderer/src/utils/endpointKindOptions'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { SourceKind } from '../../src/renderer/src/enums/SourceKind'

describe('endpointKindOptions', () => {
  it('splits layered kinds into a name and a dimmed layer suffix', () => {
    expect(endpointKindOptions([
      {kind: SourceKind.Core, label: 'Dash Core (L1)'},
      {kind: DestinationKind.CoreAddress, label: 'Dash address (L1)'},
      {kind: SourceKind.PlatformAddress, label: 'Platform address'},
    ])).toEqual([
      {value: SourceKind.Core, label: 'Dash Core', suffix: '(L1)'},
      {value: DestinationKind.CoreAddress, label: 'Dash Core', suffix: '(L1)'},
      {value: SourceKind.PlatformAddress, label: 'Address', suffix: '(L2)'},
    ])
  })

  it('keeps the caller label and no suffix for kinds without a layer', () => {
    expect(endpointKindOptions([
      {kind: SourceKind.Identity, label: 'Identity'},
      {kind: DestinationKind.Shielded, label: 'Shielded address'},
      {kind: DestinationKind.NewIdentity, label: 'New identity'},
    ])).toEqual([
      {value: SourceKind.Identity, label: 'Identity'},
      {value: DestinationKind.Shielded, label: 'Shielded address'},
      {value: DestinationKind.NewIdentity, label: 'New identity'},
    ])
  })
})
