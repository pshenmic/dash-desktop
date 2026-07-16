import { Text } from "../dash-ui-kit-enxtended";
import CustomBadge from "./CustomBadge";

export default function AmountSummary(
  {total, textBadge, date, variant = 'default', currency = 'Dash'}:
  {total: string | React.ReactNode, textBadge: string, date?: React.ReactNode, variant?: 'default' | 'error' | 'muted', currency?: string}): React.JSX.Element
{
  return (
    <div className={"ml-auto flex flex-col items-end"}>
      <div className={"flex items-center gap-[.5rem]"}>
        <Text size={14} weight={"bold"} color={"default"}>{total} <span className={"font-medium"}>{currency}</span></Text>
        <CustomBadge text={textBadge} variant={variant} />
      </div>
      { date &&
        <Text size={10} weight={"medium"} color={"default"} opacity={50}>{date}</Text>
      }
    </div>
  )
}
