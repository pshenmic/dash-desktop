import { TransferChevronDownIcon } from "@renderer/components/dash-ui-kit-enxtended/icons";
import { useElementSize } from "@renderer/hooks/useElementSize";
import { TRANSFER_CARD_GEOMETRY } from "@renderer/constants/transferCards";
import { transferFromCardPath, transferToBorderPath, transferToCardPath, transferToMaskStyle } from "@renderer/utils/transferCardPath";
import type { TransferRouteCardsProps } from "@renderer/types/TransferRouteCards";

export default function TransferRouteCards({from, to}: TransferRouteCardsProps): React.JSX.Element {
  const [fromRef, fromSize] = useElementSize<HTMLDivElement>()
  const [toRef, toSize] = useElementSize<HTMLDivElement>()
  const fromHeight = fromSize.height + TRANSFER_CARD_GEOMETRY.notchDepth

  return (
    <div className={"flex flex-col"}>
      <div ref={fromRef} className={"relative z-10 px-4.5 pt-6 pb-5.5"}>
        {fromSize.width > 0 && <>
          <svg aria-hidden={"true"} width={fromSize.width} height={fromHeight} viewBox={`0 0 ${fromSize.width} ${fromHeight}`} className={"pointer-events-none absolute left-0 top-0 overflow-visible text-white dark:text-white/5"}>
            <path fill={"currentColor"} d={transferFromCardPath(fromSize)} />
          </svg>
          <svg aria-hidden={"true"} width={fromSize.width} height={fromHeight} viewBox={`0 0 ${fromSize.width} ${fromHeight}`} fill={"none"} className={"pointer-events-none absolute left-0 top-0 overflow-visible text-dash-primary-dark-blue/8 dark:text-white/8 [mask-image:linear-gradient(to_bottom,black,transparent_45%,black)]"}>
            <path stroke={"currentColor"} strokeWidth={1} d={transferFromCardPath(fromSize, TRANSFER_CARD_GEOMETRY.strokeInset)} />
          </svg>
        </>}
        <span aria-hidden={"true"} className={"pointer-events-none absolute left-1/2 top-full flex size-6 -translate-x-1/2 -translate-y-2 flex-col items-center justify-center gap-1 dash-text-default"}>
          <TransferChevronDownIcon className={"shrink-0 opacity-75"} />
          <TransferChevronDownIcon className={"shrink-0"} />
        </span>
        <div className={"relative"}>{from}</div>
      </div>
      <div ref={toRef} className={"relative px-4.5 pt-6.5 pb-6"}>
        {toSize.width > 0 && <>
          <svg aria-hidden={"true"} width={toSize.width} height={toSize.height} viewBox={`0 0 ${toSize.width} ${toSize.height}`} style={transferToMaskStyle()} className={"pointer-events-none absolute left-0 top-0 overflow-visible text-white dark:text-white/5"}>
            <path fill={"currentColor"} d={transferToCardPath(toSize)} />
          </svg>
          <svg aria-hidden={"true"} width={toSize.width} height={toSize.height} viewBox={`0 0 ${toSize.width} ${toSize.height}`} fill={"none"} className={"pointer-events-none absolute left-0 top-0 overflow-visible text-dash-primary-dark-blue/8 dark:text-white/8 [mask-image:linear-gradient(to_bottom,transparent,black)]"}>
            <path stroke={"currentColor"} strokeWidth={1} d={transferToBorderPath(toSize, TRANSFER_CARD_GEOMETRY.strokeInset)} />
          </svg>
        </>}
        <div className={"relative"}>{to}</div>
      </div>
    </div>
  )
}
