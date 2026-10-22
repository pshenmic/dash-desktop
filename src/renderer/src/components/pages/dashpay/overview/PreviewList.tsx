import { useState } from 'react'
import type { DashPayContactDto } from '@renderer/api/types'
import { ArrowIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import AcceptRequestModal from '@renderer/components/pages/dashpay/contacts/AcceptRequestModal'
import ContactRow from '@renderer/components/pages/dashpay/contacts/ContactRow'
import PayContactModal from '@renderer/components/pages/dashpay/contacts/PayContactModal'
import {
  OVERVIEW_BAND_CLASS,
  OVERVIEW_BAND_TITLES,
  OVERVIEW_COPY,
  SECTION_HEADER_CLASS,
  VIEW_ALL_CLASS,
} from '@renderer/constants/dashPayOverview'
import type { PreviewListProps } from '@renderer/types/DashPayOverview'
import { contactRowModel } from '@renderer/utils/dashPayContactList'

export default function PreviewList({
  band,
  identity,
  walletIdentifiers,
  canSend,
  now,
  onViewAll,
  onOpenContact,
}: PreviewListProps): React.JSX.Element {
  const [accepting, setAccepting] = useState<DashPayContactDto | null>(null)
  const [paying, setPaying] = useState<DashPayContactDto | null>(null)

  const payAfterAccept = (contact: DashPayContactDto): void => {
    setAccepting(null)
    setPaying(contact)
  }

  return (
    <section className={OVERVIEW_BAND_CLASS} aria-label={OVERVIEW_BAND_TITLES[band.kind]}>
      <header className={SECTION_HEADER_CLASS}>
        <DashboardHeading as={'h3'}>{`${OVERVIEW_BAND_TITLES[band.kind]} · ${band.total}`}</DashboardHeading>
        <button type={'button'} onClick={onViewAll} className={VIEW_ALL_CLASS}>
          <Text reset size={12} weight={'medium'} color={'blue-mint'}>{OVERVIEW_COPY.viewAll}</Text>
          <ArrowIcon size={9} color={'currentColor'} className={'rotate-180 dash-text-primary'} />
        </button>
      </header>
      <ul className={'flex flex-col gap-[.625rem]'}>
        {band.rows.map(contact => (
          <ContactRow
            key={contact.contactId}
            model={contactRowModel(contact, walletIdentifiers)}
            now={now}
            canSend={canSend}
            onOpen={onOpenContact}
            onAccept={setAccepting}
            onPay={setPaying}
          />
        ))}
      </ul>
      {accepting != null && (
        <AcceptRequestModal open onClose={() => setAccepting(null)} contact={accepting} identity={identity} onPay={payAfterAccept} />
      )}
      {paying != null && <PayContactModal open onClose={() => setPaying(null)} contact={paying} identity={identity} />}
    </section>
  )
}
