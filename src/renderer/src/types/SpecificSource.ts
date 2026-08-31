import { SourceKind } from '../enums/SourceKind'

export type SpecificSourceKind = SourceKind.Core | SourceKind.PlatformAddress | SourceKind.Shielded

export interface SpecificSourcePreferences {
  enabled: boolean
  addresses: Record<SpecificSourceKind, string | null>
}
