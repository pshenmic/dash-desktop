import { Text } from '../dash-ui-kit-enxtended'
import { ExclamationIcon } from '../dash-ui-kit-enxtended/icons'
import Modal from '../ui/Modal'
import ModalActions from '../ui/ModalActions'
import { ModalSize } from '@renderer/enums/ModalSize'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'

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
}): React.JSX.Element {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={"Dismiss pending funding?"}
      description={"Use Dismiss only if Resume does not work and the funding completed successfully, but the wallet still shows it as pending. Before continuing, confirm that the destination balance or identity was updated."}
      size={ModalSize.Md}
      dismissible={!busy}
    >
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

      <ModalActions
        tone={ModalActionTone.Danger}
        secondary={{ label: 'Cancel', onClick: onClose, disabled: busy }}
        primary={{
          label: busy ? 'Dismissing…' : 'Dismiss funding',
          onClick: () => { void onConfirm() },
          loading: busy,
        }}
      />
    </Modal>
  )
}
