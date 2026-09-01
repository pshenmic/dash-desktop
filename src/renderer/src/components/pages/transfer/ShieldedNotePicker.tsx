import { Text, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import Checkbox from "@renderer/components/ui/Checkbox";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import { ShieldedNoteInfo } from "@renderer/api/types";

// TEST ONLY, to be reverted.
interface ShieldedNotePickerProps {
  notes: ShieldedNoteInfo[]
  picked: number[]
  onToggle: (index: number, checked: boolean) => void
  onClear: () => void
  maxNotes: number
}

export default function ShieldedNotePicker({notes, picked, onToggle, onClear, maxNotes}: ShieldedNotePickerProps): React.JSX.Element {
  const chosen = new Set(picked)
  const full = picked.length >= maxNotes
  const total = notes
    .filter(note => chosen.has(note.index))
    .reduce((sum, note) => sum + note.amount, 0n)

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          Picked {picked.length}/{maxNotes} notes (test)
        </Text>
        <div className={"flex items-center gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"}>
            <CreditsAmount credits={total} />
          </Text>
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
        {notes.length === 0 && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"p-[.625rem]"}>
            No spendable notes — sync on the Shielded page
          </Text>
        )}
        {notes.map(note => {
          const isPicked = chosen.has(note.index)

          return (
            <div
              key={note.index}
              className={`flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] ${isPicked ? 'dash-block-accent-5' : ''} ${!isPicked && full ? 'opacity-40' : ''}`}
            >
              <Checkbox
                checked={isPicked}
                // The cap is the bundle's action limit, not a preference: an
                // unpicked row goes inert rather than swapping out a pick.
                onChange={next => (isPicked || !full) && onToggle(note.index, next)}
                label={
                  <div className={"flex items-center gap-2.5"}>
                    <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
                    <div className={"flex flex-col items-start"}>
                      <Text reset size={12} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>
                        note #{note.index}
                      </Text>
                      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                        <CreditsAmount credits={note.amount} /> · {note.address.slice(0, 14)}…
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
        Picked notes are spent whole and override the address above. A bundle
        fits {maxNotes} actions, and every note spent takes one of them.
      </Text>
    </div>
  )
}
