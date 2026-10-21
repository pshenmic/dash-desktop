import { Text } from '../dash-ui-kit-enxtended'
import { ExclamationIcon } from '../dash-ui-kit-enxtended/icons'
import Modal from '../ui/Modal'
import ModalActions from '../ui/ModalActions'
import { ModalSize } from '@renderer/enums/ModalSize'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import type { DismissAssetLockFundingModalProps } from '@renderer/types/DismissAssetLockFundingModal'

export default function DismissAssetLockFundingModal({
  isOpen,
  busy,
  onClose,
  onConfirm,
}: DismissAssetLockFundingModalProps): React.JSX.Element {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={"Dismiss pending funding?"}
      description={"Only dismiss if the funds already arrived."}
      size={ModalSize.Md}
      dismissible={!busy}
    >
      <div className={"mt-4 flex items-start gap-2 p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10"}>
        <ExclamationIcon size={16} className={"text-dash-orange shrink-0 mt-0.5"} />
        <Text size={12} weight={"medium"} className={"leading-[140%] text-dash-orange!"}>
          {"This clears the pending record only. It won't cancel or refund the L1 transaction, and the funding can't be resumed afterwards."}
        </Text>
      </div>

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
