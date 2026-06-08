import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, CrossIcon, Input, Text, SuccessIcon, CheckIcon, ExternalLinkIcon } from '../dash-ui-kit-enxtended'
import { CopyIcon2 } from '../dash-ui-kit-enxtended/icons'
import { useTheme } from 'dash-ui-kit/react'
import { API } from '@renderer/api'
import { Network, SendResult } from '@renderer/api/types'
import { davToDash } from '@renderer/utils/balance'
import { shortenAddress } from '@renderer/utils/address'
import { transactionUrl, openExternal } from '@renderer/utils/explorer'
import Spinner from '@renderer/components/ui/Spinner'

interface SendConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  network: Network | null
  toAddress: string
  amountDuffs: bigint
  amountFiat?: string
  onSuccess: () => void
}

type Phase = 'confirm' | 'sending' | 'done'

function TxidField({ txid, network }: { txid: string; network: Network | null }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = (): void => {
    navigator.clipboard.writeText(txid).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

  return (
    <div className={"flex flex-col gap-[.375rem]"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Transaction ID</Text>
      <div className={"flex items-stretch gap-2"}>
        <button
          onClick={copy}
          title={"Click to copy"}
          className={`
            group flex-1 min-w-0 text-left
            px-3 py-2.5 rounded-[.75rem]
            dash-block-accent-5 dash-black-border
            cursor-pointer
            hover:dash-block-accent-10
            transition-colors duration-200
          `}
        >
          <Text size={12} weight={"medium"} color={"brand"} className={"font-mono break-all select-all leading-[140%]"}>
            {txid}
          </Text>
        </button>
        <div className={"flex flex-col gap-2 shrink-0"}>
          <button
            onClick={copy}
            title={copied ? 'Copied' : 'Copy'}
            className={`
              size-9 rounded-[.75rem] flex items-center justify-center
              dash-block-5 dash-black-border cursor-pointer
              hover:opacity-80 transition-all duration-200
            `}
          >
            {copied
              ? <CheckIcon size={16} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
              : <CopyIcon2 size={16} color={"currentColor"} className={"dash-text-default opacity-60"} />}
          </button>
          <button
            onClick={() => network && openExternal(transactionUrl(txid, network))}
            title={"View on explorer"}
            disabled={!network}
            className={`
              size-9 rounded-[.75rem] flex items-center justify-center
              dash-block-5 dash-black-border cursor-pointer
              hover:opacity-80 transition-opacity duration-200
              disabled:opacity-40 disabled:cursor-default
            `}
          >
            <ExternalLinkIcon size={16} color={"currentColor"} className={"dash-text-default opacity-60"} />
          </button>
        </div>
      </div>
      <button
        onClick={copy}
        className={"self-start cursor-pointer"}
      >
        <Text size={10} weight={"medium"} color={copied ? 'blue-mint' : 'brand'} opacity={copied ? 100 : 40} className={"transition-colors duration-200"}>
          {copied ? 'Copied to clipboard' : 'Click the hash to copy'}
        </Text>
      </button>
    </div>
  )
}

export default function SendConfirmModal({
  isOpen,
  onClose,
  walletId,
  network,
  toAddress,
  amountDuffs,
  amountFiat,
  onSuccess,
}: SendConfirmModalProps): React.JSX.Element | null {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<Phase>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

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
    if (!walletId || password.length === 0 || sending) return
    setPhase('sending')
    setError(null)
    try {
      const res = await API.sendTransaction(walletId, toAddress, amountDuffs.toString(), password)
      setResult(res)
      setPhase('done')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
      setPhase('confirm')
    }
  }

  // Prevent closing mid-broadcast — the tx is already in flight.
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
        className={"w-full max-w-105 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={24} weight={"extrabold"} color={"brand"}>
            {phase === 'done' ? 'Transaction sent' : 'Confirm send'}
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
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
                <Text size={14} weight={"extrabold"} color={"brand"}>{davToDash(amountDuffs)} Dash</Text>
              </div>
              {amountFiat && (
                <div className={"flex justify-between items-center gap-4"}>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>≈ Fiat</Text>
                  <Text size={12} weight={"medium"} color={"blue-mint"}>{amountFiat}</Text>
                </div>
              )}
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono"}>{shortenAddress(toAddress)}</Text>
              </div>
            </div>

            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
              Enter your wallet password to sign and broadcast.
            </Text>
            <div className={"mt-2"}>
              <Input
                id={"send-password"}
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
                colorScheme={"brand-mint"}
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
                {result ? davToDash(BigInt(result.amount)) : ''} Dash sent
              </Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                Broadcast to the network. It will confirm shortly.
              </Text>
            </div>

            <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"font-mono"}>{shortenAddress(toAddress)}</Text>
              </div>
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee</Text>
                <Text size={12} weight={"medium"} color={"brand"}>{result ? davToDash(BigInt(result.fee)) : ''} Dash</Text>
              </div>
              {result?.txid && <TxidField txid={result.txid} network={network} />}
            </div>

            <div className={"mt-4.5 flex gap-2"}>
              {result?.txid && network && (
                <Button
                  type={"button"}
                  onClick={() => openExternal(transactionUrl(result.txid, network))}
                  variant={"outline"}
                  colorScheme={"primary-light"}
                  size={"md"}
                  className={"flex-1 rounded-[.9375rem] gap-2"}
                >
                  <ExternalLinkIcon size={16} color={"currentColor"} className={"dash-text-default"} />
                  View on explorer
                </Button>
              )}
              <Button
                type={"button"}
                onClick={onClose}
                variant={"solid"}
                colorScheme={"brand-mint"}
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
