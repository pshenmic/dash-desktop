import { useRef } from 'react'
import QRCode from 'react-qr-code'
import { useTheme } from 'dash-ui-kit/react'
import { Button } from '@renderer/components/dash-ui-kit-enxtended'
import { toast } from '@renderer/components/ui/Toast'
import { RECEIVE_QR_ACTION, RECEIVE_QR_FRAME, RECEIVE_QR_OVERLAY } from '@renderer/constants/receiveCard'
import { RECEIVE_INVOICE_FILE_NAME, RECEIVE_INVOICE_MIME, RECEIVE_QR_COPY, RECEIVE_QR_SIZE } from '@renderer/constants/receiveInvoice'
import type { ReceiveQrProps } from '@renderer/types/ReceiveInvoice'
import { drawReceiveInvoice, receiveInvoicePng, receiveInvoiceQr } from '@renderer/utils/receiveInvoiceImage'

export default function ReceiveQr({value, invoice}: ReceiveQrProps): React.JSX.Element {
  const { theme } = useTheme()
  const container = useRef<HTMLDivElement>(null)

  const copyImage = async (): Promise<void> => {
    try {
      const png = receiveInvoicePng(drawReceiveInvoice(invoice, receiveInvoiceQr(container.current)))
      await navigator.clipboard.write([new ClipboardItem({[RECEIVE_INVOICE_MIME]: png})])
      toast.success(RECEIVE_QR_COPY.copied)
    } catch {
      toast.error(RECEIVE_QR_COPY.copyFailed)
    }
  }

  const saveImage = (): void => {
    const link = document.createElement('a')
    link.href = drawReceiveInvoice(invoice, receiveInvoiceQr(container.current)).toDataURL(RECEIVE_INVOICE_MIME)
    link.download = RECEIVE_INVOICE_FILE_NAME
    link.click()
  }

  return (
    <div ref={container} className={RECEIVE_QR_FRAME}>
      <QRCode
        value={value}
        size={RECEIVE_QR_SIZE}
        fgColor={theme === 'dark' ? 'white' : 'var(--color-dash-brand)'}
        bgColor={'transparent'}
        className={'rounded-[.5625rem]'}
      />
      <div className={RECEIVE_QR_OVERLAY}>
        <Button type={'button'} onClick={copyImage} variant={'solid'} colorScheme={'primary'} size={'compact'} className={RECEIVE_QR_ACTION}>
          {RECEIVE_QR_COPY.copyImage}
        </Button>
        <Button type={'button'} onClick={saveImage} variant={'solid'} colorScheme={'lightBlue-mint'} size={'compact'} className={RECEIVE_QR_ACTION}>
          {RECEIVE_QR_COPY.saveImage}
        </Button>
      </div>
    </div>
  )
}
