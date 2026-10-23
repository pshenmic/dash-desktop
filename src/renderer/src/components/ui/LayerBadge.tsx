import type { LayerBadgeProps } from '@renderer/types/LayerBadge'

export default function LayerBadge({ layer }: LayerBadgeProps): React.JSX.Element {
  return (
    <span className="size-6 shrink-0 rounded-full flex items-center justify-center bg-dash-brand/10 dark:bg-dash-mint/5 text-dash-brand dark:text-dash-mint text-xs font-bold">
      {layer}
    </span>
  )
}
