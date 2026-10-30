import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeProvider } from 'dash-ui-kit/react'
import TransactionsList from '@renderer/components/pages/transactions/TransactionsList'
import { DEFAULT_TX_FILTER } from '@renderer/constants/transactionFilters'
import type { TransactionGroup, WalletTxItem } from '@renderer/types/WalletTransaction'

vi.mock('@renderer/hooks/useBalanceVisibility', () => ({ useBalanceVisibility: () => ({ isBalanceVisible: true }) }))
vi.mock('@renderer/components/pages/transactions/TransactionCard', () => ({ default: ({ id }: { id: string }) => `[card:${id}]` }))
vi.mock('@renderer/components/pages/transactions/TransactionsFilter', () => ({ default: () => null }))
vi.mock('@renderer/components/ui/PartialDataNotice', () => ({ default: () => null }))
vi.stubGlobal('React', React)

function received(id: string, hour: number): WalletTxItem {
  return {
    id, status: 'success', confirmations: 6, blockHeight: 1, size: 225, kind: 'core', title: 'Receive',
    subtitleLabel: 'from', labelValue: 'Xsender', amount: 100_000_000n, usdAmount: '0.0',
    date: new Date(2026, 9, 22, hour), direction: 'in', vin: [], vout: [],
  }
}

function renderList(visibleCount: number): string {
  const groups: TransactionGroup[] = [{ date: '22.10.2026', transactions: [1, 2, 3, 4, 5].map(n => received(`tx${n}`, 20 - n)) }]
  return renderToStaticMarkup(
    <ThemeProvider initialTheme={'light'}>
      <TransactionsList
        filter={DEFAULT_TX_FILTER}
        onFilterChange={() => {}}
        onTransactionClick={() => {}}
        visibleCount={visibleCount}
        onShowMore={() => {}}
        groups={groups}
        platform={[]}
        platformFailed={false}
        loading={false}
        err={null}
      />
    </ThemeProvider>
  )
}

describe('TransactionsList window', () => {
  it('renders only the visible cards while totals cover the whole filtered list', () => {
    const markup = renderList(2)
    expect(markup.match(/\[card:/g)).toHaveLength(2)
    expect(markup).toContain('[card:tx1]')
    expect(markup).toContain('[card:tx2]')
    expect(markup).toContain('+5 Dash')
    expect(markup.replace(/<!-- -->/g, '')).toContain('Show more · 3')
  })

  it('drops the show-more control once every transaction is visible', () => {
    const markup = renderList(5)
    expect(markup.match(/\[card:/g)).toHaveLength(5)
    expect(markup).not.toContain('Show more')
  })
})
