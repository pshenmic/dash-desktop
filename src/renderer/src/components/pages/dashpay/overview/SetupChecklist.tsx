import { Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import { CheckIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import {
  OVERVIEW_COPY,
  SETUP_ICON_CLASS,
  SETUP_STEP_ICONS,
  SETUP_STEP_TITLES,
} from '@renderer/constants/dashPayOverview'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { DashPaySetupStep, OverviewAction, SetupStepState } from '@renderer/enums/DashPay'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { SetupStepModel } from '@renderer/types/DashPay'
import type { SetupChecklistProps, SetupStepActionProps } from '@renderer/types/DashPayOverview'
import { completedSetupSteps } from '@renderer/utils/dashPayOverview'
import { setupSteps } from '@renderer/utils/dashPayReadiness'

function ChipButton({ label, disabled = false, tooltip, onClick }: SetupStepActionProps): React.JSX.Element {
  return (
    <Tooltip label={tooltip}>
      <span className={'inline-flex shrink-0'}>
        <button type={'button'} disabled={disabled} onClick={onClick} className={`${CHIP_ACTION} whitespace-nowrap font-medium disabled:opacity-50 disabled:cursor-not-allowed`}>{label}</button>
      </span>
    </Tooltip>
  )
}

export default function SetupChecklist({
  identity,
  readiness,
  canSwitch,
  onAction,
  onTopUp,
  onSwitchIdentity,
}: SetupChecklistProps): React.JSX.Element {
  const steps = setupSteps(identity, readiness)
  const ready = <StatusPill tone={StatusPillTone.Success}>{OVERVIEW_COPY.stepReady}</StatusPill>

  const trailing = (step: SetupStepModel): React.ReactNode => {
    if (identity == null || readiness == null) {
      return step.step === DashPaySetupStep.Identity
        ? <ChipButton label={OVERVIEW_COPY.create} onClick={() => onAction(OverviewAction.CreateIdentity)} />
        : null
    }
    if (step.step === DashPaySetupStep.Identity) {
      if (step.state === SetupStepState.Warning) {
        return (
          <span className={'flex shrink-0 items-center gap-2'}>
            <StatusPill tone={StatusPillTone.Warning}>{OVERVIEW_COPY.noCredits}</StatusPill>
            <ChipButton label={OVERVIEW_COPY.topUp} onClick={onTopUp} />
          </span>
        )
      }
      return canSwitch ? <ChipButton label={OVERVIEW_COPY.switchIdentity} onClick={onSwitchIdentity} /> : ready
    }
    if (step.state === SetupStepState.Done) return ready
    if (step.step === DashPaySetupStep.Username) {
      return (
        <ChipButton
          label={OVERVIEW_COPY.register}
          disabled={!readiness.canRegister}
          tooltip={readiness.canRegister ? undefined : OVERVIEW_COPY.registerNeedsKey}
          onClick={() => onAction(OverviewAction.RegisterUsername)}
        />
      )
    }
    return <ChipButton label={OVERVIEW_COPY.enable} onClick={() => onAction(OverviewAction.EnableDashPay)} />
  }

  return (
    <section className={`flex flex-col ${SURFACE_SECTION}`} aria-label={OVERVIEW_COPY.yourSetup}>
      <header className={'flex min-h-[1.875rem] items-center justify-between gap-3'}>
        <DashboardHeading as={'h3'}>{OVERVIEW_COPY.yourSetup}</DashboardHeading>
        <CustomBadge variant={'muted'} text={`${completedSetupSteps(steps)} ${OVERVIEW_COPY.of} ${steps.length}`} />
      </header>
      <ol className={'mt-1 flex flex-col'}>
        {steps.map(step => {
          const Icon = SETUP_STEP_ICONS[step.step]
          const pending = identity == null && step.step !== DashPaySetupStep.Identity
          return (
            <li key={step.step} className={`flex items-center gap-3 py-2.5 border-t border-dash-primary-dark-blue/8 dark:border-white/8 first:border-t-0 ${pending ? 'opacity-50' : ''}`}>
              <span className={SETUP_ICON_CLASS[step.state]}>
                {step.state === SetupStepState.Done
                  ? <CheckIcon size={14} color={'currentColor'} className={'[&_circle]:hidden'} />
                  : <Icon size={14} color={'currentColor'} className={step.state === SetupStepState.Todo ? 'opacity-50' : ''} />}
              </span>
              <span className={'flex min-w-0 flex-1 flex-col gap-0.5'}>
                <Text reset size={12} weight={'bold'} color={'brand'}>{SETUP_STEP_TITLES[step.step]}</Text>
                <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'wrap-anywhere'}>{step.caption}</Text>
              </span>
              {trailing(step)}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
