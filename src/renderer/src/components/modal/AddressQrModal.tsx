import { createPortal } from "react-dom"
import QRCode from "react-qr-code"
import { useTheme } from "dash-ui-kit/react"
import { Text, CrossIcon } from "@renderer/components/dash-ui-kit-enxtended"
import CopyButton from "@renderer/components/ui/CopyButton"

type AddressQrModalProps = {
  address: string
  onClose: () => void
}

export default function AddressQrModal({
  address,
  onClose,
}: AddressQrModalProps): React.JSX.Element {
  const { theme } = useTheme()

  const qrCodeColor = theme === 'dark' ? 'white' : 'var(--color-dash-brand)'

  return createPortal(
    <div
      className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center overlay-fade-in"}
      onClick={onClose}
    >
      <div
        className={"w-full max-w-86 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem] modal-fade-in"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={"flex items-center justify-between"}>
          <Text size={20} weight={"extrabold"} color={"brand"}>
            Receive address
          </Text>
          <button
            className={"dash-text-default hover:opacity-60 cursor-pointer"}
            onClick={onClose}
          >
            <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          </button>
        </div>

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
      </div>
    </div>,
    document.body
  )
}
