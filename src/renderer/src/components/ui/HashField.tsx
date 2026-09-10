import { useState } from 'react'
import { Text, CheckIcon, ExternalLinkIcon } from '../dash-ui-kit-enxtended'
import { CopyIcon2 } from '../dash-ui-kit-enxtended/icons'
import { openExternal } from '@renderer/utils/explorer'

export default function HashField({ hash, label = 'State transition hash', explorerUrl }: { hash: string; label?: string; explorerUrl?: string | null }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = (): void => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

  return (
    <div className={"flex flex-col gap-[.375rem]"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{label}</Text>
      <div className={"flex items-center gap-2"}>
        <button
          type={"button"}
          onClick={copy}
          title={copied ? 'Copied' : 'Click to copy'}
          className={`
            flex flex-1 min-w-0 h-9 items-center text-left px-3 rounded-[.75rem]
            dash-block-accent-5 dash-black-border cursor-pointer
            hover:dash-block-accent-10 transition-colors duration-200
          `}
        >
          <Text size={12} weight={"medium"} color={"brand"} className={"block font-mono text-[0.6875rem]! truncate select-all leading-[140%]"}>
            {hash}
          </Text>
        </button>
        <button
          type={"button"}
          onClick={copy}
          title={copied ? 'Copied' : 'Copy'}
          className={"size-9 shrink-0 rounded-[.75rem] flex items-center justify-center dash-block-5 dash-black-border cursor-pointer hover:opacity-80 transition-all duration-200"}
        >
          {copied
            ? <CheckIcon size={16} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
            : <CopyIcon2 size={16} color={"currentColor"} className={"dash-text-default opacity-60"} />}
        </button>
        {explorerUrl && (
          <button
            type={"button"}
            onClick={() => openExternal(explorerUrl)}
            title={"View on explorer"}
            className={"size-9 shrink-0 rounded-[.75rem] flex items-center justify-center dash-block-5 dash-black-border cursor-pointer hover:opacity-80 transition-opacity duration-200"}
          >
            <ExternalLinkIcon size={16} color={"currentColor"} className={"dash-text-default opacity-60"} />
          </button>
        )}
      </div>
    </div>
  )
}
