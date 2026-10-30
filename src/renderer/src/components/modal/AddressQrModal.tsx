import QRCode from "react-qr-code"
import { useTheme } from "dash-ui-kit/react"
import { Text } from "@renderer/components/dash-ui-kit-extended"
import { ModalSize } from "@renderer/enums/ModalSize"
import CopyButton from "@renderer/components/ui/CopyButton"
import Modal from "@renderer/components/ui/Modal"

type AddressQrModalProps = {
  address: string
  onClose: () => void
  title?: string
}

export default function AddressQrModal({
  address,
  onClose,
  title = 'Receive address',
}: AddressQrModalProps): React.JSX.Element {
  const { theme } = useTheme()

  const qrCodeColor = theme === 'dark' ? 'white' : 'var(--color-dash-brand)'

  return (
    <Modal open onClose={onClose} title={title} size={ModalSize.Sm}>
      <div className={"mt-5 flex items-center justify-center rounded-2xl dash-block p-5"}>
        <QRCode
          value={`dash:${address}`}
          size={208}
          fgColor={qrCodeColor}
          bgColor={"transparent"}
          className={"rounded-[.5625rem] shrink-0"}
        />
      </div>

      <div className={"mt-5 flex items-center justify-center gap-[.625rem]"}>
        <Text size={12} weight={"medium"} color={"brand"} className={"break-all text-center"}>
          {address}
        </Text>
        <CopyButton text={address} className={"shrink-0"} />
      </div>
    </Modal>
  )
}
