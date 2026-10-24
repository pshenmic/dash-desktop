import { API } from '@renderer/api'
import type { DashPayContactDto } from '@renderer/api/types'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
import TxSummary from '@renderer/components/ui/TxSummary'
import { ACCEPT_REQUEST_COPY } from '@renderer/constants/dashPayContacts'
import { useAuth } from '@renderer/contexts/AuthContext'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { setDashPayContactsCache } from '@renderer/hooks/useDashPayContacts'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import type { AcceptRequestModalProps } from '@renderer/types/DashPayScreens'
import { contactDisplayName, isPayable } from '@renderer/utils/dashPayContactList'
import { feeShortfall } from '@renderer/utils/dashPayShortfall'
import { identityLabel } from '@renderer/utils/identifierFormat'

export default function AcceptRequestModal({ open, onClose, contact, identity, onPay }: AcceptRequestModalProps): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const fee = useOperationFee(open ? walletId : null, TransferOperation.DashPayContactRequest, {
    amountCredits: 0n,
    recipient: contact.contactId,
    identityId: identity.identifier,
    destinationValid: true,
  })
  const feeReady = !fee.loading && fee.err == null && fee.feeCredits != null
  const feeCredits = feeReady ? fee.feeCredits : null
  const balance = identity.balance.amount
  const identityName = identityLabel(identity)
  const contactName = contactDisplayName(contact)
  const shortfall = feeShortfall(!fee.loading && fee.err != null, balance, feeCredits)

  const run = async (password: string): Promise<DashPayContactDto[]> => {
    const contacts = await API.sendDashPayContactRequest(walletId!, identity.identifier, contact.contactId, password)
    setDashPayContactsCache(walletId!, contacts)
    void refreshIdentities(walletId!)
    return contacts
  }

  return (
    <SignedActionModal<DashPayContactDto[]>
      open={open}
      onClose={onClose}
      title={ACCEPT_REQUEST_COPY.title}
      summary={
        <TxSummary
          unit={'credits'}
          from={{ value: identityName, kind: TxEndpointKind.Label, paysFee: true }}
          to={[{ value: contactName, kind: TxEndpointKind.Label }]}
          fees={[{ label: ACCEPT_REQUEST_COPY.fee, amount: feeCredits, unit: 'credits' }]}
          total={feeCredits}
          details={[
            { label: ACCEPT_REQUEST_COPY.identityBalance, amount: balance, unit: 'credits' },
            { label: ACCEPT_REQUEST_COPY.balanceAfter, amount: feeCredits == null ? null : balance - feeCredits, unit: 'credits' },
          ]}
        />
      }
      shortfall={shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />}
      confirmLabel={ACCEPT_REQUEST_COPY.confirm}
      confirmDisabled={!feeReady}
      pendingLabel={ACCEPT_REQUEST_COPY.pending}
      run={run}
      renderDone={(contacts, controls) => {
        const accepted = contacts.find(entry => entry.identifier === identity.identifier && entry.contactId === contact.contactId)
        return {
          headline: `${contactName} ${ACCEPT_REQUEST_COPY.nowContact}`,
          note: `${ACCEPT_REQUEST_COPY.as} ${identityName}`,
          secondary: accepted != null && isPayable(accepted) && onPay ? {
            label: ACCEPT_REQUEST_COPY.pay,
            onClick: () => {
              controls.close()
              onPay(accepted)
            },
          } : undefined,
        }
      }}
    />
  )
}
