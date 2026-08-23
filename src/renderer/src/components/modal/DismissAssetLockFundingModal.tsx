import { createPortal } from 'react-dom'
import { useTheme } from 'dash-ui-kit/react'
import { Button, CrossIcon, Text } from '../dash-ui-kit-enxtended'
import { ExclamationIcon } from '../dash-ui-kit-enxtended/icons'
import Spinner from '../ui/Spinner'

export default function DismissAssetLockFundingModal({
  isOpen,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => Promise<void>
}): React.JSX.Element | null {
  const { theme } = useTheme()

  if (!isOpen) return null

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
      role={"dialog"}
      aria-modal={"true"}
      aria-labelledby={"dismiss-funding-title"}
    >
      <div className={"w-full max-w-125 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}>
        <div className={"flex items-center justify-between gap-4"}>
          <div id={"dismiss-funding-title"}>
            <Text size={24} weight={"extrabold"} color={"brand"}>
              Dismiss pending funding?
            </Text>
          </div>
          <button
            type={"button"}
            className={"dash-text-default hover:opacity-60 cursor-pointer disabled:opacity-30 disabled:cursor-default"}
            onClick={onClose}
            disabled={busy}
            aria-label={"Close"}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        <Text size={14} weight={"medium"} color={"brand"} opacity={50} className={"mt-3 block leading-[140%]"}>
          Use Dismiss only if Resume does not work and the funding completed successfully, but the wallet still shows it as pending. Before continuing, confirm that the destination balance or identity was updated.
        </Text>

        <div className={"mt-4 flex items-start gap-2 p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10"}>
          <ExclamationIcon size={16} className={"text-dash-orange shrink-0 mt-0.5"} />
          <Text size={12} weight={"medium"} className={"leading-[140%] text-dash-orange!"}>
            Dismiss only clears this wallet's local pending record. It does not cancel the L1 transaction or return locked funds. This funding will no longer be available to resume in the wallet.
          </Text>
        </div>

        {error && (
          <Text size={12} weight={"medium"} color={"red"} className={"mt-3 block"}>
            {error}
          </Text>
        )}

        <div className={"mt-4.5 flex gap-2"}>
          <Button
            type={"button"}
            onClick={onClose}
            variant={"solid"}
            colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
            size={"sm"}
            className={"flex-1 rounded-[.9375rem]"}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type={"button"}
            onClick={() => { void onConfirm() }}
            variant={"solid"}
            colorScheme={"red-strong"}
            size={"sm"}
            className={"flex-1 rounded-[.9375rem] gap-2"}
            disabled={busy}
          >
            {busy && <Spinner size={16} />}
            {busy ? 'Dismissing…' : 'Dismiss funding'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
