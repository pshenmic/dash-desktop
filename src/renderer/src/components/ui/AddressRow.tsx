import { HighlightedIdentifier, Text, ExternalLinkIcon, PlusIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import QrButton from '@renderer/components/ui/QrButton'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import {
  ADDRESS_ROW_EXPLORER_LABEL,
  ADDRESS_ROW_FIAT_CLASS,
  ADDRESS_ROW_ICON_BUTTON_CLASS,
  ADDRESS_ROW_IDENTIFIER_CLASS,
} from '@renderer/constants/addressRow'
import { WALLET_ADDRESSES_COPY } from '@renderer/constants/addressBook'
import { SURFACE_ROW } from '@renderer/constants/surfaces'
import { useFiat } from '@renderer/hooks/useFiat'
import type { AddressRowProps } from '@renderer/types/AddressRow'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { openExternal } from '@renderer/utils/explorer'

export default function AddressRow({
  address,
  amount,
  fiatDuffs = null,
  leading,
  meta,
  explorerUrl,
  onQr,
  savedName,
  onSave,
  hidden = false,
}: AddressRowProps): React.JSX.Element {
  const { format: formatFiat, rateReady } = useFiat()

  return (
    <div className={`flex items-center justify-between gap-4 ${SURFACE_ROW}`}>
      <div className={"flex min-w-0 items-center gap-2"}>
        {leading}
        <div className={"flex min-w-0 flex-col gap-1"}>
          <div className={"flex min-w-0 items-center gap-[.3125rem]"}>
            <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{address}</HighlightedIdentifier>
            <CopyButton text={address} className={"shrink-0"} />
            {onQr && <QrButton onClick={onQr} className={"shrink-0"} />}
            {explorerUrl && (
              <button
                type={"button"}
                onClick={() => openExternal(explorerUrl)}
                title={ADDRESS_ROW_EXPLORER_LABEL}
                aria-label={ADDRESS_ROW_EXPLORER_LABEL}
                className={ADDRESS_ROW_ICON_BUTTON_CLASS}
              >
                <ExternalLinkIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
              </button>
            )}
            {onSave && savedName == null && (
              <button
                type={"button"}
                onClick={onSave}
                title={WALLET_ADDRESSES_COPY.save}
                aria-label={WALLET_ADDRESSES_COPY.save}
                className={ADDRESS_ROW_ICON_BUTTON_CLASS}
              >
                <PlusIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
              </button>
            )}
          </div>
          {(meta != null || savedName != null) && (
            <div className={"flex min-w-0 flex-wrap items-center gap-[.3125rem]"}>
              {meta}
              {savedName != null && (
                <span title={WALLET_ADDRESSES_COPY.saved} className={"inline-flex"}>
                  <CustomBadge variant={"accent"} text={savedName} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className={"flex shrink-0 items-center gap-2"}>
        <SensitiveValue hidden={hidden} size={"card"}>
          <Text size={14} weight={"medium"} color={"brand"}>{amount}</Text>
          {fiatDuffs !== null && rateReady && (
            <span className={ADDRESS_ROW_FIAT_CLASS}>{formatApproxFiat(formatFiat(fiatDuffs))}</span>
          )}
        </SensitiveValue>
      </div>
    </div>
  )
}
