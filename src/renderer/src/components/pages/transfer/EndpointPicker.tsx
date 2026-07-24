import { useRef, useState } from "react";
import { Text, CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon, DashLogo } from "dash-ui-kit/react";
import { PlatformAddressDto } from "@renderer/api/types";
import { IdentityApiDto } from "@renderer/hooks/useIdentities";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import { SOURCE_KINDS } from "@renderer/utils/transferMatrix";
import { SourceKind } from "@renderer/enums/SourceKind";
import { DestinationKind } from "@renderer/enums/DestinationKind";
import PlatformAddressSelect from "./PlatformAddressSelect";

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"
const inputBox = "dash-input-block rounded-[.875rem] px-4 py-3.5"

function KindIcon({kind}: {kind: string}): React.JSX.Element {
  if (kind === SourceKind.Core || kind === DestinationKind.CoreAddress) return <DashLogo size={16} />
  if (kind === SourceKind.Shielded) return <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
  return <CreditsIcon size={16} />
}

interface KindDropdownProps {
  kinds: Array<{kind: string; label: string}>
  selected: string
  onSelect: (kind: string) => void
}

function KindDropdown({kinds, selected, onSelect}: KindDropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  const selectedLabel = kinds.find(k => k.kind === selected)?.label ?? selected

  return (
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        onClick={() => setOpen(v => !v)}
        className={`w-full ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        <div className={"flex items-center gap-2.5"}>
          <KindIcon kind={selected} />
          <Text size={14} weight={"medium"} color={"brand"}>{selectedLabel}</Text>
        </div>
        <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={"absolute left-0 right-0 top-[calc(100%+.375rem)] z-30 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)]"}>
          {kinds.map(k => (
            <button
              key={k.kind}
              type={"button"}
              onClick={() => { onSelect(k.kind); setOpen(false) }}
              className={`
                w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${k.kind === selected ? 'dash-block-accent-5' : ''}
              `}
            >
              <KindIcon kind={k.kind} />
              <Text size={14} weight={"medium"} color={"brand"}>{k.label}</Text>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface IdentitySelectProps {
  identities: IdentityApiDto[]
  selected: IdentityApiDto | undefined
  onSelect: (identifier: string) => void
}

function IdentitySelect({identities, selected, onSelect}: IdentitySelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        onClick={() => identities.length > 0 && setOpen(v => !v)}
        className={`w-full ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        {selected ? (
          <div className={"flex flex-col items-start min-w-0"}>
            <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>
              {selected.alias ?? selected.identifier}
            </Text>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
              <CreditsAmount credits={BigInt(String(selected.balance.amount))} />
            </Text>
          </div>
        ) : (
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No funded identities in this wallet</Text>
        )}
        <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={"absolute left-0 right-0 top-[calc(100%+.375rem)] z-20 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
          {identities.map(identity => (
            <button
              key={identity.identifier}
              type={"button"}
              onClick={() => { onSelect(identity.identifier); setOpen(false) }}
              className={`
                w-full flex flex-col gap-0.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${identity.identifier === selected?.identifier ? 'dash-block-accent-5' : ''}
              `}
            >
              <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>
                {identity.alias ?? identity.identifier}
              </Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                <CreditsAmount credits={BigInt(String(identity.balance.amount))} />
              </Text>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SourcePickerProps {
  kind: SourceKind
  onKindChange: (kind: SourceKind) => void
  platformAddresses: PlatformAddressDto[]
  selectedPlatformAddress: PlatformAddressDto | undefined
  onPlatformAddressChange: (address: string) => void
  identities: IdentityApiDto[]
  selectedIdentity: IdentityApiDto | undefined
  onIdentityChange: (identifier: string) => void
}

export function SourcePicker({
  kind,
  onKindChange,
  platformAddresses,
  selectedPlatformAddress,
  onPlatformAddressChange,
  identities,
  selectedIdentity,
  onIdentityChange,
}: SourcePickerProps): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-2"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From</Text>
      <KindDropdown kinds={SOURCE_KINDS} selected={kind} onSelect={k => onKindChange(k as SourceKind)} />
      {kind === SourceKind.PlatformAddress && (
        <PlatformAddressSelect
          addresses={platformAddresses}
          selected={selectedPlatformAddress}
          onSelect={onPlatformAddressChange}
        />
      )}
      {kind === SourceKind.Identity && (
        <IdentitySelect identities={identities} selected={selectedIdentity} onSelect={onIdentityChange} />
      )}
    </div>
  )
}

interface DestinationPickerProps {
  kind: DestinationKind
  kinds: Array<{kind: string; label: string}>
  onKindChange: (kind: DestinationKind) => void
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  error: string | null
  showValueInput: boolean
}

export function DestinationPicker({
  kind,
  kinds,
  onKindChange,
  value,
  onValueChange,
  placeholder,
  error,
  showValueInput,
}: DestinationPickerProps): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-2"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
      <KindDropdown kinds={kinds} selected={kind} onSelect={k => onKindChange(k as DestinationKind)} />
      {showValueInput && kind !== DestinationKind.NewIdentity && (
        <>
          <div className={`${inputBox} ${error ? 'outline outline-1 outline-dash-red' : ''}`}>
            <input
              type={"text"}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onValueChange(e.target.value)}
              className={"w-full bg-transparent outline-none text-[.875rem] font-mono dash-text-default placeholder:opacity-30"}
              placeholder={placeholder}
            />
          </div>
          {error && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{error}</Text>}
        </>
      )}
      {showValueInput && kind === DestinationKind.NewIdentity && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
          A new identity with a standard key set will be registered and funded from the selected address.
        </Text>
      )}
    </div>
  )
}
