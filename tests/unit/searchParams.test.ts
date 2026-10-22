import { describe, expect, it } from 'vitest'
import { enumParam, returnHref, withParams } from '../../src/renderer/src/utils/searchParams'
import { ContactSegment, DashPayTab } from '../../src/renderer/src/enums/DashPay'

describe('withParams', () => {
  it('merges a patch without wiping unrelated params', () => {
    expect(withParams('?identity=abc&tab=contacts', { segment: 'sent' })).toBe('identity=abc&tab=contacts&segment=sent')
    expect(withParams(new URLSearchParams('tab=keys'), { tab: 'usernames' })).toBe('tab=usernames')
  })

  it('removes a param set to null and ignores an undefined one', () => {
    expect(withParams('identity=abc&contact=xyz', { contact: null, tab: undefined })).toBe('identity=abc')
    expect(withParams('', { contact: null })).toBe('')
  })
})

describe('enumParam', () => {
  it('accepts a known value and falls back otherwise', () => {
    expect(enumParam(DashPayTab, 'usernames', DashPayTab.Overview)).toBe(DashPayTab.Usernames)
    expect(enumParam(DashPayTab, 'Usernames', DashPayTab.Overview)).toBe(DashPayTab.Overview)
    expect(enumParam(DashPayTab, 'keys', DashPayTab.Overview)).toBe(DashPayTab.Overview)
    expect(enumParam(DashPayTab, null, DashPayTab.Overview)).toBe(DashPayTab.Overview)
    expect(enumParam(ContactSegment, 'requests', ContactSegment.All)).toBe(ContactSegment.Requests)
  })
})

describe('returnHref', () => {
  it('re-patches the acting identity onto the origin, keeping its other params', () => {
    expect(returnHref('/dashpay?identity=old&tab=contacts&segment=sent', '/dashpay', 'new'))
      .toBe('/dashpay?identity=new&tab=contacts&segment=sent')
    expect(returnHref('/dashpay', '/dashpay?tab=usernames', 'new')).toBe('/dashpay?identity=new')
  })

  it('uses the fallback for a missing or non-internal origin', () => {
    expect(returnHref(undefined, '/dashpay?tab=usernames', 'me')).toBe('/dashpay?tab=usernames&identity=me')
    expect(returnHref('https://example.com/', '/dashpay', 'me')).toBe('/dashpay?identity=me')
  })

  it('leaves the target alone without an acting identity', () => {
    expect(returnHref('/dashpay?tab=keys', '/dashpay', null)).toBe('/dashpay?tab=keys')
  })
})
