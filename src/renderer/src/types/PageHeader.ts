import type { ReactNode } from 'react'

export interface EmphasizedCopy {
  lead?: string
  emphasis: string
  tail?: string
}

export type PageHeaderSubtitle = ReactNode | EmphasizedCopy

interface PageHeaderBaseProps {
  title: ReactNode
  subtitle?: PageHeaderSubtitle
  titleAddon?: ReactNode
  actions?: ReactNode
  actionsFooter?: ReactNode
  icon?: ReactNode
  id?: string
  className?: string
}

interface MainPageHeaderProps extends PageHeaderBaseProps {
  onBack?: never
  backLabel?: never
}

interface SubPageHeaderProps extends PageHeaderBaseProps {
  onBack: () => void
  backLabel: string
}

export type PageHeaderProps = MainPageHeaderProps | SubPageHeaderProps
