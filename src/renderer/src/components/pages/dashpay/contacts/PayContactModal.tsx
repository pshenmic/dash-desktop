import { useState } from 'react'
import { API } from '@renderer/api'
import type { SendResult } from '@renderer/api/types'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import AmountField from '@renderer/components/pages/transfer/AmountField'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import Spinner from '@renderer/components/ui/Spinner'
import TxSummary from '@renderer/components/ui/TxSummary'
import { DASH_UNIT } from '@renderer/constants/balance'
import { CONTACT_IDENTIFIER_CLASS } from '@renderer/constants/addressField'
import { FEE_SHORTFALL_COPY } from '@renderer/constants/dashPay'
import { PAY_CONTACT_COPY } from '@renderer/constants/dashPayContacts'
import { CHIP_ACTION, SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { TX_SUMMARY_LABELS, TX_SUMMARY_PENDING_VALUE } from '@renderer/constants/txSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { refreshDashPayPayments } from '@renderer/hooks/useDashPayPayments'
import { useFiat } from '@renderer/hooks/useFiat'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import { refreshBalance, useWalletBalance } from '@renderer/hooks/useWalletBalance'
import type { ContactFactProps } from '@renderer/types/DashPayContacts'
import type { PayContactModalProps } from '@renderer/types/DashPayScreens'
import { amountErrorFor } from '@renderer/utils/amountValidation'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { dashToDuffs, davToDash } from '@renderer/utils/balance'
import { contactDisplayName, contactLastActivity } from '@renderer/utils/dashPayContactList'
import { isDashAmountInput, payDoneNote } from '@renderer/utils/dashPayContactView'
import { formatCreationDate } from '@renderer/utils/date'
import { transactionUrl } from '@renderer/utils/explorer'
import { identityLabel } from '@renderer/utils/identifierFormat'

function ContactFact({ label, children }: ContactFactProps): React.JSX.Element {
  return (
    <div className={'flex items-center justify-between gap-4'}>
      <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{label}</Text>
      <Text size={12} weight={'medium'} color={'brand'} className={'flex items-center gap-1.5 text-right'}>{children}</Text>
    </div>
  )
}

function dashText(duffs: bigint): string {
  return `${davToDash(duffs)} ${DASH_UNIT}`
}

export default function PayContactModal({ open, onClose, contact, identity }: PayContactModalProps): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const [amount, setAmount] = useState('')
  const [seenOpen, setSeenOpen] = useState(false)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) setAmount('')
  }

  const amountDuffs = dashToDuffs(amount)
  const fee = useOperationFee(open ? walletId : null, TransferOperation.CoreSend, {
    amountCredits: 0n,
    recipient: '',
    amountDuffs,
    destinationValid: true,
  })
  const { balance } = useWalletBalance(walletId ?? undefined)
  const { format: formatFiat, rateReady } = useFiat()
  const feeReady = !fee.loading && fee.err == null && fee.feeDuffs != null
  const feeDuffs = feeReady ? fee.feeDuffs : null
  const contactName = contactDisplayName(contact)
  const identityName = identityLabel(identity)
  const amountError = amountErrorFor({
    isCoreOperation: true,
    amount,
    coreMaxDuffs: fee.maxDuffs,
    operation: TransferOperation.CoreSend,
    amountDuffs,
    amountCredits: 0n,
    minCredits: 0n,
    availableCredits: null,
    feeCredits: null,
    maxPerTx: null,
    noteLimit: null,
  })

  const run = async (password: string): Promise<SendResult> => {
    const result = await API.sendDashPayPayment(walletId!, identity.identifier, contact.contactId, amountDuffs, password)
    void refreshDashPayPayments(walletId!, identity.identifier, contact.contactId)
    void refreshBalance(walletId!)
    return result
  }

  let feeValue: React.ReactNode = feeDuffs == null ? null : dashText(feeDuffs)
  if (fee.loading) feeValue = <Spinner size={12} />
  else if (fee.err != null) {
    feeValue = (
      <>
        <span className={'text-dash-red'}>{FEE_SHORTFALL_COPY.feeError}</span>
        <button type={'button'} onClick={fee.retry} className={CHIP_ACTION}>{FEE_SHORTFALL_COPY.retry}</button>
      </>
    )
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <div className={`flex items-center gap-3 ${SURFACE_ROW}`}>
        <IdentityAvatar identifier={contact.contactId} size={IdentityAvatarSize.Sm} />
        <div className={'flex min-w-0 flex-col gap-0.5'}>
          {contact.aliasesList[0] != null ? (
            <>
              <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{contactName}</Text>
              <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 break-all'}>{contact.contactId}</Text>
            </>
          ) : (
            <HighlightedIdentifier className={CONTACT_IDENTIFIER_CLASS}>{contact.contactId}</HighlightedIdentifier>
          )}
          <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'min-w-0 truncate'}>
            {`${PAY_CONTACT_COPY.contactSince} ${formatCreationDate(new Date(contactLastActivity(contact)))}`}
          </Text>
        </div>
      </div>
      <AmountField
        value={amount}
        onChange={(event) => { if (isDashAmountInput(event.target.value)) setAmount(event.target.value) }}
        onMax={() => { if (fee.maxDuffs != null) setAmount(davToDash(fee.maxDuffs)) }}
        maxDisabled={fee.maxDuffs == null}
        unit={<Text size={14} weight={'medium'} color={'brand'}>{DASH_UNIT}</Text>}
        caption={rateReady && amountDuffs > 0n && (
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{formatApproxFiat(formatFiat(amountDuffs))}</Text>
        )}
      />
      {amountError && (
        <Text size={12} weight={'medium'} color={'red'} className={'px-1'}>{amountError}</Text>
      )}
      <div className={`flex flex-col gap-[.625rem] ${SURFACE_SECTION}`}>
        <ContactFact label={PAY_CONTACT_COPY.available}>{dashText(balance.dash.amount)}</ContactFact>
        <ContactFact label={PAY_CONTACT_COPY.networkFee}>{feeValue ?? TX_SUMMARY_PENDING_VALUE}</ContactFact>
        <ContactFact label={PAY_CONTACT_COPY.total}>{feeDuffs == null ? TX_SUMMARY_PENDING_VALUE : dashText(amountDuffs + feeDuffs)}</ContactFact>
      </div>
    </div>
  )

  return (
    <SignedActionModal<SendResult>
      open={open}
      onClose={onClose}
      title={PAY_CONTACT_COPY.title}
      edit={{
        content: editContent,
        continueLabel: PAY_CONTACT_COPY.review,
        canContinue: amountDuffs > 0n && amountError == null && feeReady,
      }}
      contextLine={
        <>
          <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xs} />
          <span className={'min-w-0 wrap-anywhere'}>{PAY_CONTACT_COPY.payingAs} <strong>{identityName}</strong></span>
        </>
      }
      summary={
        <TxSummary
          unit={'duffs'}
          amount={amountDuffs}
          from={{ value: PAY_CONTACT_COPY.coreSource, kind: TxEndpointKind.Label, paysFee: true }}
          to={[{ value: contactName, kind: TxEndpointKind.Label }]}
          fees={[{ label: TX_SUMMARY_LABELS.networkFee, amount: feeDuffs, unit: 'duffs' }]}
          total={feeDuffs == null ? null : amountDuffs + feeDuffs}
        />
      }
      confirmLabel={PAY_CONTACT_COPY.confirm}
      confirmDisabled={!feeReady || amountDuffs <= 0n}
      pendingLabel={PAY_CONTACT_COPY.pending}
      run={run}
      renderDone={(result) => ({
        headline: `${davToDash(amountDuffs)} ${PAY_CONTACT_COPY.sent}`,
        note: payDoneNote(contactName, identityName),
        details: [{ label: PAY_CONTACT_COPY.networkFee, value: dashText(result.fee) }],
        hash: {
          value: result.txid,
          label: PAY_CONTACT_COPY.transactionId,
          explorerUrl: network == null ? null : transactionUrl(result.txid, network),
        },
      })}
    />
  )
}
