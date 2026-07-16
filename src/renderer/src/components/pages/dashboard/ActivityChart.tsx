import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { dashboardPage } from '@renderer/constants'
import { MonthlyActivity } from '@renderer/utils/dashboardStats'
import { davToDashCompact } from '@renderer/utils/balance'

const W = 600
const H = 160
const PAD_X = 10
const PAD_TOP = 12
const PAD_BOTTOM = 8

interface Pt {
  x: number
  y: number
}

function ratio(value: bigint, max: bigint): number {
  if (value <= 0n || max <= 0n) return 0
  return Number((value * 1000n) / max) / 1000
}

function buildPoints(months: MonthlyActivity[], max: bigint, key: 'received' | 'sent'): Pt[] {
  const innerW = W - PAD_X * 2
  const innerH = H - PAD_TOP - PAD_BOTTOM
  const step = months.length > 1 ? innerW / (months.length - 1) : 0
  return months.map((m, i) => ({
    x: Math.round((PAD_X + i * step) * 10) / 10,
    y: Math.round((PAD_TOP + (1 - ratio(m[key], max)) * innerH) * 10) / 10
  }))
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return ''
  const clampY = (y: number): number => Math.min(H - PAD_BOTTOM, Math.max(PAD_TOP, y))
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

function areaPath(pts: Pt[]): string {
  if (pts.length < 2) return ''
  const baseline = H - PAD_BOTTOM
  return `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`
}

function monthTooltip(month: MonthlyActivity, hidden: boolean): string {
  const head = `${month.label} ${month.year}`
  if (hidden) return `${head}: ${month.count} tx`
  return `${head}: +${davToDashCompact(month.received)} / -${davToDashCompact(month.sent)} DASH · ${month.count} tx`
}

function LegendDot({ accent, label }: { accent: boolean; label: string }): React.JSX.Element {
  return (
    <span className={"flex items-center gap-1.5"}>
      <span
        className={`h-[.1875rem] w-4 rounded-full ${
          accent ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-dash-primary-dark-blue/25 dark:bg-white/25'
        }`}
      />
      <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
        {label}
      </Text>
    </span>
  )
}

interface ActivityChartProps {
  months: MonthlyActivity[]
  hidden: boolean
}

export default function ActivityChart({ months, hidden }: ActivityChartProps): React.JSX.Element {
  const { title, received, sent, noActivity } = dashboardPage.activity
  const max = months.reduce((acc, m) => {
    const top = m.received > m.sent ? m.received : m.sent
    return top > acc ? top : acc
  }, 0n)

  const recvPts = buildPoints(months, max, 'received')
  const sentPts = buildPoints(months, max, 'sent')
  const lastRecv = recvPts[recvPts.length - 1]

  return (
    <div className={"flex flex-col gap-5 p-[.9375rem] rounded-3xl dash-card-base shadow-[0_0_32px_0_rgba(12,28,51,0.08)]"}>
      <div className={"flex items-center justify-between"}>
        <Text size={14} weight={"medium"} color={"brand"}>
          {title}
        </Text>
        <div className={"flex items-center gap-4"}>
          <LegendDot accent label={received} />
          <LegendDot accent={false} label={sent} />
        </div>
      </div>

      {max > 0n ? (
        <div className={"flex flex-col gap-2"}>
          <div className={"relative h-40"}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={"none"} className={"absolute inset-0 w-full h-full"}>
              <defs>
                <linearGradient id={"dash-activity-fill"} x1={"0"} y1={"0"} x2={"0"} y2={"1"}>
                  <stop offset={"0%"} stopColor={"currentColor"} stopOpacity={"0.16"} />
                  <stop offset={"100%"} stopColor={"currentColor"} stopOpacity={"0.01"} />
                </linearGradient>
              </defs>
              <g className={"text-dash-primary-dark-blue/8 dark:text-white/10"}>
                {[0.25, 0.5, 0.75].map((f) => {
                  const y = PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f
                  return (
                    <line key={f} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke={"currentColor"} strokeDasharray={"3 6"} vectorEffect={"non-scaling-stroke"} />
                  )
                })}
                <line x1={PAD_X} y1={H - PAD_BOTTOM} x2={W - PAD_X} y2={H - PAD_BOTTOM} stroke={"currentColor"} vectorEffect={"non-scaling-stroke"} />
              </g>
              <g className={"text-dash-primary-dark-blue/25 dark:text-white/25"}>
                <path d={smoothPath(sentPts)} fill={"none"} stroke={"currentColor"} strokeWidth={2} strokeLinecap={"round"} strokeDasharray={"6 6"} vectorEffect={"non-scaling-stroke"} />
              </g>
              <g className={"text-dash-brand dark:text-dash-mint"}>
                <path d={areaPath(recvPts)} fill={"url(#dash-activity-fill)"} stroke={"none"} />
                <path d={smoothPath(recvPts)} fill={"none"} stroke={"currentColor"} strokeWidth={2.5} strokeLinecap={"round"} vectorEffect={"non-scaling-stroke"} />
              </g>
            </svg>

            {lastRecv !== undefined && (
              <span
                className={"absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-dash-brand dark:bg-dash-mint shadow-[0_0_0_3px_rgba(76,126,255,0.2)] dark:shadow-[0_0_0_3px_rgba(96,246,210,0.2)]"}
                style={{ left: `${(lastRecv.x / W) * 100}%`, top: `${(lastRecv.y / H) * 100}%` }}
              />
            )}

            <div
              className={"absolute inset-0 grid"}
              style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}
            >
              {months.map((month) => (
                <div
                  key={`${month.label}-${month.year}`}
                  title={monthTooltip(month, hidden)}
                  className={"rounded-xl hover:bg-dash-primary-dark-blue/4 dark:hover:bg-white/4 transition-colors duration-200"}
                />
              ))}
            </div>
          </div>

          <div className={"grid"} style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
            {months.map((month) => (
              <Text key={`${month.label}-${month.year}`} size={10} weight={"medium"} color={"brand"} opacity={30} className={"text-center"}>
                {month.label}
              </Text>
            ))}
          </div>
        </div>
      ) : (
        <div className={"flex items-center justify-center h-44"}>
          <Text size={12} color={"brand"} opacity={40}>
            {noActivity}
          </Text>
        </div>
      )}
    </div>
  )
}
