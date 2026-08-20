import { SourceKind } from '../enums/SourceKind'

export type SpecificSourceKind = SourceKind.Core | SourceKind.Shielded

export interface SpecificSourcePreferences {
  enabled: boolean
  addresses: Record<SpecificSourceKind, string | null>
}
