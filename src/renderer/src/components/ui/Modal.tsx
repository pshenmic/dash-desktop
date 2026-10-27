import { Dialog } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { ModalSize } from '@renderer/enums/ModalSize'
import { MODAL_CLASS_NAME, MODAL_HORIZONTAL_MARGIN, MODAL_MAX_WIDTH } from '@renderer/constants/modal'
import type { ModalProps } from '@renderer/types/Modal'

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = ModalSize.Md,
  dismissible = true,
  children,
}: ModalProps): React.JSX.Element {
  return (
    <div className={"contents"} onClick={(e) => e.stopPropagation()}>
      <Dialog
        open={open}
        onOpenChange={(next) => { if (!next && dismissible) onClose() }}
        title={title}
        showCloseButton={dismissible}
        maxWidth={MODAL_MAX_WIDTH[size]}
        horizontalMargin={MODAL_HORIZONTAL_MARGIN}
        className={MODAL_CLASS_NAME}
      >
        {description && (
          <Text reset as={"p"} size={14} weight={"medium"} color={"brand"} opacity={50} className={"leading-[140%]"}>
            {description}
          </Text>
        )}
        {children}
      </Dialog>
    </div>
  )
}
