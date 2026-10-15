import { DASHPAY_CONTACTS, DASHPAY_IDENTITIES, DASHPAY_NAMES, DASHPAY_PEOPLE, DEMO_CONTEST_END, DEMO_LOCKED_NAMES } from '@renderer/constants/dashpayDemo'
import type { DashpayContact, DashpayContactStatus, DashpayDemoAction, DashpayDemoState, DashpayName, DashpayNameCheck, DashpayPerson, DashpayScenario } from '@renderer/types/dashpayDemo'

export function normalizeDemoUsername(input: string): string {
  return input.trim().replace(/^@/, '').replace(/\.dash$/i, '').toLowerCase().replace(/[oli]/g, (letter) => letter === 'o' ? '0' : '1')
}

export function checkDemoName(input: string, names: DashpayName[]): DashpayNameCheck {
  const label = input.trim().replace(/^@/, '').replace(/\.dash$/i, '')
  const normalizedLabel = normalizeDemoUsername(label)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]$/.test(label)) {
    return { label, normalizedLabel, status: 'invalid', message: 'Use 3–63 letters, numbers or hyphens. Start and end with a letter or number.' }
  }
  const existing = names.find((name) => normalizeDemoUsername(name.label) === normalizedLabel)
  if (DEMO_LOCKED_NAMES.some((name) => normalizeDemoUsername(name) === normalizedLabel) || existing?.status === 'locked') {
    return { label, normalizedLabel, status: 'locked', message: 'This name is locked and cannot be requested in this preview.' }
  }
  if (existing || DASHPAY_PEOPLE.some((person) => normalizeDemoUsername(person.username) === normalizedLabel)) {
    return { label, normalizedLabel, status: 'taken', message: 'This name is already registered or has an active request in the demo directory.' }
  }
  if (/^[a-z01-]{3,19}$/.test(normalizedLabel)) {
    return { label, normalizedLabel, status: 'contested', message: 'This name requires a vote. Submitting a request does not guarantee ownership.' }
  }
  return { label, normalizedLabel, status: 'available', message: 'Available for standard registration in this preview.' }
}

export function searchDemoPeople(query: string, state?: DashpayDemoState): DashpayPerson[] {
  const search = query.trim().replace(/^@/, '').replace(/\.dash$/i, '').toLowerCase()
  const normalizedSearch = normalizeDemoUsername(search)
  const directory = state ? DASHPAY_PEOPLE.flatMap((person) => {
    if (!DASHPAY_IDENTITIES.some((identity) => identity.id === person.id)) return [person]
    const names = state.names.filter((name) => name.identityId === person.id && name.status === 'registered')
    const matchingName = names.find((name) => normalizeDemoUsername(name.label).includes(normalizedSearch))
    return names.length ? [{ ...person, username: matchingName?.label ?? names[0].label }] : []
  }) : DASHPAY_PEOPLE
  return directory.filter((person) => normalizeDemoUsername(person.username).includes(normalizedSearch) || person.displayName.toLowerCase().includes(search))
}

export function getDemoIdentityNames(state: DashpayDemoState): DashpayName[] {
  return state.names.filter((name) => name.identityId === state.selectedIdentityId)
}

export function getDemoIdentityContacts(state: DashpayDemoState): DashpayContact[] {
  return state.contacts.filter((contact) => contact.identityId === state.selectedIdentityId)
}

export function getDemoContactStatus(state: DashpayDemoState, personId: string): DashpayContactStatus | null {
  return getDemoIdentityContacts(state).find((contact) => contact.personId === personId)?.status ?? null
}

export function createDashpayDemoState(scenario: DashpayScenario = 'ready'): DashpayDemoState {
  const state: DashpayDemoState = {
    scenario,
    identities: DASHPAY_IDENTITIES.map((identity) => ({ ...identity })),
    selectedIdentityId: DASHPAY_IDENTITIES[0].id,
    names: DASHPAY_NAMES.map((name) => ({ ...name })),
    contacts: DASHPAY_CONTACTS.map((contact) => ({ ...contact })),
  }
  if (scenario === 'new') return { scenario, identities: [], selectedIdentityId: '', names: [], contacts: [] }
  if (scenario === 'unnamed') return { ...state, identities: state.identities.slice(0, 1), names: [], contacts: [] }
  if (scenario === 'pending') return {
    ...state,
    identities: state.identities.slice(0, 1),
    names: [{ id: 'demo-pending-name', identityId: state.selectedIdentityId, label: 'alice', status: 'voting', endsAt: DEMO_CONTEST_END }],
    contacts: [],
  }
  if (scenario === 'empty') return { ...state, contacts: [] }
  return state
}

export function dashpayDemoReducer(state: DashpayDemoState, action: DashpayDemoAction): DashpayDemoState {
  if (action.type === 'scenario') return createDashpayDemoState(action.scenario)
  if (action.type === 'selectIdentity') {
    return state.identities.some((identity) => identity.id === action.identityId) ? { ...state, selectedIdentityId: action.identityId } : state
  }
  if (action.type === 'createIdentity') {
    if (state.identities.length) return state
    return { ...state, scenario: 'unnamed', identities: [{ ...DASHPAY_IDENTITIES[0] }], selectedIdentityId: DASHPAY_IDENTITIES[0].id }
  }
  if (!state.identities.some((identity) => identity.id === state.selectedIdentityId) || state.scenario === 'loading' || state.scenario === 'error') return state
  if (action.type === 'registerName') {
    const check = checkDemoName(action.label, state.names)
    if (check.status !== 'available' && check.status !== 'contested') return state
    return {
      ...state,
      scenario: 'ready',
      names: [...state.names, {
        id: `demo-name-${check.normalizedLabel}`,
        identityId: state.selectedIdentityId,
        label: check.label,
        status: check.status === 'contested' ? 'voting' : 'registered',
        ...(check.status === 'contested' ? { endsAt: DEMO_CONTEST_END } : {}),
      }],
    }
  }
  if (!DASHPAY_PEOPLE.some((person) => person.id === action.personId) || DASHPAY_IDENTITIES.some((identity) => identity.id === action.personId)) return state
  const current = getDemoContactStatus(state, action.personId)
  if (action.type === 'sendRequest') {
    if (current) return state
    return { ...state, contacts: [...state.contacts, { identityId: state.selectedIdentityId, personId: action.personId, status: 'outgoing' }] }
  }
  if (current !== 'incoming') return state
  if (action.type === 'ignoreRequest') return {
    ...state,
    contacts: state.contacts.filter((contact) => !(contact.identityId === state.selectedIdentityId && contact.personId === action.personId)),
  }
  return {
    ...state,
    contacts: state.contacts.map((contact) => contact.identityId === state.selectedIdentityId && contact.personId === action.personId ? { ...contact, status: 'contact' } : contact),
  }
}
