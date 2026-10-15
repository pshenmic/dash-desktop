import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import Spinner from '@renderer/components/ui/Spinner'
import { DEMO_OPERATION_DELAY_MS } from '@renderer/constants/dashpayDemo'
import { DASHPAY_CONTEST_FEE_ESTIMATE, DASHPAY_NAME_FEE_ESTIMATE } from '@renderer/constants/dashpayNames'
import { useDashpayDemo } from '@renderer/contexts/DashpayDemoContext'
import type { DashpayNameCheck, DashpayRegisterNameProps } from '@renderer/types/dashpayDemo'
import type { DashpayRegistrationOperation, DashpayRegistrationStage } from '@renderer/types/dashpayNames'
import { checkDemoName } from '@renderer/utils/dashpayDemo'
import { DemoBadge, DemoModal, DemoNotice } from './shared'

export default function RegisterNameModal({ onClose, onRegistered }: DashpayRegisterNameProps): React.JSX.Element {
  const demo = useDashpayDemo()
  const navigate = useNavigate()
  const [stage, setStage] = useState<DashpayRegistrationStage>('choose')
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState<DashpayNameCheck | null>(null)
  const [operation, setOperation] = useState<DashpayRegistrationOperation | null>(null)
  const [error, setError] = useState('')
  const currentDemo = useRef(demo)
  currentDemo.current = demo
  const contested = checked?.status === 'contested'
  const canContinue = checked?.status === 'available' || contested

  useEffect(() => {
    if (!operation) return
    const timeout = window.setTimeout(() => {
      const current = currentDemo.current
      if (!current.identity || current.identity.id !== operation.identityId) {
        setError('The selected identity changed. Check your name again before continuing.')
        setChecked(null)
        setOperation(null)
        setStage('choose')
        return
      }
      const result = checkDemoName(operation.label, current.state.names)
      if (result.status !== 'available' && result.status !== 'contested') {
        setChecked(result)
        setError('This name is no longer available. Choose another name.')
        setOperation(null)
        setStage('choose')
        return
      }
      current.registerName(result.label)
      setChecked(result)
      setStage('complete')
    }, DEMO_OPERATION_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [operation])

  const checkName = (): void => {
    setError('')
    setChecked(checkDemoName(input, demo.state.names))
  }

  const reviewName = (): void => {
    const result = checkDemoName(input, demo.state.names)
    setChecked(result)
    setError('')
    if (result.status === 'available' || result.status === 'contested') setStage('review')
  }

  const submitName = (): void => {
    const result = checkDemoName(input, demo.state.names)
    setChecked(result)
    if (!demo.identity || (result.status !== 'available' && result.status !== 'contested')) {
      setError('Check the name and selected identity before continuing.')
      setStage('choose')
      return
    }
    setOperation({ identityId: demo.identity.id, label: result.label })
    setStage('submitting')
  }

  return (
    <DemoModal title={stage === 'complete' ? contested ? 'Name submitted for voting' : 'Your name is ready' : 'Register a name'} description={stage === 'complete' ? 'A little more you. A little easier to find.' : 'Choose how people will find this identity on DashPay.'} onClose={onClose}>
      {!demo.identity ? (
        <div className="space-y-5">
          <DemoNotice>Create a demo identity before registering a name. An identity holds your names and connects you with your contacts.</DemoNotice>
          <Button type="button" size="sm" colorScheme="primary" className="w-full" onClick={() => { onClose(); navigate('/dashpay') }}>Go to Overview</Button>
        </div>
      ) : stage === 'choose' ? (
        <form className="space-y-5" onSubmit={(event) => {
          event.preventDefault()
          if (canContinue) reviewName()
          else checkName()
        }}>
          <div className="flex items-center justify-between gap-3 rounded-xl dash-block-3 px-4 py-3">
            <Text size={12} color="brand" opacity={50}>Registering with</Text>
            <Text size={14} weight="medium" color="brand" className="truncate">{demo.identity.label}</Text>
          </div>
          <div>
            <label htmlFor="dashpay-register-name" className="mb-2 block"><Text size={12} weight="medium" color="brand" opacity={50}>Your name</Text></label>
            <div className={`flex items-center gap-3 rounded-[.875rem] dash-input-block px-4 py-3.5 ${checked !== null && !canContinue ? 'outline outline-1 outline-dash-red' : ''}`}>
              <Input
                id="dashpay-register-name"
                autoFocus
                value={input}
                onChange={(event) => { setInput(event.target.value); setChecked(null); setError('') }}
                colorScheme="transparent"
                variant="filled"
                size="md"
                className="min-w-0 !rounded-none !bg-transparent !p-0 outline-none dash-text-default placeholder:opacity-40 !ring-0"
                placeholder="your-name"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby="dashpay-name-guidance dashpay-name-check"
                aria-invalid={checked !== null && !canContinue}
              />
              <Text size={14} color="brand" opacity={40} className="pointer-events-none shrink-0">.dash</Text>
            </div>
            <p id="dashpay-name-guidance" className="mt-2"><Text size={12} color="brand" opacity={50} className="leading-relaxed">Letters, numbers, and hyphens. Enter the name with or without .dash.</Text></p>
          </div>
          <div id="dashpay-name-check" aria-live="polite">
            {checked && (
              <DemoNotice tone={canContinue ? contested ? 'amber' : 'mint' : 'red'}>
                <span className="block font-semibold">
                  {checked.status === 'available' ? 'Available in this demo' : checked.status === 'contested' ? 'Eligible for a name contest' : checked.status === 'taken' ? 'This name is already taken' : checked.status === 'locked' ? 'This name is locked' : 'Check the name format'}
                </span>
                <span className="mt-1 block">{checked.message}</span>
              </DemoNotice>
            )}
          </div>
          {error && <p role="alert"><Text size={14} color="red">{error}</Text></p>}
          <DemoNotice tone="neutral">Ordinary names can be registered directly. Short alphabetic names are contested and require masternode voting. This demo illustrates both outcomes.</DemoNotice>
          <Button type="submit" size="sm" colorScheme="primary" className="w-full" disabled={!input.trim()}>
            {canContinue ? 'Continue' : 'Check availability'}
          </Button>
        </form>
      ) : stage === 'review' ? (
        <div className="space-y-5">
          <div className="rounded-2xl dash-block-3 px-5 py-6 text-center">
            <Text as="p" reset size={24} weight="medium" color="brand" className="break-all tracking-tight">{checked?.label}<span className="font-normal opacity-35">.dash</span></Text>
            <div className="mt-3"><DemoBadge tone={contested ? 'amber' : 'mint'}>{contested ? 'Contested name' : 'Ordinary name'}</DemoBadge></div>
          </div>
          <dl className="space-y-4 rounded-2xl dash-block-3 p-4">
            <div className="flex justify-between gap-4">
              <Text as="dt" reset size={14} color="brand" opacity={50}>Identity</Text>
              <Text as="dd" reset size={14} weight="medium" color="brand" className="text-right">{demo.identity.label}</Text>
            </div>
            <div className="flex justify-between gap-4">
              <Text as="dt" reset size={14} color="brand" opacity={50}>Demo fee estimate</Text>
              <Text as="dd" reset size={14} weight="medium" color="brand" className="text-right">{contested ? DASHPAY_CONTEST_FEE_ESTIMATE : DASHPAY_NAME_FEE_ESTIMATE}</Text>
            </div>
            <div className="flex justify-between gap-4">
              <Text as="dt" reset size={14} color="brand" opacity={50}>Next step</Text>
              <Text as="dd" reset size={14} weight="medium" color="brand" className="text-right">{contested ? 'Masternode voting' : 'Name registration'}</Text>
            </div>
          </dl>
          <DemoNotice tone={contested ? 'amber' : 'neutral'}>{contested ? 'Submitting enters a simulated voting period. The name is not yours until the contest is awarded.' : 'Your name will be linked to the selected demo identity.'} The amount above is illustrative, not a network fee quote. No funds or credits will be spent.</DemoNotice>
          <div className="flex items-center gap-3">
            <Button type="button" size="xs" colorScheme="primary-light" onClick={() => setStage('choose')}>Back</Button>
            <Button type="button" size="sm" colorScheme="primary" className="flex-1" onClick={submitName}>{contested ? 'Simulate submission' : 'Simulate registration'}</Button>
          </div>
        </div>
      ) : stage === 'submitting' ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center" role="status" aria-live="polite">
          <Spinner size={40} className="text-dash-brand dark:text-dash-mint motion-reduce:animate-none" />
          <Text as="p" reset size={16} weight="medium" color="brand">{contested ? 'Submitting your demo contest…' : 'Registering your demo name…'}</Text>
          <Text as="p" reset size={12} color="brand" opacity={50} className="max-w-xs leading-relaxed">Checking availability once more and updating this preview. No network transaction is sent.</Text>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl dash-block-3 px-5 py-7 text-center">
            <span aria-hidden="true" className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-xl text-emerald-700 dark:text-dash-mint">{contested ? '◷' : '✓'}</span>
            <Text as="p" reset size={24} weight="medium" color="brand" className="break-all tracking-tight">{checked?.label}<span className="font-normal opacity-35">.dash</span></Text>
            <div className="mt-3"><DemoBadge tone={contested ? 'amber' : 'mint'}>{contested ? 'Awaiting votes' : 'Registered in demo'}</DemoBadge></div>
          </div>
          <DemoNotice tone={contested ? 'amber' : 'mint'}>{contested ? 'Your demo submission is now in Your names. Follow the voting view to see how name contests work; ownership is not guaranteed.' : 'Your demo name now appears in Your names for this identity. You can keep exploring DashPay and add people to your contacts.'}</DemoNotice>
          {contested && <Button type="button" size="xs" colorScheme="primary-light" className="mx-auto gap-2" onClick={() => { onClose(); navigate('/masternodes?tab=voting') }}>View masternode voting <span aria-hidden="true">↗</span></Button>}
          <Button type="button" size="sm" colorScheme="primary" className="w-full" onClick={() => { onRegistered?.(); onClose() }}>Done</Button>
        </div>
      )}
    </DemoModal>
  )
}
