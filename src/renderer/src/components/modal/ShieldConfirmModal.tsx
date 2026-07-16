import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text, SuccessIcon, ShieldSmallIcon } from '../dash-ui-kit-enxtended'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import { ShieldResult } from '@renderer/api/types'
import Spinner from '@renderer/components/ui/Spinner'
import CopyableError from '@renderer/components/ui/CopyableError'
import HashField from '@renderer/components/ui/HashField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'

interface ShieldConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  fromAddress: string
  toAddress: string
  amountCredits: string
  proverReady: boolean
  onSuccess: () => void
}

type Phase = 'confirm' | 'shielding' | 'done'


export default function ShieldConfirmModal({
  isOpen,
  onClose,
  walletId,
  fromAddress,
  toAddress,
  amountCredits,
  proverReady,
  onSuccess,
}: ShieldConfirmModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShieldResult | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPhase('confirm')
      setError(null)
      setResult(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const shielding = phase === 'shielding'

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || shielding || !proverReady) return
    setPhase('shielding')
    setError(null)
    try {
      const res = await API.shieldToPool(walletId, fromAddress, toAddress, amountCredits, password)
      setResult(res)
      setPhase('done')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shield failed')
      setPhase('confirm')
    }
  }

  const requestClose = (): void => {
    if (shielding) return
    onClose()
  }

  const confirmLabel = shielding ? 'Shielding…' : !proverReady ? 'Preparing…' : 'Confirm & Shield'

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
    >
      <div
        className={"w-full max-w-140 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            {phase === 'done' ? 'Funds shielded' : 'Confirm shield'}
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer disabled:opacity-30 disabled:cursor-default"}
            onClick={requestClose}
            disabled={shielding}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        {phase !== 'done' ? (
          <div className={"phase-fade-in"} key={"confirm"}>
            <div className={"mt-4 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
                <Text size={14} weight={"extrabold"} color={"brand"}><CreditsAmount credits={BigInt(amountCredits)} align={"end"} /></Text>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>From</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{fromAddress}</Text>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To</Text>
                <div className={"flex items-center gap-1.5 min-w-0"}>
                  <ShieldSmallIcon size={14} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
                  <Text size={12} weight={"medium"} color={"blue-mint"} className={"font-mono min-w-0 break-all text-right"}>{toAddress}</Text>
                </div>
              </div>
            </div>

            {shielding ? (
              <div className={"mt-4 flex items-center gap-3 p-[.875rem] rounded-[.9375rem] dash-block"}>
                <Spinner size={18} className={"text-dash-brand dark:text-dash-mint"} />
                <div className={"flex flex-col"}>
                  <Text size={14} weight={"medium"} color={"brand"}>Generating zero-knowledge proof…</Text>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Proving then broadcasting — this can take a few seconds.</Text>
                </div>
              </div>
            ) : (
              <>
                <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
                  Enter your wallet password to prove and broadcast.
                </Text>
                <div className={"mt-2"}>
                  <Input
                    id={"shield-password"}
                    type={"password"}
                    placeholder={"Wallet password"}
                    value={password}
                    variant={"outlined"}
                    onChange={(e) => { setError(null); setPassword(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
                    className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                    colorScheme={error ? 'error' : 'primary'}
                    autoFocus
                  />
                </div>
              </>
            )}

            <div
              className={`
                overflow-hidden transition-all duration-200
                ${error ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}
              `}
            >
              <CopyableError message={error ?? ''} />
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              <Button
                type={"button"}
                onClick={requestClose}
                variant={"solid"}
                colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
                disabled={shielding}
              >
                Cancel
              </Button>
              <Button
                type={"button"}
                onClick={handleConfirm}
                disabled={password.length === 0 || shielding || !proverReady}
                variant={"solid"}
                colorScheme={"lightBlue-mint"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem] gap-2"}
              >
                {shielding && <Spinner size={16} />}
                {confirmLabel}
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
                {result && <CreditsAmount credits={BigInt(result.amountCredits)} />} shielded
              </Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                Moved into the shielded pool. If it went to your own address, re-sync notes to see it.
              </Text>
            </div>

            <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>From</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{result?.fromAddress}</Text>
              </div>
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
