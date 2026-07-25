import { Text } from "@renderer/components/dash-ui-kit-enxtended";

const SLIDER_STOPS = [0, 25, 50, 75, 100]
const THUMB_SIZE_PX = 16

function trackOffset(percent: number): string {
  return `calc(${THUMB_SIZE_PX / 2}px + (100% - ${THUMB_SIZE_PX}px) * ${percent} / 100)`
}

interface AmountSliderProps {
  percent: number
  onPercentChange: (percent: number) => void
  disabled?: boolean
}

export default function AmountSlider({percent, onPercentChange, disabled = false}: AmountSliderProps): React.JSX.Element {
  return (
    <div className={`mt-3 px-1 flex flex-col gap-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className={"relative h-4 flex items-center"}>
        <div className={"absolute h-1.5 rounded-full bg-dash-primary-dark-blue/10 dark:bg-white/10"} style={{left: THUMB_SIZE_PX / 2, right: THUMB_SIZE_PX / 2}} />
        <div className={"absolute h-1.5 rounded-full bg-dash-brand dark:bg-dash-mint"} style={{left: THUMB_SIZE_PX / 2, width: `calc((100% - ${THUMB_SIZE_PX}px) * ${percent} / 100)`}} />
        {SLIDER_STOPS.map(stop => (
          <div
            key={stop}
            className={`absolute size-1.5 rounded-full -translate-x-1/2 ${stop <= percent ? 'bg-white/70' : 'bg-dash-primary-dark-blue/25 dark:bg-white/30'}`}
            style={{left: trackOffset(stop)}}
          />
        ))}
        <input
          type={"range"}
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={e => onPercentChange(Number(e.target.value))}
          disabled={disabled}
          className={"absolute inset-x-0 h-4 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-dash-primary-dark-blue/20 [&::-webkit-slider-thumb]:shadow-sm"}
        />
      </div>
      <div className={"flex justify-between"}>
        {SLIDER_STOPS.map(stop => (
          <button
            key={stop}
            type={"button"}
            onClick={() => onPercentChange(stop)}
            disabled={disabled}
            className={"cursor-pointer disabled:cursor-not-allowed"}
          >
            <Text size={10} weight={"medium"} color={percent === stop ? "blue-mint" : "brand"} opacity={percent === stop ? 100 : 40}>{stop}%</Text>
          </button>
        ))}
      </div>
    </div>
  )
}
