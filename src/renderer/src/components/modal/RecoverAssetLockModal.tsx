import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from 'dash-ui-kit/react'
import { Button, CrossIcon, Input, Text } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { AssetLockFundingKind, AssetLockFundingState, AssetLockInspection } from '@renderer/api/types'
import Spinner from '@renderer/components/ui/Spinner'
import { getErrorMessage } from '@renderer/utils/error'
import { davToDash } from '@renderer/utils/balance'
import { RECOVERY_DESTINATION_PLACEHOLDERS, RECOVERY_KIND_LABELS } from '@renderer/constants/sendPages'

export default function RecoverAssetLockModal({
  isOpen,
  walletId,
  onClose,
  onRecovered,
}: {
  isOpen: boolean
  walletId: string | null
  onClose: () => void
  onRecovered: (state: AssetLockFundingState) => void
}): React.JSX.Element | null {
  const { theme } = useTheme()
  const [txid, setTxid] = useState('')
  const [inspection, setInspection] = useState<AssetLockInspection | null>(null)
  const [kind, setKind] = useState<AssetLockFundingKind | null>(null)
  const [to, setTo] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const close = (): void => {
    if (busy) return
    setTxid('')
    setInspection(null)
    setKind(null)
    setTo('')
    setPassword('')
    setError(null)
    onClose()
  }

  const inspect = async (): Promise<void> => {
    if (!walletId || busy) return
    setBusy(true)
    setError(null)
    setInspection(null)
    try {
      const result = await API.inspectAssetLock(walletId, txid)
      setInspection(result)
      setKind(result.recorded?.kind ?? result.allowedKinds[0])
      setTo(result.recorded?.to ?? '')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const recover = async (): Promise<void> => {
    if (!walletId || inspection == null || kind == null || busy) return
    setBusy(true)
    setError(null)
    try {
      const state = await API.recoverAssetLock(walletId, inspection.txid, password,
        kind === AssetLockFundingKind.Identity ? { kind } : { kind, to })
      setBusy(false)
      onRecovered(state)
      close()
    } catch (e) {
      setError(getErrorMessage(e))
      setBusy(false)
    }
  }

  const needsDestination = kind != null && kind !== AssetLockFundingKind.Identity
  const blocked = inspection?.identityExists === true
  const canRecover = inspection != null && !blocked && password.length > 0 && (!needsDestination || to.trim().length > 0)

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
      role={"dialog"}
      aria-modal={"true"}
      aria-labelledby={"recover-asset-lock-title"}
    >
      <div className={"w-full max-w-125 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in flex flex-col gap-3"}>
        <div className={"flex items-center justify-between gap-4"}>
          <div id={"recover-asset-lock-title"}>
            <Text size={24} weight={"extrabold"} color={"brand"}>Recover asset lock</Text>
          </div>
          <button
            type={"button"}
            className={"dash-text-default hover:opacity-60 cursor-pointer disabled:opacity-30 disabled:cursor-default"}
            onClick={close}
            disabled={busy}
            aria-label={"Close"}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

        <div className={"flex gap-2"}>
          <Input
            placeholder={"Asset lock transaction id"}
            value={txid}
            onChange={(e) => { setTxid(e.target.value); setInspection(null); setError(null) }}
            disabled={busy}
          />
          <Button type={"button"} onClick={() => { void inspect() }} disabled={busy || txid.trim().length === 0} variant={"solid"} colorScheme={"lightBlue-mint"} size={"sm"} className={"rounded-[.9375rem] shrink-0"}>
            Inspect
          </Button>
        </div>

        {inspection && (
          <>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"break-all leading-[140%]"}>
              {davToDash(inspection.amountDuffs)} DASH on {inspection.address} ({inspection.derivationPath})
              {' · '}{inspection.lockStatus.chainLocked ? 'chainlocked' : inspection.lockStatus.instantLocked ? 'instant locked' : 'not locked yet'}
              {inspection.recorded && ` · recorded as ${inspection.recorded.status}`}
              {inspection.identityId && ` · identity ${inspection.identityId}${inspection.identityExists ? ' already exists' : ''}`}
            </Text>

            {inspection.allowedKinds.length > 1 && (
              <div className={"flex gap-1 dash-block p-1 rounded-xl"}>
                {inspection.allowedKinds.map(option => (
                  <button
                    key={option}
                    type={"button"}
                    aria-pressed={kind === option}
                    onClick={() => setKind(option)}
                    className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${kind === option ? 'dash-bg-inverse text-dash-brand dark:text-dash-mint' : 'dash-text-default'}`}
                  >
                    {RECOVERY_KIND_LABELS[option]}
                  </button>
                ))}
              </div>
            )}

            {needsDestination && (
              <Input
                placeholder={RECOVERY_DESTINATION_PLACEHOLDERS[kind]}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={busy}
              />
            )}

            <Input
              type={"password"}
              placeholder={"Wallet password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </>
        )}

        {error && <Text size={12} weight={"medium"} color={"red"} className={"break-all"}>{error}</Text>}

        <div className={"flex gap-2"}>
          <Button type={"button"} onClick={close} disabled={busy} variant={"solid"} colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'} size={"sm"} className={"flex-1 rounded-[.9375rem]"}>
            Cancel
          </Button>
          <Button type={"button"} onClick={() => { void recover() }} disabled={busy || !canRecover} variant={"solid"} colorScheme={"lightBlue-mint"} size={"sm"} className={"flex-1 rounded-[.9375rem] gap-2"}>
            {busy && <Spinner size={16} />}
            Recover
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
