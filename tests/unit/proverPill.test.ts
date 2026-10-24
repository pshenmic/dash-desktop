import { describe, expect, it } from 'vitest'
import { proverFailureLabel } from '../../src/renderer/src/utils/proverPill'

describe('proverFailureLabel', () => {
  it('falls back to a generic reason when the prover reports none', () => {
    expect(proverFailureLabel(null)).toBe('Prep failed: unknown error')
  })

  it('keeps a short error as is', () => {
    expect(proverFailureLabel('params missing')).toBe('Prep failed: params missing')
  })

  it('keeps an error of exactly the preview length', () => {
    const error = 'x'.repeat(48)
    expect(proverFailureLabel(error)).toBe(`Prep failed: ${error}`)
  })

  it('cuts a longer error to the preview length with an ellipsis', () => {
    expect(proverFailureLabel(`${'y'.repeat(48)}overflow`)).toBe(`Prep failed: ${'y'.repeat(48)}…`)
  })
})
