import { useState } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import { DASHPAY_IDENTITIES } from '@renderer/constants/dashpayDemo'
import { DASHPAY_CONTACT_PRESENTATION } from '@renderer/constants/dashpayContacts'
import { useDashpayDemo } from '@renderer/contexts/DashpayDemoContext'
import type { DashpayPersonModalProps } from '@renderer/types/dashpayDemo'
import { getDemoContactStatus } from '@renderer/utils/dashpayDemo'
import { DemoAvatar, DemoBadge, DemoModal, DemoNotice } from './shared'

export default function PersonModal({ person, onClose }: DashpayPersonModalProps): React.JSX.Element {
  const { state, identity, sendRequest, acceptRequest, ignoreRequest } = useDashpayDemo()
  const [feedback, setFeedback] = useState('')
  const owned = DASHPAY_IDENTITIES.some((item) => item.id === person.id)
  const status = getDemoContactStatus(state, person.id)
  const presentation = status ? DASHPAY_CONTACT_PRESENTATION[status] : null

  return (
    <DemoModal title="DashPay profile" description="Get to know the person behind the name." onClose={onClose}>
      <div className="rounded-2xl dash-block-3 p-5">
        <div className="flex items-start gap-4">
          <DemoAvatar label={person.displayName} large />
          <div className="min-w-0 flex-1 pt-1">
            <Text as="h3" reset size={20} weight="medium" color="brand" className="break-words">{person.displayName}</Text>
            <Text as="p" reset size={14} weight="medium" color="blue-mint" className="mt-1 break-all">{person.username}.dash</Text>
            <div className="mt-3">
              {owned ? (
                <DemoBadge>Your identity</DemoBadge>
              ) : presentation ? (
                <DemoBadge tone={presentation.tone}>{presentation.label}</DemoBadge>
              ) : (
                <DemoBadge>Not connected</DemoBadge>
              )}
            </div>
          </div>
        </div>
        <Text as="p" reset size={14} color="brand" opacity={60} className="mt-5 leading-relaxed">{person.bio}</Text>
      </div>

      <div className="mt-4 rounded-2xl dash-block-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Text as="p" reset size={12} weight="medium" color="brand" opacity={50}>Demo identity</Text>
            <Text as="p" reset size={12} color="brand" className="mt-1 select-all break-all font-mono">{person.id}</Text>
          </div>
          <CopyButton text={person.id} ariaLabel={`Copy ${person.displayName}'s demo identity`} className="shrink-0" />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <DemoNotice tone={owned ? 'neutral' : presentation?.tone}>
          {owned ? 'This identity belongs to you. Your own identities cannot be added as contacts.'
            : !identity ? 'Choose or create a demo identity from the DashPay overview before sending a contact request.'
              : presentation ? presentation.description
                : `Send a contact request from ${identity.label}. This person will become a contact after accepting it.`}
        </DemoNotice>

        <div role="status" aria-live="polite">
          {feedback && <Text reset as="p" size={14} weight="medium" color="brand">{feedback}</Text>}
        </div>

        {!owned && identity && status === 'incoming' && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" colorScheme="primary" className="flex-1" onClick={() => {
              acceptRequest(person.id)
              setFeedback(`${person.displayName} is now in your contacts.`)
            }}>Accept request</Button>
            <Button type="button" size="xs" colorScheme="primary-light" onClick={() => {
              ignoreRequest(person.id)
              setFeedback('Request ignored. You can still send a request later.')
            }}>Ignore</Button>
          </div>
        )}
        {!owned && !status && (
          <Button type="button" size="sm" colorScheme="primary" className="w-full" disabled={!identity} onClick={() => {
            sendRequest(person.id)
            setFeedback('Contact request sent in this demo.')
          }}>Send contact request</Button>
        )}
        <Text as="p" reset size={12} color="brand" opacity={50} className="leading-relaxed">Sample profile. Contact changes stay in this frontend demo and reset with the scenario.</Text>
      </div>
    </DemoModal>
  )
}
