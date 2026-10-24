import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ALERT_TONE_STYLES } from '@renderer/constants/alert'
import type { AlertProps } from '@renderer/types/Alert'

export default function Alert({ tone, icon, title, description, actions, className = '' }: AlertProps): React.JSX.Element {
  const styles = ALERT_TONE_STYLES[tone]

  return (
    <div role={"status"} className={`flex items-center justify-between gap-4 p-[.875rem] rounded-[.9375rem] border ${styles.surface} ${className}`}>
      <div className={"flex min-w-0 flex-col gap-[.375rem]"}>
        <div className={"flex items-center gap-2"}>
          <span className={`flex shrink-0 items-center ${styles.accent}`}>{icon}</span>
          <Text size={14} weight={"extrabold"} color={"brand"} className={styles.title}>
            {title}
          </Text>
        </div>
        {description && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            {description}
          </Text>
        )}
      </div>
      {actions && <div className={"flex shrink-0 items-center gap-2"}>{actions}</div>}
    </div>
  )
}
