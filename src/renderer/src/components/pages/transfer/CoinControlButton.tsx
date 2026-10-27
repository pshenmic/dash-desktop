import { Text } from "@renderer/components/dash-ui-kit-extended";
import { CoinControlListIcon } from "@renderer/components/dash-ui-kit-extended/icons";
import { PAGE_HEADERS } from "@renderer/constants/pageHeaders";
import type { CoinControlButtonProps } from "@renderer/types/CoinControlButton";

export default function CoinControlButton({label = PAGE_HEADERS.coinControl.title, summary, onClick}: CoinControlButtonProps): React.JSX.Element {
  return (
    <button
      type={"button"}
      onClick={onClick}
      className={"w-full min-h-13 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl dash-block hover:dash-block-accent-10 transition-colors cursor-pointer"}
    >
      <span className={"flex items-center gap-2.5"}>
        <CoinControlListIcon aria-hidden={"true"} className={"shrink-0 dash-text-default"} />
        <Text size={14} weight={"medium"} color={"brand"}>{label}</Text>
      </span>
      <Text size={14} weight={"medium"} color={"blue-mint"} className={"text-right"}>{summary}</Text>
    </button>
  )
}
