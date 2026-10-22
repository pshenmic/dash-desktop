import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'dash-ui-kit/react'
import IdentitySelect, { IdentitySelectPopover } from '@renderer/components/ui/IdentitySelect'
import { POPOVER, POPOVER_OPTION } from '@renderer/constants/surfaces'
import { IdentitySelectAppearance } from '@renderer/enums/IdentitySelectAppearance'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { IdentitySelectPopoverProps, IdentitySelectProps } from '@renderer/types/IdentitySelect'

vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/hooks/useFiat', () => ({ useFiat: () => ({ rateReady: false, format: () => '' }) }))
vi.stubGlobal('React', React)

const FIELD_TRIGGER = 'class="w-full h-[3.25rem] dash-block rounded-2xl px-4 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity"'
const FIELD_POPOVER = `absolute left-0 right-0 top-[calc(100%+.375rem)] z-30 max-h-60 overflow-y-auto scrollbar-custom ${POPOVER}`
const FIELD_OPTION = `w-full flex flex-col gap-0.5 text-left ${POPOVER_OPTION} `
const CHEVRON = 'shrink-0 dash-text-default transition-transform duration-200'

function identity(index: number, names: string[] = []): IdentityApiDto {
  return {
    identityIndex: index,
    identifier: `${'B7kcE'}${String(index).padStart(34, 'x')}LCpQH`,
    alias: names[0] ?? null,
    aliasesList: names,
    keys: [],
    balance: { amount: 250_660_000_000n, usdAmount: '0' },
    derivationPath: `m/9'/1'/5'/0'/${index}'`,
    assetLockTxid: null,
  }
}

function wallet(count: number): IdentityApiDto[] {
  return Array.from({ length: count }, (_, index) => identity(index, index % 2 === 0 ? [`owl${index}.dash`] : []))
}

function render(element: React.JSX.Element): string {
  return renderToStaticMarkup(<ThemeProvider initialTheme={'light'}>{element}</ThemeProvider>).replace(/<!-- -->/g, '')
}

function select(props: Partial<IdentitySelectProps> = {}): string {
  const identities = props.identities ?? wallet(2)
  return render(
    <IdentitySelect
      identities={identities}
      loading={false}
      error={null}
      selected={identities[0]}
      onSelect={() => {}}
      onRetry={() => {}}
      {...props}
    />
  )
}

function popover(props: Partial<IdentitySelectPopoverProps> = {}): string {
  const identities = props.identities ?? wallet(2)
  return render(
    <IdentitySelectPopover
      appearance={IdentitySelectAppearance.Field}
      identities={identities}
      selected={identities[0]}
      searchable={false}
      activateSelected={false}
      onSelect={() => {}}
      onDismiss={() => {}}
      {...props}
    />
  )
}

describe('IdentitySelect field appearance', () => {
  it('keeps the Send trigger markup', () => {
    const markup = select()
    expect(markup).toContain(FIELD_TRIGGER)
    expect(markup).toContain('aria-label="Select identity"')
    expect(markup).toContain('class="flex flex-col items-start min-w-0"')
    expect(markup).toContain('break-all text-left')
    expect(markup).toContain('owl0.dash')
    expect(markup).toContain(CHEVRON)
    expect(markup).not.toContain('role="listbox"')
  })

  it('keeps the Send popover and option classes', () => {
    const markup = popover()
    expect(markup).toContain(`class="${FIELD_POPOVER} outline-none"`)
    expect(markup).toContain(`class="${FIELD_OPTION}dash-block-accent-5"`)
    expect(markup).toContain(`class="${FIELD_OPTION}"`)
    expect(markup).toContain('role="option"')
    expect(markup).not.toContain('type="search"')
  })

  it('offers a reload instead of a list while identities fail to load', () => {
    const markup = select({ error: 'Failed to load identities', identities: [], selected: undefined })
    expect(markup).toContain('aria-label="Reload identities"')
    expect(markup).not.toContain(CHEVRON)
  })
})

describe('IdentitySelect header appearance', () => {
  it('renders a static trigger for a single identity', () => {
    const only = [identity(0, ['owl11.dash'])]
    const markup = select({ appearance: IdentitySelectAppearance.Header, identities: only, selected: only[0] })
    expect(markup).not.toContain('<button')
    expect(markup).not.toContain(CHEVRON)
    expect(markup).toContain('owl11.dash')
  })

  it('renders a skeleton while loading', () => {
    const markup = select({ appearance: IdentitySelectAppearance.Header, loading: true })
    expect(markup).not.toContain('<button')
    expect(markup).toContain('animate-pulse')
  })

  it('truncates the primary name and counts the other names compactly', () => {
    const longLabel = `${'a'.repeat(63)}.dash`
    const names = [longLabel, ...Array.from({ length: 20 }, (_, index) => `name${index}.dash`)]
    const identities = [identity(0, names), identity(1)]
    const markup = select({ appearance: IdentitySelectAppearance.Header, identities, selected: identities[0] })
    expect(markup).toContain('min-w-0 truncate')
    expect(markup).toContain('+20')
    expect(markup).not.toContain('name19.dash')
  })

  it('names the acting identity and flags requests elsewhere', () => {
    const identities = wallet(3)
    const markup = select({ appearance: IdentitySelectAppearance.Header, identities, attention: true })
    expect(markup).toContain('aria-label="Acting identity: owl0.dash. Change identity. Other identities have requests"')
    expect(markup).toContain('bg-dash-orange')
    expect(markup).toContain('aria-haspopup="listbox"')
  })

  it('shows the readiness meta on the trigger', () => {
    const markup = select({ appearance: IdentitySelectAppearance.Header, renderTriggerMeta: () => <span>Ready</span> })
    expect(markup).toContain(' · <span>Ready</span>')
  })
})

describe('IdentitySelect popover search', () => {
  it('appears from six identities when searchable', () => {
    const markup = popover({ appearance: IdentitySelectAppearance.Header, identities: wallet(6), searchable: true })
    expect(markup).toContain('type="search"')
    expect(markup).toContain('Act as · 6')
  })

  it('stays hidden below six identities', () => {
    expect(popover({ appearance: IdentitySelectAppearance.Header, identities: wallet(5), searchable: true })).not.toContain('type="search"')
  })

  it('stays hidden when the select is not searchable', () => {
    expect(popover({ appearance: IdentitySelectAppearance.Header, identities: wallet(9) })).not.toContain('type="search"')
  })

  it('renders badges, meta and the footer', () => {
    const markup = popover({
      appearance: IdentitySelectAppearance.Header,
      identities: wallet(2),
      renderBadge: identity => <i>{`badge-${identity.identityIndex}`}</i>,
      renderMeta: identity => identity.identityIndex === 1 ? <b>2 requests</b> : null,
      footer: <a>Register new identity</a>,
    })
    expect(markup).toContain('<i>badge-0</i>')
    expect(markup).toContain('<i>badge-1</i>')
    expect(markup).toContain('Act as · 2')
    expect(markup).toContain(' · <b>2 requests</b>')
    expect(markup.match(/ · /g)).toHaveLength(2)
    expect(markup).toContain('Register new identity')
    expect(markup).toContain('aria-selected="true"')
  })

  it('marks the selected option active when opened from the keyboard', () => {
    const markup = popover({ identities: wallet(3), activateSelected: true })
    expect(markup).toContain(`class="${FIELD_OPTION}dash-block-accent-5 dash-block-accent-10"`)
    expect(markup).toMatch(/aria-activedescendant="[^"]+-option-0"/)
  })
})
