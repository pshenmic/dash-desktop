import { Text } from "@renderer/components/dash-ui-kit-enxtended";

// TEST ONLY, to be reverted. It names addresses alone: the amount stays the one
// typed on the amount step, so the rest of the send flow is untouched.
interface PlatformRecipientsTestProps {
  addresses: string[]
  onChange: (addresses: string[]) => void
  maxRecipients: number
}

export default function PlatformRecipientsTest({addresses, onChange, maxRecipients}: PlatformRecipientsTestProps): React.JSX.Element {
  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          Extra recipients {addresses.length}/{maxRecipients} (test)
        </Text>
        <div className={"flex items-center gap-2"}>
          <button
            type={"button"}
            disabled={addresses.length >= maxRecipients}
            onClick={() => onChange([...addresses, ''])}
            className={"px-2.5 py-1 rounded-[.5rem] dash-block-accent-5 hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-30"}
          >
            <Text size={12} weight={"medium"} color={"blue-mint"}>Add</Text>
          </button>
          {addresses.length > 0 && (
            <button
              type={"button"}
              onClick={() => onChange([])}
              className={"px-2.5 py-1 rounded-[.5rem] dash-block-accent-5 hover:opacity-80 transition-opacity cursor-pointer"}
            >
              <Text size={12} weight={"medium"} color={"blue-mint"}>Clear</Text>
            </button>
          )}
        </div>
      </div>

      {addresses.map((address, index) => (
        <div key={index} className={"dash-block rounded-[.75rem] px-3 py-2.5 flex items-center gap-3"}>
          <input
            value={address}
            onChange={e => onChange(addresses.map((entry, i) => (i === index ? e.target.value : entry)))}
            placeholder={"Platform address"}
            className={"flex-1 min-w-0 bg-transparent outline-none dash-text-default placeholder:opacity-30 text-[.8125rem] font-mono"}
          />
          <button
            type={"button"}
            onClick={() => onChange(addresses.filter((_, i) => i !== index))}
            className={"shrink-0 cursor-pointer hover:opacity-70 transition-opacity"}
          >
            <Text size={12} weight={"medium"} color={"red"}>Remove</Text>
          </button>
        </div>
      ))}

      {addresses.length > 0 && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          The amount you type is split evenly between the recipient above and
          these, with any remainder going to the first.
        </Text>
      )}
    </div>
  )
}
