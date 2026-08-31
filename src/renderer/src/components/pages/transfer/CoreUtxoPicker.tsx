import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { DashLogo } from "dash-ui-kit/react";
import Checkbox from "@renderer/components/ui/Checkbox";
import { SelectableUtxo } from "@renderer/api/types";
import { davToDash, davToDashCompact } from "@renderer/utils/balance";

export const outpointKey = (utxo: {txid: string; vout: number}): string => `${utxo.txid}:${utxo.vout}`

// TEST ONLY, to be reverted.
interface CoreUtxoPickerProps {
  utxos: SelectableUtxo[]
  picked: string[]
  onToggle: (key: string, checked: boolean) => void
  onClear: () => void
}

export default function CoreUtxoPicker({utxos, picked, onToggle, onClear}: CoreUtxoPickerProps): React.JSX.Element {
  const chosen = new Set(picked)
  const total = utxos
    .filter(utxo => chosen.has(outpointKey(utxo)))
    .reduce((sum, utxo) => sum + utxo.satoshis, 0n)

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          Picked {picked.length}/{utxos.length} coins (test)
        </Text>
        <div className={"flex items-center gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"}>{davToDash(total)} Dash</Text>
          {picked.length > 0 && (
            <button
              type={"button"}
              onClick={onClear}
              className={"px-2.5 py-1 rounded-[.5rem] dash-block-accent-5 hover:opacity-80 transition-opacity cursor-pointer"}
            >
              <Text size={12} weight={"medium"} color={"blue-mint"}>Clear</Text>
            </button>
          )}
        </div>
      </div>

      <div className={"dash-block rounded-[.875rem] p-[.375rem] max-h-72 overflow-y-auto scrollbar-hide flex flex-col"}>
        {utxos.length === 0 && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"p-[.625rem]"}>
            No spendable coins
          </Text>
        )}
        {utxos.map(utxo => {
          const key = outpointKey(utxo)
          const isPicked = chosen.has(key)

          return (
            <div
              key={key}
              className={`flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] ${isPicked ? 'dash-block-accent-5' : ''}`}
            >
              <Checkbox
                checked={isPicked}
                onChange={next => onToggle(key, next)}
                label={
                  <div className={"flex items-center gap-2.5"}>
                    <DashLogo size={18} className={"shrink-0"} />
                    <div className={"flex flex-col items-start"}>
                      <Text reset size={12} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>
                        {utxo.txid.slice(0, 12)}…:{utxo.vout}
                      </Text>
                      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                        {davToDashCompact(utxo.satoshis)} Dash · {utxo.address.slice(0, 10)}…
                        {utxo.height === 0 && ' · pending'}
                      </Text>
                    </div>
                  </div>
                }
              />
            </div>
          )
        })}
      </div>

      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        Picked coins are spent whole and override the address above; the fee and
        the change come out of them. Pick nothing to let the wallet choose.
      </Text>
    </div>
  )
}
