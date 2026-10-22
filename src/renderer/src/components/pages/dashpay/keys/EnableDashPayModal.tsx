import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API } from '@renderer/api'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
import TxSummary from '@renderer/components/ui/TxSummary'
import { DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { ENABLE_DASHPAY_COPY, KEYS_SIGNED_COPY } from '@renderer/constants/dashPayKeys'
import { TX_SUMMARY_LABELS } from '@renderer/constants/txSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { KeysAddedResult } from '@renderer/types/DashPayKeys'
import type { EnableDashPayModalProps } from '@renderer/types/DashPayScreens'
import { dashPayHref } from '@renderer/utils/dashPayIdentity'
import { dashPayEnabledHeadline, enableDashPayDescription } from '@renderer/utils/dashPayKeySetup'
import { dashPayReadiness } from '@renderer/utils/dashPayReadiness'
import { keysShortfall } from '@renderer/utils/dashPayShortfall'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { keyRequestLabel } from '@renderer/utils/identityKeyRequests'

export default function EnableDashPayModal({ open, onClose, identity }: EnableDashPayModalProps): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const navigate = useNavigate()
  const location = useLocation()
  const readiness = useMemo(() => dashPayReadiness(identity), [identity])
  const keys = readiness.missingKeys
  const name = identityLabel(identity)
  const balance = identity.balance.amount

  const fee = useOperationFee(walletId, open ? TransferOperation.IdentityCreateKeys : null, {
    amountCredits: 0n,
    recipient: '',
    identityId: identity.identifier,
    keys,
    destinationValid: keys.length > 0,
  })
  const feeCredits = fee.loading || fee.err != null ? null : fee.feeCredits
  const shortfall = keysShortfall({ requested: keys.length, slotsLeft: readiness.slotsLeft, feeCredits, feeError: fee.err, balance })

  const run = async (password: string): Promise<KeysAddedResult> => {
    const stHash = await API.createIdentityKeys(walletId!, identity.identifier, keys, password)
    void refreshIdentities(walletId!)
    return { stHash, count: keys.length }
  }

  const openAddContact = (): void => {
    const state: DashPayNavigationState = { returnTo: location.pathname + location.search }
    navigate(dashPayHref(DASHPAY_ROUTES.addContact, identity.identifier), { state })
  }

  return (
    <SignedActionModal<KeysAddedResult>
      open={open}
      onClose={onClose}
      title={ENABLE_DASHPAY_COPY.title}
      description={enableDashPayDescription(name)}
      summary={
        <TxSummary
          unit={"credits"}
          from={{ value: name, kind: TxEndpointKind.Label, paysFee: true }}
          to={keys.map(key => ({ value: keyRequestLabel(key), kind: TxEndpointKind.Label }))}
          toLabel={ENABLE_DASHPAY_COPY.toLabel}
          fees={[{ label: TX_SUMMARY_LABELS.networkFee, amount: feeCredits, unit: 'credits' }]}
          total={feeCredits}
          details={[
            { label: KEYS_SIGNED_COPY.identityBalance, amount: balance, unit: 'credits' },
            { label: KEYS_SIGNED_COPY.balanceAfter, amount: feeCredits == null ? null : balance - feeCredits, unit: 'credits' },
          ]}
        />
      }
      shortfall={shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />}
      confirmLabel={ENABLE_DASHPAY_COPY.confirm}
      confirmDisabled={feeCredits == null || keys.length === 0}
      pendingLabel={KEYS_SIGNED_COPY.pending}
      run={run}
      renderDone={result => ({
        headline: dashPayEnabledHeadline(name),
        hash: {
          value: result.stHash,
          label: KEYS_SIGNED_COPY.hashLabel,
          explorerUrl: network ? platformTransactionUrl(result.stHash, network) : null,
        },
        secondary: { label: ENABLE_DASHPAY_COPY.addContact, onClick: () => { onClose(); openAddContact() } },
      })}
    />
  )
}
