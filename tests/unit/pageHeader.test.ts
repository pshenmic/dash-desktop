import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { isEmphasizedCopy } from '../../src/renderer/src/utils/pageHeader'
import { PAGE_HEADERS } from '../../src/renderer/src/constants/pageHeaders'

describe('isEmphasizedCopy', () => {
  it('accepts the emphasized subtitle entries', () => {
    expect(isEmphasizedCopy(PAGE_HEADERS.send.subtitle)).toBe(true)
    expect(isEmphasizedCopy(PAGE_HEADERS.recipients.subtitle)).toBe(true)
    expect(isEmphasizedCopy(PAGE_HEADERS.coinControl.subtitle)).toBe(true)
  })

  it('rejects plain React nodes', () => {
    expect(isEmphasizedCopy(PAGE_HEADERS.dashboard.subtitle)).toBe(false)
    expect(isEmphasizedCopy(createElement('strong', null, 'x'))).toBe(false)
    expect(isEmphasizedCopy(['a', 'b'])).toBe(false)
    expect(isEmphasizedCopy(null)).toBe(false)
    expect(isEmphasizedCopy(undefined)).toBe(false)
    expect(isEmphasizedCopy(0)).toBe(false)
  })
})
