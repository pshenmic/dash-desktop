import { useId, useState } from 'react'
import { Text, SuccessIcon } from '../dash-ui-kit-extended'
import { ExclamationIcon } from '../dash-ui-kit-extended/icons'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SignedActionDoneTone } from '@renderer/enums/SignedActionDoneTone'
import { SignedActionPhase } from '@renderer/enums/SignedActionPhase'
import { getErrorMessage } from '@renderer/utils/error'
import Alert from '@renderer/components/ui/Alert'
import HashField from '@renderer/components/ui/HashField'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'
import PendingRow from '@renderer/components/ui/PendingRow'
import { toast } from '@renderer/components/ui/Toast'
import type {
  SignedActionControls,
  SignedActionFailureView,
  SignedActionModalProps,
  SignedActionResult,
} from '@renderer/types/SignedActionModal'
import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { PREVIEW_DONE_NOTE } from '@renderer/constants/masternodePreview'
import { SIGNED_ACTION_COPY, SIGNED_ACTION_PARTIAL_ICON_CLASS } from '@renderer/constants/signedActionModal'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'

export default function SignedActionModal<R>({
  open,
  onClose,
  title,
  description,
  contextLine,
  edit,
  summary,
  shortfall,
  confirmLabel,
  confirmDisabled = false,
  pendingLabel,
  run,
  renderDone,
  classifyFailure,
  onDone,
  size = ModalSize.Lg,
  previewNote = false,
}: SignedActionModalProps<R>): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const passwordId = useId()
  const firstPhase = edit ? SignedActionPhase.Edit : SignedActionPhase.Confirm
  const [phase, setPhase] = useState<SignedActionPhase>(firstPhase)
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<SignedActionResult<R> | null>(null)
  const [failure, setFailure] = useState<SignedActionFailureView | null>(null)
  const [seenOpen, setSeenOpen] = useState(false)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setPhase(firstPhase)
      setPassword('')
      setPasswordInvalid(false)
      setVerifying(false)
      setResult(null)
      setFailure(null)
    }
  }

  const busy = verifying || phase === SignedActionPhase.Sending
  const blocked = confirmDisabled || Boolean(shortfall)

  const requestClose = (): void => {
    if (busy) return
    onClose()
  }

  const finish = (): void => {
    if (result) onDone?.(result.value)
    onClose()
  }

  const toConfirm = (): void => {
    setPassword('')
    setPasswordInvalid(false)
    setFailure(null)
    setResult(null)
    setPhase(SignedActionPhase.Confirm)
  }

  const toEdit = (): void => {
    setPassword('')
    setPasswordInvalid(false)
    setPhase(SignedActionPhase.Edit)
  }

  const controls: SignedActionControls = { restart: toConfirm, close: finish }

  const fail = (error: unknown): void => {
    toast.error(`**${title} ${SIGNED_ACTION_COPY.failed}** ${getErrorMessage(error)}`)
  }

  const submit = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || blocked) return
    setVerifying(true)
    setPasswordInvalid(false)
    let valid: boolean
    try {
      valid = await API.verifyWalletPassword(walletId, password)
    } catch (e) {
      console.error(`${title} failed`, e)
      fail(e)
      setVerifying(false)
      return
    }
    setVerifying(false)
    if (!valid) {
      setPasswordInvalid(true)
      return
    }
    const secret = password
    setPassword('')
    setPhase(SignedActionPhase.Sending)
    try {
      const value = await run(secret)
      setResult({ value })
      setPhase(SignedActionPhase.Done)
    } catch (e) {
      console.error(`${title} failed`, e)
      const view = classifyFailure ? await classifyFailure(e).catch(() => null) : null
      if (view) {
        setFailure(view)
        setPhase(SignedActionPhase.Failed)
        return
      }
      fail(e)
      setPhase(SignedActionPhase.Confirm)
    }
  }

  let body: React.JSX.Element | null = null
  if (phase === SignedActionPhase.Edit && edit) {
    body = (
      <>
        {edit.content}
        <ModalActions
          secondary={{ label: SIGNED_ACTION_COPY.cancel, onClick: requestClose }}
          primary={{ label: edit.continueLabel, onClick: () => setPhase(SignedActionPhase.Confirm), disabled: !edit.canContinue }}
        />
      </>
    )
  } else if (phase === SignedActionPhase.Confirm) {
    body = (
      <>
        {contextLine && (
          <Text reset as={"div"} size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-4 flex items-center gap-2"}>
            {contextLine}
          </Text>
        )}
        <div className={"mt-4"}>{summary}</div>
        {shortfall && <div className={"mt-2"}>{shortfall}</div>}
        <PasswordField
          id={passwordId}
          value={password}
          onChange={(value) => { setPasswordInvalid(false); setPassword(value) }}
          onSubmit={submit}
          error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
          disabled={verifying}
          className={"mt-5"}
        />
        <ModalActions
          secondary={edit
            ? { label: SIGNED_ACTION_COPY.back, onClick: toEdit, disabled: verifying }
            : { label: SIGNED_ACTION_COPY.cancel, onClick: requestClose, disabled: verifying }}
          primary={{
            label: confirmLabel,
            onClick: submit,
            disabled: password.length === 0 || blocked,
            loading: verifying,
          }}
        />
      </>
    )
  } else if (phase === SignedActionPhase.Sending) {
    body = <PendingRow label={pendingLabel} className={"mt-4"} />
  } else if (phase === SignedActionPhase.Failed && failure) {
    body = (
      <>
        <Alert
          tone={AlertTone.Warning}
          icon={<ExclamationIcon size={16} color={"currentColor"} />}
          title={failure.title}
          description={failure.description}
          className={"mt-4"}
        />
        <ModalActions
          secondary={{ label: SIGNED_ACTION_COPY.close, onClick: onClose }}
          primary={{ label: failure.retryLabel, onClick: toConfirm }}
        />
      </>
    )
  } else if (phase === SignedActionPhase.Done && result) {
    const view = renderDone(result.value, controls)
    const details = view.details ?? []
    body = (
      <>
        <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
          {view.tone === SignedActionDoneTone.Partial ? (
            <div className={SIGNED_ACTION_PARTIAL_ICON_CLASS}>
              <ExclamationIcon size={24} color={"currentColor"} />
            </div>
          ) : (
            <div className={"success-pop"}>
              <SuccessIcon size={56} />
            </div>
          )}
          <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3 max-w-full wrap-anywhere"}>{view.headline}</Text>
          {view.note && (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1 max-w-full wrap-anywhere"}>
              {view.note}
            </Text>
          )}
        </div>

        {(details.length > 0 || view.hash) && (
          <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
            {details.map(detail => (
              <div key={detail.label} className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>{detail.label}</Text>
                <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all text-right"}>{detail.value}</Text>
              </div>
            ))}
            {view.hash && <HashField hash={view.hash.value} label={view.hash.label} explorerUrl={view.hash.explorerUrl} />}
          </div>
        )}

        {view.body}

        {previewNote && (
          <Text reset as={"p"} size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-4 text-center"}>
            {PREVIEW_DONE_NOTE}
          </Text>
        )}

        <ModalActions primary={{ label: SIGNED_ACTION_COPY.done, onClick: finish }} secondary={view.secondary} />
      </>
    )
  }

  const settled = phase === SignedActionPhase.Done || phase === SignedActionPhase.Failed

  return (
    <Modal
      open={open}
      onClose={phase === SignedActionPhase.Done ? finish : requestClose}
      title={title}
      description={settled ? undefined : description}
      size={size}
      dismissible={!busy}
    >
      <div className={"phase-fade-in"} key={phase}>
        {body}
      </div>
    </Modal>
  )
}
