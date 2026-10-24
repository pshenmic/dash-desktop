import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from 'dash-ui-kit/react'
import type { DashPayContactDto } from '@renderer/api/types'
import ContactsTab from '@renderer/components/pages/dashpay/contacts/ContactsTab'
import { DASHPAY_CONTACTS_PAGE_SIZE } from '@renderer/constants/dashPay'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { ContactSegment, ContactSort, DashPayContactRelationship, DashPayReadiness } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { DashPayReadinessInfo } from '@renderer/types/DashPay'
import type { ContactsTabProps } from '@renderer/types/DashPayScreens'

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0)
const ACTING = 'B7kcE1111111111111111111111111111111LCpQH'
const OTHER = '8eTDk2222222222222222222222222222222Q1sdP'
const SPLIT: Array<[DashPayContactRelationship, number]> = [
  [DashPayContactRelationship.Incoming, 12],
  [DashPayContactRelationship.Established, 186],
  [DashPayContactRelationship.Outgoing, 16],
]

const contacts = vi.hoisted(() => ({ list: [] as DashPayContactDto[] }))

vi.mock('@renderer/hooks/useDashPayContacts', () => ({
  useDashPayContacts: () => ({ contacts: contacts.list, loading: false, err: null }),
  refreshDashPayContacts: () => Promise.resolve(),
  setDashPayContactsCache: () => {},
}))
vi.mock('@renderer/components/pages/dashpay/keys/EnableDashPayModal', () => ({ default: () => null }))
vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ rateReady: false, format: () => '' }) }))
vi.stubGlobal('React', React)

function contactId(index: number): string {
  return `Dc${String(index).padStart(4, '0')}${'z'.repeat(34)}Qp`
}

function generateContacts(): DashPayContactDto[] {
  const generated: DashPayContactDto[] = []
  for (const [relationship, count] of SPLIT) {
    for (let index = 0; index < count; index += 1) {
      const n = generated.length
      const at = NOW - (n + 1) * 3_600_000
      generated.push({
        identifier: ACTING,
        contactId: contactId(n),
        relationship,
        aliasesList: n % 7 === 0 ? [] : [`${String.fromCharCode(97 + (n % 26))}contact${n}.dash`, ...(n % 5 === 0 ? ['extra.dash'] : [])],
        incomingCreatedAt: relationship === DashPayContactRelationship.Outgoing ? null : at,
        outgoingCreatedAt: relationship === DashPayContactRelationship.Incoming ? null : at,
        paymentChannelBroken: false,
      })
    }
  }
  generated.push({ ...generated[0], identifier: OTHER, contactId: contactId(999) })
  return generated
}

const identity: IdentityApiDto = {
  identityIndex: 0,
  identifier: ACTING,
  alias: 'owl11.dash',
  aliasesList: ['owl11.dash'],
  keys: [],
  balance: { amount: 250_660_000_000n, usdAmount: '0' },
  derivationPath: "m/9'/1'/5'/0'/0'",
  assetLockTxid: null,
}

const readiness: DashPayReadinessInfo = {
  readiness: DashPayReadiness.Ready,
  canSend: true,
  canRegister: true,
  missingKeys: [],
}

function render(props: Partial<ContactsTabProps> = {}): string {
  contacts.list = generateContacts()
  return renderToStaticMarkup(
    <ThemeProvider initialTheme={'light'}>
      <MemoryRouter>
        <ContactsTab
          walletId={'338e9f47'}
          identity={identity}
          identities={[identity]}
          readiness={readiness}
          now={NOW}
          segment={ContactSegment.All}
          onSegmentChange={() => {}}
          query={''}
          onQueryChange={() => {}}
          sort={ContactSort.Recent}
          onSortChange={() => {}}
          visibleCount={DASHPAY_CONTACTS_PAGE_SIZE}
          onShowMore={() => {}}
          onOpenContact={() => {}}
          {...props}
        />
      </MemoryRouter>
    </ThemeProvider>
  ).replace(/<!-- -->/g, '')
}

function count(markup: string, pattern: RegExp): number {
  return markup.match(pattern)?.length ?? 0
}

function occurrences(markup: string, needle: string): number {
  return markup.split(needle).length - 1
}

function groupLabels(markup: string): string[] {
  return Array.from(markup.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g), match => match[1])
}

describe('contacts list windowing at scale', () => {
  it('reveals 50 of 214 rows grouped Requests then Contacts', () => {
    const markup = render()
    expect(count(markup, /<li /g)).toBe(50)
    expect(occurrences(markup, `class="${ROW_OPEN_OVERLAY_CLASS}"`)).toBe(50)
    expect(markup).toContain('Show more · 164')
    expect(groupLabels(markup)).toEqual(['Requests · 12', 'Contacts · 186'])
  })

  it('labels the segments with counts for the acting identity only', () => {
    const markup = render()
    for (const label of ['All · 214', 'Contacts · 186', 'Requests · 12', 'Sent · 16']) expect(markup).toContain(label)
  })

  it('reveals the next page and reaches the Sent group', () => {
    const second = render({ visibleCount: 100 })
    expect(count(second, /<li /g)).toBe(100)
    expect(second).toContain('Show more · 114')
    const last = render({ visibleCount: 250 })
    expect(count(last, /<li /g)).toBe(214)
    expect(last).not.toContain('Show more')
    expect(groupLabels(last)).toEqual(['Requests · 12', 'Contacts · 186', 'Sent · 16'])
  })

  it('filters by segment without group labels', () => {
    const markup = render({ segment: ContactSegment.Requests })
    expect(count(markup, /<li /g)).toBe(12)
    expect(groupLabels(markup)).toEqual([])
    expect(markup).not.toContain('Show more')
  })

  it('groups by letter with unnamed contacts last when sorted by name', () => {
    const labels = groupLabels(render({ sort: ContactSort.Name, visibleCount: 250 }))
    expect(labels[0]).toMatch(/^A · \d+$/)
    expect(labels[labels.length - 1]).toMatch(/^No username · \d+$/)
  })

  it('keeps the row overlay empty so actions never nest inside it', () => {
    expect(occurrences(render(), `class="${ROW_OPEN_OVERLAY_CLASS}"></button>`)).toBe(50)
  })

  it('names the identity when the search matches nothing', () => {
    const markup = render({ query: 'xyxy' })
    expect(markup).toContain('No contacts match &quot;xyxy&quot; for owl11.dash')
    expect(count(markup, /<li /g)).toBe(0)
  })
})
