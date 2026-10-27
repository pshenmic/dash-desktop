import { useId, useLayoutEffect, useRef, useState } from 'react'
import { COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS, COIN_CONTROL_AUTOMATIC_CHIP, COIN_CONTROL_AUTOMATIC_RAYS_PATH } from '@renderer/constants/coinControl'
import type { CoinControlAutomaticIllustrationProps } from '@renderer/types/CoinControl'

export default function CoinControlAutomaticIllustration({showAddresses, children}: CoinControlAutomaticIllustrationProps): React.JSX.Element {
  const addressesRef = useRef<SVGSVGElement>(null)
  const raysRef = useRef<SVGSVGElement>(null)
  const maskId = useId()
  const [maskTransform, setMaskTransform] = useState<string | null>(null)
  const chip = COIN_CONTROL_AUTOMATIC_CHIP
  const iconY = (chip.height - chip.iconSize) / 2
  const placements = showAddresses ? COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS : []

  useLayoutEffect(() => {
    const addresses = addressesRef.current
    const rays = raysRef.current
    const container = addresses?.parentElement
    if (addresses == null || rays == null || container == null) return

    const updateMask = (): void => {
      const addressesMatrix = addresses.getScreenCTM()
      const raysMatrix = rays.getScreenCTM()
      if (addressesMatrix == null || raysMatrix == null) return
      if (raysMatrix.a * raysMatrix.d - raysMatrix.b * raysMatrix.c === 0) return
      const matrix = raysMatrix.inverse().multiply(addressesMatrix)
      setMaskTransform(`matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`)
    }

    updateMask()
    const observer = new ResizeObserver(updateMask)
    observer.observe(container)
    for (const child of Array.from(container.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <svg ref={addressesRef} aria-hidden={'true'} viewBox={'0 0 640 200'} className={'absolute inset-x-0 top-4 z-10 w-full dash-text-default pointer-events-none'} fill={'none'}>
        <g fill={'currentColor'}>
          {placements.map(({x, y, width, rotation}, index) => {
            const qrX = width - chip.paddingEnd - chip.iconSize
            const copyX = qrX - chip.iconGap - chip.iconSize
            return (
              <g key={index} transform={`rotate(${rotation} ${x} ${y}) translate(${x} ${y})`}>
                <rect width={width} height={chip.height} rx={chip.radius} fillOpacity={chip.fillOpacity} />
                <path d={chip.arrowPath} fill={'none'} stroke={'currentColor'} strokeOpacity={chip.glyphOpacity} strokeWidth={chip.strokeWidth} strokeLinecap={'round'} strokeLinejoin={'round'} />
                <rect
                  x={chip.textX}
                  y={(chip.height - chip.lineHeight) / 2}
                  width={copyX - chip.iconGap - chip.textX - chip.lineInset}
                  height={chip.lineHeight}
                  rx={chip.lineHeight / 2}
                  fillOpacity={chip.lineOpacity}
                />
                <g transform={`translate(${copyX} ${iconY})`}>
                  <rect width={chip.iconSize} height={chip.iconSize} rx={chip.iconRadius} fillOpacity={chip.iconOpacity} />
                  <path d={chip.copyGlyphPath} fill={'none'} stroke={'currentColor'} strokeOpacity={chip.glyphOpacity} strokeWidth={chip.strokeWidth} />
                </g>
                <g transform={`translate(${qrX} ${iconY})`}>
                  <rect width={chip.iconSize} height={chip.iconSize} rx={chip.iconRadius} fillOpacity={chip.iconOpacity} />
                  <path d={chip.qrGlyphPath} fillOpacity={chip.glyphOpacity} />
                </g>
              </g>
            )
          })}
        </g>
      </svg>
      <div className={'relative flex size-25 items-center justify-center rounded-full border border-dash-brand/10 dark:border-dash-mint/10'}>
        <svg ref={raysRef} aria-hidden={'true'} viewBox={'0 0 640 200'} className={'absolute left-1/2 top-1/2 h-50 w-160 -translate-x-1/2 -translate-y-[70%] overflow-visible text-dash-brand/10 dark:text-dash-mint/10 pointer-events-none'} fill={'none'}>
          <defs>
            <mask id={maskId} x={'-1200'} y={'-1000'} width={'3040'} height={'1200'} maskUnits={'userSpaceOnUse'}>
              <rect x={'-1200'} y={'-1000'} width={'3040'} height={'1200'} fill={'white'} />
              {maskTransform != null && (
                <g transform={maskTransform} fill={'black'}>
                  {placements.map(({x, y, width, rotation}, index) => (
                    <rect key={index} transform={`rotate(${rotation} ${x} ${y}) translate(${x} ${y})`} width={width} height={chip.height} rx={chip.radius} />
                  ))}
                </g>
              )}
            </mask>
          </defs>
          <path d={COIN_CONTROL_AUTOMATIC_RAYS_PATH} mask={maskTransform == null ? undefined : `url(#${maskId})`} stroke={'currentColor'} strokeWidth={'1'} vectorEffect={'non-scaling-stroke'} />
        </svg>
        <div className={'relative flex size-16 items-center justify-center rounded-full dash-block'}>
          <svg aria-hidden={'true'} width={'28'} height={'28'} viewBox={'0 0 28 28'} fill={'none'} className={'dash-text-default'}>
            <path d={'M4 15L8 5H20L24 15M4 15V22C4 23 5 24 6 24H22C23 24 24 23 24 22V15H18L16 18H12L10 15H4Z'} stroke={'currentColor'} strokeLinecap={'round'} strokeLinejoin={'round'} />
          </svg>
        </div>
      </div>
      <div className={'relative isolate flex flex-col items-center pb-4'}>
        <span aria-hidden={'true'} className={'absolute inset-y-0 left-1/2 -z-10 w-px -translate-x-1/2 bg-dash-brand/10 dark:bg-dash-mint/10'} />
        {children}
      </div>
    </>
  )
}
