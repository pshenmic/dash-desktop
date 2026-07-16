import { useState } from 'react'
import { Text, CheckIcon } from '../dash-ui-kit-enxtended'
import { CopyIcon2 } from '../dash-ui-kit-enxtended/icons'

export default function HashField({ hash, label = 'State transition hash' }: { hash: string; label?: string }): React.JSX.Element {
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
      <button
        onClick={copy}
        title={"Click to copy"}
        className={`
          group text-left px-3 py-2.5 rounded-[.75rem]
          dash-block-accent-5 dash-black-border cursor-pointer
          hover:dash-block-accent-10 transition-colors duration-200
        `}
      >
        <Text size={12} weight={"medium"} color={"brand"} className={"font-mono break-all select-all leading-[140%]"}>
          {hash}
        </Text>
      </button>
      <button onClick={copy} className={"self-start cursor-pointer flex items-center gap-1"}>
        {copied
          ? <CheckIcon size={12} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
          : <CopyIcon2 size={12} color={"currentColor"} className={"dash-text-default opacity-60"} />}
        <Text size={10} weight={"medium"} color={copied ? 'blue-mint' : 'brand'} opacity={copied ? 100 : 40} className={"transition-colors duration-200"}>
          {copied ? 'Copied to clipboard' : 'Click the hash to copy'}
        </Text>
      </button>
    </div>
  )
}
