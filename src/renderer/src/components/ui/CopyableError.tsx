import { useState } from 'react'
import { Text } from '../dash-ui-kit-enxtended'

export default function CopyableError({ message }: { message: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = (): void => {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

  return (
    <button type={"button"} onClick={copy} title={"Click to copy"} className={"group text-left cursor-pointer flex flex-col gap-0.5"}>
      <Text size={12} weight={"medium"} color={"red"} className={"break-all leading-[130%]"}>{message}</Text>
      <Text
        size={10}
        weight={"medium"}
        color={copied ? 'blue-mint' : 'brand'}
        opacity={copied ? 100 : 40}
        className={`transition-opacity duration-200 ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >
        {copied ? 'Copied to clipboard' : 'Click to copy'}
      </Text>
    </button>
  )
}
