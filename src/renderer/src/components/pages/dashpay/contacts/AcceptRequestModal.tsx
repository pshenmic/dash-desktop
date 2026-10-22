import { useNavigate } from 'react-router-dom'
import { API } from '@renderer/api'
import type { DashPayContactDto } from '@renderer/api/types'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import TxSummary from '@renderer/components/ui/TxSummary'
import { ACCEPT_REQUEST_COPY, DASHPAY_TOP_UP_HREF, FEE_SHORTFALL_COPY } from '@renderer/constants/dashPayContacts'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { setDashPayContactsCache } from '@renderer/hooks/useDashPayContacts'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import type { AcceptRequestModalProps } from '@renderer/types/DashPayScreens'
import type { FeeShortfallProps } from '@renderer/types/DashPayContacts'
import { creditsToDash } from '@renderer/utils/balance'
import { contactDisplayName, isPayable } from '@renderer/utils/dashPayContactList'
import { creditShortfall } from '@renderer/utils/dashPayContactView'
import { identityLabel } from '@renderer/utils/identifierFormat'

function FeeShortfall({ feeError, onRetry, identityName, missingCredits, onTopUp }: FeeShortfallProps): React.JSX.Element | null {
  if (!feeError && missingCredits == null) return null
  return (
    <div className={'flex items-center justify-between gap-3 px-1'}>
      <Text size={12} weight={'medium'} color={'red'}>
        {feeError ? FEE_SHORTFALL_COPY.feeFailed : `${identityName} ${FEE_SHORTFALL_COPY.needs} ${creditsToDash(missingCredits ?? 0n)} ${FEE_SHORTFALL_COPY.more}`}
      </Text>
      <button type={'button'} onClick={feeError ? onRetry : onTopUp} className={`${CHIP_ACTION} shrink-0`}>
        {feeError ? FEE_SHORTFALL_COPY.retry : FEE_SHORTFALL_COPY.topUp}
      </button>
    </div>
  )
}

export default function AcceptRequestModal({ open, onClose, contact, identity, onPay }: AcceptRequestModalProps): React.JSX.Element | null {
  const navigate = useNavigate()
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
  const missing = creditShortfall(balance, feeCredits)
  const feeError = !fee.loading && fee.err != null

  const run = async (password: string): Promise<DashPayContactDto[]> => {
    const contacts = await API.sendDashPayContactRequest(walletId!, identity.identifier, contact.contactId, password)
    setDashPayContactsCache(walletId!, contacts)
    void refreshIdentities(walletId!)
    return contacts
  }

  const topUp = (): void => {
    onClose()
    navigate(DASHPAY_TOP_UP_HREF)
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
      shortfall={(feeError || missing != null) && (
        <FeeShortfall feeError={feeError} onRetry={fee.retry} identityName={identityName} missingCredits={missing} onTopUp={topUp} />
      )}
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
