import { SourceKind } from '../enums/SourceKind'

export type SpecificSourceKind = SourceKind.Core | SourceKind.Shielded

export interface SpecificSourcePreference {
  enabled: boolean
  address: string | null
}

export type SpecificSourcePreferences = Record<SpecificSourceKind, SpecificSourcePreference>
