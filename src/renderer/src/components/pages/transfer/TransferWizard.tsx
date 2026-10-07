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
  sendPresentation?: boolean
}

export default function TransferWizard({steps, onSubmit, submitLabel = 'Send', submitDisabled = false, sendPresentation = false}: TransferWizardProps): React.JSX.Element {
  const [current, setCurrent] = useState(0)
  const step = steps[current]
  const isLast = current === steps.length - 1

  return (
    <div className={sendPresentation ? 'flex-1 min-h-0 flex' : 'flex-1 min-h-0 flex justify-center px-12 py-2'}>
      <div className={sendPresentation ? 'w-full min-w-0 flex flex-col' : 'w-full max-w-200 flex flex-col mt-6'}>
        <div className={sendPresentation ? 'flex items-center gap-2 sm:gap-0!' : 'flex items-center'}>
          {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            return (
              <div key={s.label} className={sendPresentation
                ? `flex min-w-0 flex-1 flex-col items-center sm:flex-row! ${i === steps.length - 1 ? 'sm:flex-none!' : ''}`
                : `flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
                <div className={`rounded-full flex items-center justify-center shrink-0 ${sendPresentation
                  ? `size-8 border ${active || done ? 'border-dash-brand dark:border-dash-mint bg-dash-brand/5 dark:bg-dash-mint/5' : 'border-dash-primary-dark-blue/15 dark:border-white/15'}`
                  : `size-7 ${active ? 'dash-bg-inverse' : done ? 'dash-block-accent-15' : 'dash-block'}`}`}>
                  {done
                    ? <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                    : <Text size={sendPresentation ? 14 : 12} weight={"medium"} color={active ? 'blue-mint' : 'brand'} opacity={active ? 100 : 40}>{i + 1}</Text>}
                </div>
                <Text size={sendPresentation ? 16 : 12} weight={sendPresentation && active ? 'extrabold' : 'medium'} color={sendPresentation && (active || done) ? 'blue-mint' : 'brand'} opacity={active || done ? 100 : 40} className={sendPresentation ? 'mt-2 sm:mt-0! sm:ml-2! whitespace-nowrap text-xs! sm:text-base!' : 'ml-2 whitespace-nowrap'}>{s.label}</Text>
                {i < steps.length - 1 && <div className={`${sendPresentation ? 'hidden! sm:block! ' : ''}flex-1 h-px mx-3 bg-dash-primary-dark-blue/10 dark:bg-white/10`} />}
              </div>
            )
          })}
        </div>

        <div className={sendPresentation ? 'mt-14 flex flex-col gap-4' : 'mt-8 flex flex-col gap-4'}>
          {step.content}
        </div>

        <div className={sendPresentation ? 'mt-auto pt-8 flex gap-2' : 'mt-8 flex gap-2'}>
          {current > 0 && (
            <Button
              type={"button"}
              onClick={() => setCurrent(c => c - 1)}
              variant={"outline"}
              colorScheme={"primary-light"}
              size={"md"}
              className={sendPresentation ? 'flex-1 h-[3.625rem] rounded-2xl' : 'flex-1 rounded-[.9375rem]'}
            >
              Back
            </Button>
          )}
          {isLast ? (
            <Button type={"button"} onClick={onSubmit} disabled={submitDisabled} size={"md"} colorScheme={sendPresentation ? 'lightBlue-mint' : 'primary'} className={sendPresentation ? 'flex-1 h-[3.625rem] rounded-2xl text-base' : 'flex-1 rounded-[.9375rem]'}>
              {submitLabel}
            </Button>
          ) : (
            <Button type={"button"} onClick={() => setCurrent(c => c + 1)} disabled={step.canAdvance === false} size={"md"} colorScheme={sendPresentation ? 'lightBlue-mint' : 'primary'} className={sendPresentation ? 'flex-1 h-[3.625rem] rounded-2xl text-base' : 'flex-1 rounded-[.9375rem]'}>
              {sendPresentation ? 'Continue' : 'Next'}
            </Button>
          )}
        </div>
        {sendPresentation && <div className="mt-3 flex gap-2" aria-hidden="true">
          {steps.map((s, i) => <div key={s.label} className={`h-1 flex-1 rounded-full ${i <= current ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-dash-brand/15 dark:bg-dash-mint/15'}`} />)}
        </div>}
      </div>
    </div>
  )
}
