export type ToastVariant = 'error' | 'success' | 'warning'

export interface ToastItem {
  id: number
  variant: ToastVariant
  text: string
}
