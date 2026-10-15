import { describe, expect, it } from 'vitest'
import { checkDemoName, createDashpayDemoState, dashpayDemoReducer, getDemoContactStatus, getDemoIdentityNames, normalizeDemoUsername, searchDemoPeople } from '../../src/renderer/src/utils/dashpayDemo'

describe('DashPay demo name checks', () => {
  it('checks homograph and case collisions across names', () => {
    expect(normalizeDemoUsername(' @Alice.dash ')).toBe('a11ce')
    const state = createDashpayDemoState('pending')
    expect(checkDemoName('A11CE', state.names).status).toBe('taken')
    expect(checkDemoName('SUPPORT', []).status).toBe('locked')
  })

  it('distinguishes invalid, standard and contested requests', () => {
    for (const input of ['ab', '-alice', 'alice-', 'alice name', 'a'.repeat(64)]) expect(checkDemoName(input, []).status).toBe('invalid')
    expect(checkDemoName('new-person77', []).status).toBe('available')
    expect(checkDemoName('new-person', []).status).toBe('contested')
  })

  it('rechecks registration and preserves existing requests', () => {
    const state = createDashpayDemoState('unnamed')
    const created = dashpayDemoReducer(state, { type: 'registerName', label: 'new-person77' })
    expect(getDemoIdentityNames(created)[0].status).toBe('registered')
    expect(dashpayDemoReducer(created, { type: 'registerName', label: 'NEW-PERSON77' })).toBe(created)
    const contested = dashpayDemoReducer(state, { type: 'registerName', label: 'new-person' })
    expect(getDemoIdentityNames(contested)[0].status).toBe('voting')
  })

  it('resolves newly registered aliases while keeping pending names out of the people directory', () => {
    const state = createDashpayDemoState('unnamed')
    const created = dashpayDemoReducer(state, { type: 'registerName', label: 'new-person77' })
    expect(searchDemoPeople('new-person77.dash', created)).toEqual([expect.objectContaining({ id: 'demo-alice', username: 'new-person77' })])
    expect(searchDemoPeople('alice2026', state)).toHaveLength(0)
    expect(searchDemoPeople('alice', createDashpayDemoState('pending'))).toHaveLength(0)
    expect(searchDemoPeople('a11ce-pay', createDashpayDemoState())[0].id).toBe('demo-alice')
  })
})

describe('DashPay demo relationships', () => {
  it('keeps sent requests pending, rejects duplicates and accepts only incoming requests', () => {
    const state = createDashpayDemoState('empty')
    const sent = dashpayDemoReducer(state, { type: 'sendRequest', personId: 'demo-bob' })
    expect(getDemoContactStatus(sent, 'demo-bob')).toBe('outgoing')
    expect(dashpayDemoReducer(sent, { type: 'sendRequest', personId: 'demo-bob' })).toBe(sent)
    expect(dashpayDemoReducer(sent, { type: 'acceptRequest', personId: 'demo-bob' })).toBe(sent)
    const accepted = dashpayDemoReducer(createDashpayDemoState(), { type: 'acceptRequest', personId: 'demo-dan' })
    expect(getDemoContactStatus(accepted, 'demo-dan')).toBe('contact')
  })

  it('isolates identities and ignores only the selected identity incoming request', () => {
    const state = createDashpayDemoState()
    const studio = dashpayDemoReducer(state, { type: 'selectIdentity', identityId: 'demo-studio' })
    expect(getDemoContactStatus(studio, 'demo-dan')).toBeNull()
    expect(dashpayDemoReducer(studio, { type: 'ignoreRequest', personId: 'demo-dan' })).toBe(studio)
    const ignored = dashpayDemoReducer(state, { type: 'ignoreRequest', personId: 'demo-dan' })
    expect(getDemoContactStatus(ignored, 'demo-dan')).toBeNull()
    expect(getDemoContactStatus(ignored, 'demo-bob')).toBe('contact')
  })

  it('rejects own identities, unknown people and writes without a ready identity', () => {
    const state = createDashpayDemoState()
    for (const personId of ['demo-alice', 'demo-studio', 'unknown']) expect(dashpayDemoReducer(state, { type: 'sendRequest', personId })).toBe(state)
    for (const scenario of ['new', 'loading', 'error'] as const) {
      const unavailable = createDashpayDemoState(scenario)
      expect(dashpayDemoReducer(unavailable, { type: 'sendRequest', personId: 'demo-bob' })).toBe(unavailable)
    }
  })

  it('resets all changes when switching demo scenarios and never mutates fixtures', () => {
    const state = createDashpayDemoState('empty')
    const sent = dashpayDemoReducer(state, { type: 'sendRequest', personId: 'demo-bob' })
    expect(state.contacts).toHaveLength(0)
    const reset = dashpayDemoReducer(sent, { type: 'scenario', scenario: 'new' })
    expect(reset.identities).toHaveLength(0)
    expect(reset.contacts).toHaveLength(0)
    expect(createDashpayDemoState().contacts).toHaveLength(5)
  })
})
