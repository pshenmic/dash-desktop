import { useEffect, useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { utxosPage } from '@renderer/constants'

type UtxoLabelCellProps = {
  label: string | null
  onSave: (label: string | null) => void
}

export default function UtxoLabelCell({ label, onSave }: UtxoLabelCellProps): React.JSX.Element {
  const { noLabel, labelPlaceholder, labelEditTitle } = utxosPage
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label ?? '')

  useEffect(() => {
    setDraft(label ?? '')
  }, [label])

  const commit = (): void => {
    setEditing(false)
    const trimmed = draft.trim()
    setDraft(trimmed)
    if (trimmed !== (label ?? '')) onSave(trimmed === '' ? null : trimmed)
  }

  const cancel = (): void => {
    setDraft(label ?? '')
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      cancel()
    }
  }

  return (
    <span onClick={(e) => e.stopPropagation()} className={"min-w-0"}>
      {editing ? (
        <input
          type={"text"}
          value={draft}
          autoFocus
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          placeholder={labelPlaceholder}
          className={"w-full bg-transparent outline-none text-[.75rem] font-medium dash-text-default placeholder:opacity-30"}
        />
      ) : (
        <button
          type={"button"}
          onClick={() => setEditing(true)}
          title={labelEditTitle}
          className={"w-full text-left cursor-text"}
        >
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"block truncate"}>
            {label ?? noLabel}
          </Text>
        </button>
      )}
    </span>
  )
}
