import { toast } from '@renderer/components/ui/Toast'
import { CLIPBOARD_COPY } from '@renderer/constants/clipboard'

export function copyWithToast(text: string): void {
  void navigator.clipboard.writeText(text).then(() => toast.success(CLIPBOARD_COPY.copied))
}
