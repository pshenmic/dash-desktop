import { useId, useLayoutEffect, useRef, useState } from 'react'
import { COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS, COIN_CONTROL_AUTOMATIC_RAYS_PATH } from '@renderer/constants/coinControl'
import type { CoinControlAutomaticIllustrationProps } from '@renderer/types/CoinControl'

export default function CoinControlAutomaticIllustration({utxos, platformAddresses}: CoinControlAutomaticIllustrationProps): React.JSX.Element {
  const addressesRef = useRef<SVGSVGElement>(null)
  const raysRef = useRef<SVGSVGElement>(null)
  const maskId = useId()
  const [maskTransform, setMaskTransform] = useState<string | null>(null)

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
      <svg ref={addressesRef} aria-hidden={'true'} viewBox={'0 0 640 200'} className={'absolute inset-x-0 top-4 z-10 w-full dash-text-default opacity-20 pointer-events-none'} fill={'none'}>
        <g fill={'currentColor'} fontSize={'6'}>
          {COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS.map(({x, y, width, rotation}, index) => (
            <g key={index} transform={`rotate(${rotation} ${x} ${y})`}>
              <rect x={x} y={y} width={width} height={'20'} rx={'8'} fillOpacity={'.15'} />
              <text x={x + 8} y={y + 13}>{utxos[index]?.address ?? platformAddresses[index]?.platformAddress}</text>
            </g>
          ))}
        </g>
      </svg>
      <div className={'relative flex size-25 items-center justify-center rounded-full border border-dash-brand/10 dark:border-dash-mint/10 mb-3'}>
        <svg ref={raysRef} aria-hidden={'true'} viewBox={'0 0 640 200'} className={'absolute left-1/2 top-1/2 h-50 w-160 -translate-x-1/2 -translate-y-[70%] overflow-visible text-dash-brand/10 dark:text-dash-mint/10 pointer-events-none'} fill={'none'}>
          <defs>
            <mask id={maskId} x={'-1200'} y={'-1000'} width={'3040'} height={'1200'} maskUnits={'userSpaceOnUse'}>
              <rect x={'-1200'} y={'-1000'} width={'3040'} height={'1200'} fill={'white'} />
              {maskTransform != null && (
                <g transform={maskTransform} fill={'black'}>
                  {COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS.map(({x, y, width, rotation}, index) => (
                    <rect key={index} transform={`rotate(${rotation} ${x} ${y})`} x={x} y={y} width={width} height={'20'} rx={'8'} />
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
    </>
  )
}
