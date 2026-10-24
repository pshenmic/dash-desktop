import type { EmphasizedCopy, PageHeaderSubtitle } from '../types/PageHeader'

export function isEmphasizedCopy(subtitle: PageHeaderSubtitle): subtitle is EmphasizedCopy {
  return typeof subtitle === 'object' && subtitle !== null && 'emphasis' in subtitle
}
