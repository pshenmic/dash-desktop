import { Button, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { TransferPageType } from "@renderer/constants";
import { davToDash } from "@renderer/utils/balance";
import { toast } from "@renderer/components/ui/Toast";

interface AmountSummaryProps {
  data: TransferPageType['amountSummary']
  amountDuffs: bigint
  amountFiat?: string
  canProceed: boolean
}

export default function AmountSummary({data, amountDuffs, amountFiat, canProceed}: AmountSummaryProps): React.JSX.Element {
  const handleNext = (): void => {
    toast.error('**Sending is not available yet** Transaction signing & broadcast are coming in a follow-up.')
  }

  return (
    <div className={"px-12"}>
    <div className={"flex flex-col gap-[.75rem]"}>
      <div className={"flex flex-col gap-[.75rem] p-[.75rem] rounded-[.9375rem] dash-card-base shadow-[0_0_35px_0_rgba(0,0,0,0.1)]"}>
        <div className={"flex justify-between items-center"}>
          <Text size={12} weight={"medium"} color={"default"} opacity={50}>{data.totalAmount}:</Text>
          <Text size={14} weight={"extrabold"} color={"default"}>{davToDash(amountDuffs)} Dash</Text>
        </div>
        {amountFiat && (
          <div className={"flex justify-between items-center"}>
            <Text size={12} weight={"medium"} color={"default"} opacity={50}>≈ Fiat:</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>{amountFiat}</Text>
          </div>
        )}
      </div>
      <Button
        className={"w-full rounded-[.9375rem]"}
        size={"md"}
        disabled={!canProceed}
        onClick={handleNext}
      >
        {data.button}
      </Button>
    </div>
  </div>
  )
}
