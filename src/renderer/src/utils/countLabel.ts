import type { CountForms } from '@renderer/types/CountForms'

export function countLabel(count: number, forms: CountForms): string {
  return `${count} ${count === 1 ? forms.one : forms.other}`
}
