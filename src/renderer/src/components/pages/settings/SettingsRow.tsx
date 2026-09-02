import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import type { SettingsRowProps } from '@renderer/types/Settings'

export default function SettingsRow({
  title,
  description,
  control,
  actionLabel,
  pendingLabel,
  pending = false,
  disabled = false,
  destructive = false,
  onClick,
}: SettingsRowProps): React.JSX.Element {
  return (
    <div className="flex min-h-20 items-center justify-between gap-6 border-b border-dash-primary-dark-blue/10 px-[.875rem] py-3 last:border-b-0 dark:border-white/10">
      <div className="flex min-w-0 flex-col gap-1">
        <Text size={14} weight="medium" color="brand">{title}</Text>
        {description && (
          <Text size={12} weight="normal" color="brand" opacity={50}>{description}</Text>
        )}
      </div>
      {control ?? (
        <Button
          type="button"
          onClick={onClick}
          disabled={disabled || pending}
          variant={destructive ? 'outline' : 'solid'}
          colorScheme={destructive ? 'red' : 'primary-light'}
          size="sm"
          className="min-h-0! shrink-0 rounded-[.75rem]! px-4! py-2! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dash-brand"
        >
          {pending && pendingLabel ? pendingLabel : actionLabel}
        </Button>
      )}
    </div>
  )
}
