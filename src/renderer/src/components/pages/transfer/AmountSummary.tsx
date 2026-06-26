import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { TransferPageType } from "@renderer/constants";
import { davToDash } from "@renderer/utils/balance";
import SyncGateNotice from "@renderer/components/ui/SyncGateNotice";

interface AmountSummaryProps {
  data: TransferPageType['amountSummary']
  amountDuffs: bigint
  amountFiat?: string
  canProceed: boolean
  blocked?: boolean
  onSubmit: () => void
}

export default function AmountSummary({data, amountDuffs, amountFiat, canProceed, blocked = false, onSubmit}: AmountSummaryProps): React.JSX.Element {
  return (
    <div className={"px-12"}>
    <div className={"flex flex-col gap-[.75rem]"}>
      <div className={"flex flex-col gap-[.75rem] p-[.75rem] rounded-[.9375rem] dash-card-base shadow-[0_0_35px_0_rgba(0,0,0,0.1)]"}>
        <div className={"flex justify-between items-center"}>
          <Text size={12} weight={"medium"} color={"default"} opacity={50}>{data.totalAmount}</Text>
          <Text size={14} weight={"extrabold"} color={"default"}>{davToDash(amountDuffs)} Dash</Text>
        </div>
        {amountFiat && (
          <div className={"flex justify-between items-center"}>
            <Text size={12} weight={"medium"} color={"default"} opacity={50}>≈ Fiat:</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>{amountFiat}</Text>
          </div>
        )}
      </div>
      {blocked && <SyncGateNotice />}
      <Button
        className={"w-full rounded-[.9375rem]"}
        size={"md"}
        disabled={!canProceed || blocked}
        onClick={onSubmit}
      >
        {data.button}
      </Button>
    </div>
  </div>
  )
}
