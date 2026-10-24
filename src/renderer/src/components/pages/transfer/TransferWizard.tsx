import { Fragment, useState } from "react";
import { Button, Text, CheckIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { ProgressStepBar } from "@renderer/components/dash-ui-kit-enxtended/progressStepBar";
import { TRANSFER_WIZARD_CTA_CLASS, TRANSFER_WIZARD_LABELS } from "@renderer/constants/transferWizard";
import type { TransferWizardProps } from "@renderer/types/TransferWizard";

export default function TransferWizard({steps, onSubmit, submitLabel = TRANSFER_WIZARD_LABELS.submit, submitDisabled = false, onStepChange}: TransferWizardProps): React.JSX.Element {
  const [current, setCurrent] = useState(0)
  const step = steps[current]
  const isLast = current === steps.length - 1

  const goTo = (index: number): void => {
    setCurrent(index)
    onStepChange?.(index)
  }

  return (
    <div className={"flex-1 min-h-0 flex"}>
      <div className={"w-full min-w-0 flex flex-col"}>
        <ol className={"flex items-center"}>
          {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            return (
              <Fragment key={s.label}>
                <li className={"flex shrink-0 items-center gap-2"} aria-current={active ? 'step' : undefined}>
                  <span className={`size-9 shrink-0 rounded-full border flex items-center justify-center ${active || done ? 'border-dash-brand dark:border-dash-mint bg-dash-brand/5 dark:bg-dash-mint/5' : 'border-dash-primary-dark-blue/15 dark:border-white/15'}`}>
                    {done
                      ? <CheckIcon size={14} color={"currentColor"} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                      : <Text size={14} weight={"medium"} color={active ? 'blue-mint' : 'brand'} opacity={active ? 100 : 50}>{i + 1}</Text>}
                  </span>
                  <Text size={14} weight={active ? 'extrabold' : 'medium'} color={active || done ? 'blue-mint' : 'brand'} opacity={active || done ? 100 : 50} className={"whitespace-nowrap"}>{s.label}</Text>
                </li>
                {i < steps.length - 1 && <li aria-hidden={"true"} className={"h-px flex-1 mx-3 bg-dash-primary-dark-blue/10 dark:bg-white/10"} />}
              </Fragment>
            )
          })}
        </ol>

        <div className={"mt-14 flex flex-col gap-4"}>
          {step.content}
        </div>

        <div className={"mt-auto pt-8 flex gap-2"}>
          {current > 0 && (
            <Button
              type={"button"}
              onClick={() => goTo(current - 1)}
              variant={"outline"}
              colorScheme={"primary-light"}
              size={"md"}
              className={TRANSFER_WIZARD_CTA_CLASS}
            >
              {TRANSFER_WIZARD_LABELS.back}
            </Button>
          )}
          {isLast ? (
            <Button type={"button"} onClick={onSubmit} disabled={submitDisabled} size={"md"} colorScheme={"lightBlue-mint"} className={TRANSFER_WIZARD_CTA_CLASS}>
              {submitLabel}
            </Button>
          ) : (
            <Button type={"button"} onClick={() => goTo(current + 1)} disabled={step.canAdvance === false} size={"md"} colorScheme={"lightBlue-mint"} className={TRANSFER_WIZARD_CTA_CLASS}>
              {TRANSFER_WIZARD_LABELS.continue}
            </Button>
          )}
        </div>
        <ProgressStepBar currentStep={current + 1} totalSteps={steps.length} color={"blue-mint"} className={"mt-3"} />
      </div>
    </div>
  )
}
