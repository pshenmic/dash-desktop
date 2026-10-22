import { Button } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import { MODAL_ACTION_COLOR_SCHEME } from '@renderer/constants/modal'
import type { ModalActionsProps } from '@renderer/types/Modal'

export default function ModalActions({ primary, secondary, tone = ModalActionTone.Primary }: ModalActionsProps): React.JSX.Element {
  return (
    <div className={"mt-6 flex gap-2"}>
      {secondary && (
        <Button
          type={"button"}
          onClick={secondary.onClick}
          disabled={secondary.disabled}
          variant={"outline"}
          colorScheme={"primary-light"}
          size={"sm"}
          className={"flex-1 rounded-[.9375rem]"}
        >
          {secondary.label}
        </Button>
      )}
      <Button
        type={"button"}
        onClick={primary.onClick}
        disabled={primary.disabled || primary.loading}
        variant={"solid"}
        colorScheme={MODAL_ACTION_COLOR_SCHEME[tone]}
        size={"sm"}
        className={"flex-1 rounded-[.9375rem] gap-2"}
      >
        {primary.loading && <Spinner size={16} className={"text-current"} />}
        {primary.label}
      </Button>
    </div>
  )
}
