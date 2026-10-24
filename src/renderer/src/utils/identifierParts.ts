import { IDENTIFIER_EDGE_CHARS } from '../constants/identifier'
import type { IdentifierParts } from '../types/HighlightedIdentifier'

export function identifierParts(text: string): IdentifierParts {
  if (text.length <= IDENTIFIER_EDGE_CHARS * 2) return {first: text, middle: '', last: ''}
  return {
    first: text.slice(0, IDENTIFIER_EDGE_CHARS),
    middle: text.slice(IDENTIFIER_EDGE_CHARS, -IDENTIFIER_EDGE_CHARS),
    last: text.slice(-IDENTIFIER_EDGE_CHARS),
  }
}
