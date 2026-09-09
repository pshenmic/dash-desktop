export type ToastVariant = 'error' | 'warning'

export interface ToastItem {
  id: number
  variant: ToastVariant
  text: string
}
