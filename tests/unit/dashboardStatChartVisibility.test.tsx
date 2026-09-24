import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import StatVolumeChart from '@renderer/components/pages/dashboard/StatVolumeChart'
import { buildStatFlows } from '@renderer/utils/dashboardStatCharts'

describe('statistics chart visibility', () => {
  it.each(['received', 'sent'] as const)('omits amounts and data-derived geometry from a hidden %s chart', direction => {
    const flows = buildStatFlows([{ amount: 123_456_789n, direction: 'in', status: 'success', date: new Date() }], [])
    const markup = renderToStaticMarkup(<StatVolumeChart flows={flows} direction={direction} hidden />)
    const empty = renderToStaticMarkup(<StatVolumeChart flows={buildStatFlows([], [])} direction={direction} hidden />)
    expect(markup).toBe(empty)
    expect(markup).toContain('Amounts hidden')
    expect(markup).not.toContain('<svg')
  })

  it('renders an empty period with a zero amount and valid chart geometry', () => {
    const markup = renderToStaticMarkup(<StatVolumeChart flows={buildStatFlows([], [])} direction="received" hidden={false} />)
    expect(markup).toContain('30d cumulative')
    expect(markup).toContain('Core total: 0 DASH')
    expect(markup).toContain('Evo total: 0 DASH')
    expect(markup).toContain('stroke="var(--stat-brand)"')
    expect(markup).toContain('stroke="var(--stat-evo)"')
    expect(markup).not.toMatch(/NaN|Infinity/)
  })

  it('labels incomplete Evo history instead of presenting it as a complete zero', () => {
    const markup = renderToStaticMarkup(<StatVolumeChart flows={buildStatFlows([], [])} direction="sent" hidden={false} platformFailed />)
    expect(markup).toContain('Evo partial')
    expect(markup).toContain('Evo history is incomplete')
  })
})
