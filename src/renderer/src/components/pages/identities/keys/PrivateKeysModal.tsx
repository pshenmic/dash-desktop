import { useEffect, useMemo, useState } from 'react'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { ExclamationIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import Alert from '@renderer/components/ui/Alert'
import HashField from '@renderer/components/ui/HashField'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'
import StatusPill from '@renderer/components/ui/StatusPill'
import { API } from '@renderer/api'
import type { IdentityPrivateKeyDto } from '@renderer/api/types'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { IDENTITY_KEYS_COPY, PRIVATE_KEYS_COPY } from '@renderer/constants/identityKeys'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { PrivateKeysModalProps } from '@renderer/types/IdentityKeys'
import { getErrorMessage } from '@renderer/utils/error'
import { isIdentityKeyActive } from '@renderer/utils/identities'
import { identityKeyLabel } from '@renderer/utils/identityKeyRequests'
import { sortedIdentityKeys } from '@renderer/utils/identityKeySetup'

export default function PrivateKeysModal({ open, onClose, walletId, identity }: PrivateKeysModalProps): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [privateKeys, setPrivateKeys] = useState<IdentityPrivateKeyDto[] | null>(null)
  const keys = useMemo(() => sortedIdentityKeys(identity.keys), [identity.keys])

  useEffect(() => {
    setPassword('')
    setError(null)
    setLoading(false)
    setPrivateKeys(null)
  }, [open, identity.identifier])

  const reveal = async (): Promise<void> => {
    if (password.length === 0 || loading) return
    setLoading(true)
    setError(null)
    try {
      if (!await API.verifyWalletPassword(walletId, password)) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      setPrivateKeys(await API.getIdentityPrivateKeys(walletId, identity.identifier, password))
      setPassword('')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={PRIVATE_KEYS_COPY.title} size={ModalSize.Lg} dismissible={!loading}>
      <Alert
        tone={AlertTone.Warning}
        icon={<ExclamationIcon size={16} color={"currentColor"} />}
        title={PRIVATE_KEYS_COPY.warningTitle}
        description={PRIVATE_KEYS_COPY.warning}
        className={"mt-4"}
      />
      {privateKeys == null ? (
        <div className={"phase-fade-in"} key={"password"}>
          <PasswordField
            id={"identity-private-keys-password"}
            value={password}
            onChange={value => { setError(null); setPassword(value) }}
            onSubmit={reveal}
            error={error}
            disabled={loading}
            className={"mt-4.5"}
          />
          <ModalActions
            secondary={{ label: PRIVATE_KEYS_COPY.cancel, onClick: onClose, disabled: loading }}
            primary={{ label: loading ? PRIVATE_KEYS_COPY.revealing : PRIVATE_KEYS_COPY.reveal, onClick: reveal, disabled: password.length === 0 || loading }}
          />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"keys"}>
          <div className={"mt-4 flex flex-col gap-3"}>
            {keys.map(key => {
              const privateKey = privateKeys.find(entry => entry.keyId === key.keyId)
              return (
                <div key={key.keyId} className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
                  <div className={"flex items-center justify-between gap-3"}>
                    <Text size={14} weight={"medium"} color={"brand"}>{identityKeyLabel(key)}</Text>
                    {!isIdentityKeyActive(key) && <StatusPill tone={StatusPillTone.Inactive}>{IDENTITY_KEYS_COPY.disabled}</StatusPill>}
                  </div>
                  {privateKey == null ? (
                    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{PRIVATE_KEYS_COPY.notDerived}</Text>
                  ) : (
                    <>
                      <HashField hash={privateKey.wif} label={PRIVATE_KEYS_COPY.wif} copyOnClick={false} />
                      <HashField hash={privateKey.hex} label={PRIVATE_KEYS_COPY.hex} copyOnClick={false} />
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <ModalActions primary={{ label: PRIVATE_KEYS_COPY.close, onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
