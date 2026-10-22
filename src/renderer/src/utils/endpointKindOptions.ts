import { SEND_ENDPOINT_LABELS } from '../constants/sendPages'
import type { DestinationKind } from '../enums/DestinationKind'
import type { SourceKind } from '../enums/SourceKind'
import type { DropdownFieldOption } from '../types/DropdownField'
import type { EndpointKindEntry } from '../types/EndpointPicker'

export function endpointKindOptions(kinds: EndpointKindEntry[]): DropdownFieldOption[] {
  return kinds.map(({ kind, label }) => {
    const endpoint = SEND_ENDPOINT_LABELS[kind as `${SourceKind | DestinationKind}`]
    return endpoint ? { value: kind, label: endpoint.name, suffix: endpoint.layer } : { value: kind, label }
  })
}
