import { useState } from "react";
import { Button, Text, CheckIcon } from "@renderer/components/dash-ui-kit-enxtended";

export interface WizardStep {
  label: string
  content: React.ReactNode
  canAdvance?: boolean
}

interface TransferWizardProps {
  steps: WizardStep[]
  onSubmit: () => void
  submitLabel?: string
  submitDisabled?: boolean
}

export default function TransferWizard({steps, onSubmit, submitLabel = 'Send', submitDisabled = false}: TransferWizardProps): React.JSX.Element {
  const [current, setCurrent] = useState(0)
  const step = steps[current]
  const isLast = current === steps.length - 1

  return (
    <div className={"flex-1 min-h-0 flex justify-center px-12 py-2"}>
      <div className={"w-130 flex flex-col mt-6"}>
        <div className={"flex items-center"}>
          {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            return (
              <div key={s.label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
                <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${active ? 'dash-bg-inverse' : done ? 'dash-block-accent-15' : 'dash-block'}`}>
                  {done
                    ? <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                    : <Text size={12} weight={"medium"} color={active ? 'blue-mint' : 'brand'} opacity={active ? 100 : 40}>{i + 1}</Text>}
                </div>
                <Text size={12} weight={"medium"} color={"brand"} opacity={active || done ? 100 : 40} className={"ml-2 whitespace-nowrap"}>{s.label}</Text>
                {i < steps.length - 1 && <div className={"flex-1 h-px mx-3 bg-dash-primary-dark-blue/10 dark:bg-white/10"} />}
              </div>
            )
          })}
        </div>

        <div className={"mt-8 flex flex-col gap-4"}>
          {step.content}
        </div>

        <div className={"mt-8 flex gap-2"}>
          {current > 0 && (
            <Button
              type={"button"}
              onClick={() => setCurrent(c => c - 1)}
              variant={"outline"}
              colorScheme={"primary-light"}
              size={"md"}
              className={"flex-1 rounded-[.9375rem]"}
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button type={"button"} onClick={onSubmit} disabled={submitDisabled} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
              {submitLabel}
            </Button>
          ) : (
            <Button type={"button"} onClick={() => setCurrent(c => c + 1)} disabled={step.canAdvance === false} size={"md"} className={"flex-1 rounded-[.9375rem]"}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
