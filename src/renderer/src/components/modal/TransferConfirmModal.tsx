import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import { useTheme } from 'dash-ui-kit/react'
import { PlatformSendResult } from '@renderer/api/types'
import Spinner from '@renderer/components/ui/Spinner'
import HashField from '@renderer/components/ui/HashField'

export interface TransferConfirmRow {
  label: string
  value: string
  mono?: boolean
}

interface TransferConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  successTitle: string
  rows: TransferConfirmRow[]
  run: (password: string) => Promise<PlatformSendResult>
  onSuccess: () => void
}

type Phase = 'confirm' | 'sending' | 'done'

export default function TransferConfirmModal({
  isOpen,
  onClose,
  title,
  successTitle,
  rows,
  run,
  onSuccess,
}: TransferConfirmModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PlatformSendResult | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPhase('confirm')
      setError(null)
      setResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const sending = phase === 'sending'

  const handleConfirm = async (): Promise<void> => {
    if (password.length === 0 || sending) return
    setPhase('sending')
    setError(null)
    try {
      const res = await run(password)
      setResult(res)
      setPhase('done')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed')
      setPhase('confirm')
    }
  }

  const requestClose = (): void => {
    if (sending) return
    onClose()
  }

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
      onClick={requestClose}
    >
      <div
        className={"w-full max-w-140 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            {phase === 'done' ? successTitle : title}
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer disabled:opacity-30 disabled:cursor-default"}
            onClick={requestClose}
            disabled={sending}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        {phase !== 'done' ? (
          <div className={"phase-fade-in"} key={"confirm"}>
            <div className={"mt-4 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              {rows.map(row => (
                <div key={row.label} className={"flex justify-between items-center gap-4"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{row.label}</Text>
                  <Text size={12} weight={row.mono ? "medium" : "extrabold"} color={"brand"} className={`min-w-0 break-all text-right ${row.mono ? 'font-mono' : ''}`}>
                    {row.value}
                  </Text>
                </div>
              ))}
            </div>

            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
              Enter your wallet password to sign and broadcast.
            </Text>
            <div className={"mt-2"}>
              <Input
                id={"transfer-confirm-password"}
                type={"password"}
                placeholder={"Wallet password"}
                value={password}
                variant={"outlined"}
                onChange={(e) => { setError(null); setPassword(e.target.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
                className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                colorScheme={error ? 'error' : 'primary'}
                disabled={sending}
                autoFocus
              />
            </div>
            <div
              className={`
                overflow-hidden transition-all duration-200
                ${error ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0'}
              `}
            >
              <Text size={12} weight={"medium"} color={"red"}>{error}</Text>
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button
                type={"button"}
                onClick={requestClose}
                variant={"solid"}
                colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                type={"button"}
                onClick={handleConfirm}
                disabled={password.length === 0 || sending}
                variant={"solid"}
                colorScheme={"lightBlue-mint"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem] gap-2"}
              >
                {sending && <Spinner size={16} />}
                {sending ? 'Sending…' : 'Confirm & Send'}
              </Button>
            </div>
          </div>
        ) : (
          <div className={"phase-fade-in"} key={"done"}>
            <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
              <div className={"success-pop"}>
                <SuccessIcon size={56} />
              </div>
              <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>
                {result ? `${result.amountCredits} credits` : ''}
              </Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                Broadcast to Platform. It will confirm shortly.
              </Text>
            </div>

            <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>From</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{result?.fromAddress}</Text>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{result?.toAddress}</Text>
              </div>
              {result?.feeCredits && (
                <div className={"flex justify-between items-center gap-4"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee</Text>
                  <Text size={12} weight={"medium"} color={"brand"}>{result.feeCredits} credits</Text>
                </div>
              )}
              {result?.stHash && <HashField hash={result.stHash} />}
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button
                type={"button"}
                onClick={onClose}
                variant={"solid"}
                colorScheme={"lightBlue-mint"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
