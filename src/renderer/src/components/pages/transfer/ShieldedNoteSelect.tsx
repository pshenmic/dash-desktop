import { useRef, useState } from "react";
import { Text, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon } from "dash-ui-kit/react";
import { ShieldedNoteInfo } from "@renderer/api/types";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

interface ShieldedNoteSelectProps {
  notes: ShieldedNoteInfo[]
  selected: ShieldedNoteInfo | undefined
  onSelect: (index: number) => void
}

export default function ShieldedNoteSelect({notes, selected, onSelect}: ShieldedNoteSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        onClick={() => notes.length > 0 && setOpen(v => !v)}
        className={`w-full ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        {selected ? (
          <div className={"flex items-center gap-2.5 min-w-0"}>
            <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
            <div className={"flex flex-col items-start min-w-0"}>
              <Text size={14} weight={"medium"} color={"brand"} className={"text-left"}>note #{selected.index}</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                <CreditsAmount credits={BigInt(selected.amount)} />
              </Text>
            </div>
          </div>
        ) : (
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No spendable notes</Text>
        )}
        <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={"absolute left-0 right-0 top-[calc(100%+.375rem)] z-20 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
          {notes.map(note => (
            <button
              key={note.index}
              type={"button"}
              onClick={() => { onSelect(note.index); setOpen(false) }}
              className={`
                w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${note.index === selected?.index ? 'dash-block-accent-5' : ''}
              `}
            >
              <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
              <div className={"flex flex-col min-w-0"}>
                <Text size={14} weight={"medium"} color={"brand"} className={"text-left"}>note #{note.index}</Text>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  <CreditsAmount credits={BigInt(note.amount)} />
                </Text>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
