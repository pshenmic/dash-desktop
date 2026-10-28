import { ExclamationIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import ShortfallNotice from '@renderer/components/pages/dashpay/ShortfallNotice'
import Alert from '@renderer/components/ui/Alert'
import TxSummary from '@renderer/components/ui/TxSummary'
import { API } from '@renderer/api'
import { IDENTITY_KEY_DASHPAY_IMPACT_COPY, IDENTITY_KEY_UPDATE_COPY, IDENTITY_KEY_UPDATE_LABELS, KEYS_SIGNED_COPY } from '@renderer/constants/identityKeys'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { refreshIdentities } from '@renderer/hooks/useIdentities'
import { useOperationFee } from '@renderer/hooks/useOperationFee'
import type { KeyUpdateResult, UpdateKeyModalProps } from '@renderer/types/IdentityKeys'
import { feeShortfall } from '@renderer/utils/dashPayShortfall'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { identityLabel } from '@renderer/utils/identifierFormat'
import { disableKeyDashPayImpact, identityKeyUpdate } from '@renderer/utils/identityKeyActions'
import { identityKeyLabel, keyRequestLabel } from '@renderer/utils/identityKeyRequests'

export default function UpdateKeyModal({ walletId, identity, pending, onClose }: UpdateKeyModalProps): React.JSX.Element | null {
  const { status } = useAuth()
  const network = status?.network ?? null
  const update = pending == null ? null : identityKeyUpdate(pending.identityKey.keyId, pending.action)
  const fee = useOperationFee(walletId, update == null ? null : TransferOperation.IdentityUpdateKeys, {
    amountCredits: 0n,
    recipient: '',
    identityId: identity.identifier,
    keys: update?.add ?? [],
    keyIds: update?.disable ?? [],
    destinationValid: update != null,
  })

  if (pending == null || update == null) return null

  const copy = IDENTITY_KEY_UPDATE_COPY[pending.action]
  const balance = identity.balance.amount
  const feeCredits = fee.loading || fee.err != null ? null : fee.feeCredits
  const shortfall = feeShortfall(fee.err != null, balance, feeCredits)
  const impact = disableKeyDashPayImpact(identity.keys, pending.identityKey)
  const changes = [
    { value: `${IDENTITY_KEY_UPDATE_LABELS.disable} ${identityKeyLabel(pending.identityKey)}`, kind: TxEndpointKind.Label },
    ...update.add.map(request => ({ value: `${IDENTITY_KEY_UPDATE_LABELS.add} ${keyRequestLabel(request)}`, kind: TxEndpointKind.Label })),
  ]

  const run = async (password: string): Promise<KeyUpdateResult> => {
    const stHash = await API.updateIdentityKeys(walletId, identity.identifier, update, password)
    void refreshIdentities(walletId)
    return { stHash }
  }

  return (
    <SignedActionModal<KeyUpdateResult>
      open
      onClose={onClose}
      title={copy.title}
      summary={
        <div className={"flex flex-col gap-3"}>
          <Alert tone={AlertTone.Warning} icon={<ExclamationIcon size={16} color={"currentColor"} />} title={copy.warningTitle} description={copy.warning} />
          {impact != null && (
            <Alert
              tone={AlertTone.Warning}
              icon={<ExclamationIcon size={16} color={"currentColor"} />}
              title={IDENTITY_KEY_DASHPAY_IMPACT_COPY[impact].title}
              description={IDENTITY_KEY_DASHPAY_IMPACT_COPY[impact].description}
            />
          )}
          <TxSummary
            unit={"credits"}
            from={{ value: identityLabel(identity), kind: TxEndpointKind.Label, paysFee: true }}
            to={changes}
            toLabel={IDENTITY_KEY_UPDATE_LABELS.changes}
            fees={[{ label: IDENTITY_KEY_UPDATE_LABELS.fee, amount: feeCredits, unit: 'credits' }]}
            total={feeCredits}
            details={[
              { label: KEYS_SIGNED_COPY.identityBalance, amount: balance, unit: 'credits' },
              { label: KEYS_SIGNED_COPY.balanceAfter, amount: feeCredits == null ? null : balance - feeCredits, unit: 'credits' },
            ]}
          />
        </div>
      }
      shortfall={shortfall && <ShortfallNotice shortfall={shortfall} identity={identity} onRetry={fee.retry} />}
      confirmLabel={copy.submit}
      confirmDisabled={feeCredits == null || shortfall != null}
      pendingLabel={copy.pending}
      run={run}
      renderDone={result => ({
        headline: copy.done,
        hash: {
          value: result.stHash,
          label: KEYS_SIGNED_COPY.hashLabel,
          explorerUrl: network ? platformTransactionUrl(result.stHash, network) : null,
        },
      })}
    />
  )
}
