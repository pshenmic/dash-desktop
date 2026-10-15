import { Avatar, Dialog, ValueCard } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import Badge from '@renderer/components/dash-ui-kit-enxtended/badge'
import NoResults from '@renderer/components/ui/NoResults'
import { DEMO_BADGE_COLORS, DEMO_MODAL_CLASS_NAME, DEMO_NOTICE_CLASS_NAMES } from '@renderer/constants/dashpayDemo'
import type { DemoAvatarProps, DemoBadgeProps, DemoCardProps, DemoEmptyProps, DemoModalProps, DemoNoticeProps } from '@renderer/types/dashpayDemo'

export function DemoBadge({ children, tone = 'neutral' }: DemoBadgeProps): React.JSX.Element {
  return <Badge {...DEMO_BADGE_COLORS[tone]} variant="flat" size="xs" className="shrink-0">{children}</Badge>
}

export function DemoCard({ children, className = '' }: DemoCardProps): React.JSX.Element {
  return <ValueCard as="section" size="xl" border={false} colorScheme="transparent" className={`flex-col items-stretch! !bg-dash-control-background dark:!bg-white/4 rounded-[1.25rem]! p-5! ${className}`}>{children}</ValueCard>
}

export function DemoAvatar({ label, large = false }: DemoAvatarProps): React.JSX.Element {
  return <Avatar username={label} aria-hidden="true" className={`shrink-0 rounded-full ${large ? 'size-16' : 'size-11'}`} />
}

export function DemoEmptyState({ title, description, action }: DemoEmptyProps): React.JSX.Element {
  return <NoResults title={title} noResults={description} action={action} />
}

export function DemoNotice({ children, tone = 'blue' }: DemoNoticeProps): React.JSX.Element {
  return <ValueCard size="sm" colorScheme="transparent" border={false} className={`block! w-full rounded-[.875rem]! !px-4 !py-3 ${DEMO_NOTICE_CLASS_NAMES[tone]}`}><Text reset as="div" size={12} color={tone === 'red' ? 'red' : 'brand'} className="leading-relaxed">{children}</Text></ValueCard>
}

export function DemoModal({ title, description, children, onClose, wide = false }: DemoModalProps): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={title} maxWidth={wide ? '2xl' : 'lg'} horizontalMargin={16}
      className={DEMO_MODAL_CLASS_NAME}>
      {description && <Text reset as="p" size={12} color="brand" opacity={50} className="leading-relaxed">{description}</Text>}
      <div className="mt-5">{children}</div>
    </Dialog>
  )
}
