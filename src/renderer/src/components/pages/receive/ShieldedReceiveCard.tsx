import { useEffect, useMemo, useState } from 'react'
import { Button, Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import PasswordField from '@renderer/components/ui/PasswordField'
import ShieldedAddressSelect from '@renderer/components/pages/transfer/ShieldedAddressSelect'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import ShieldedNotesAlert from '@renderer/components/ui/ShieldedNotesAlert'
import ReceiveQr from './ReceiveQr'
import { useAuth } from '@renderer/contexts/AuthContext'
import { defaultReceiveShieldedAddress, receiveShieldedAddresses } from '@renderer/utils/receiveDefaults'
import { shieldedBalancesByAddress } from '@renderer/utils/shieldedBalances'
import { API } from '@renderer/api'
import { addressFormCopy, INVALID_WALLET_PASSWORD_MESSAGE, receiveCardCopy } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SHIELDED_RECEIVE_CARD_WIDTH } from '@renderer/constants/receiveCard'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'

export default function ShieldedReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const { status } = useAuth()

  const sync = useShieldedSyncState(walletId)
  const synced = sync.phase === ShieldedSyncPhase.Done
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const balances = useMemo(() => shieldedBalancesByAddress(sync.notes), [sync.notes])

  useEffect(() => {
    setAddresses(null)
    setSelectedAddress(null)
    setPassword('')
    setError(null)
    if (!walletId) {
      setChecking(false)
      return
    }
    let dead = false
    setChecking(true)
    API.getShieldedAddresses(walletId)
      .then((cached) => { if (!dead) setAddresses(cached?.length ? cached : null) })
      .catch(() => { /* fall through to unlock form */ })
      .finally(() => { if (!dead) setChecking(false) })
    return () => { dead = true }
  }, [walletId])

  const handleAddAddress = async (): Promise<void> => {
    if (!walletId || password.length === 0 || revealing) return
    setRevealing(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      const nextAddresses = await API.addShieldedAddress(walletId, password)
      setAddresses(nextAddresses)
      setSelectedAddress(defaultReceiveShieldedAddress(nextAddresses, balances) ?? null)
      setPassword('')
    } catch {
      setError(addressFormCopy.addFailed)
    } finally {
      setRevealing(false)
    }
  }

  const handlePasswordChange = (value: string): void => {
    setError(null)
    setPassword(value)
  }

  if (checking) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (addresses !== null && !synced) {
    return (
      <>
        <ShieldedNotesAlert walletId={walletId} onSync={() => setSyncOpen(true)} syncing={syncRunning} required />
        <ShieldedUnlockModal
          isOpen={syncOpen}
          onClose={() => setSyncOpen(false)}
          walletId={walletId ?? null}
        />
      </>
    )
  }

  if (addresses !== null) {
    const receiveAddresses = receiveShieldedAddresses(addresses, balances)
    if (receiveAddresses.length === 0) {
      return (
        <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={"flex items-center gap-2"}>
            <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={14} weight={"extrabold"} color={"brand"}>New shielded address</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            {receiveCardCopy.allShieldedFunded}
          </Text>
          <PasswordField
            id={"shielded-new-address-password"}
            value={password}
            onChange={handlePasswordChange}
            onSubmit={handleAddAddress}
            error={error}
            disabled={revealing}
            autoFocus={false}
          />
          <Button
            type={"button"}
            onClick={handleAddAddress}
            disabled={password.length === 0 || revealing}
            variant={"solid"}
            colorScheme={"primary"}
            size={"compact"}
            className={"self-start"}
          >
            {revealing ? receiveCardCopy.generating : 'Generate address'}
          </Button>
        </div>
      )
    }

    const selected = selectedAddress != null && receiveAddresses.includes(selectedAddress)
      ? selectedAddress
      : defaultReceiveShieldedAddress(receiveAddresses, balances)!

    return (
      <>
        <div className={`flex flex-col gap-4 ${SHIELDED_RECEIVE_CARD_WIDTH}`}>
        <ShieldedNotesAlert walletId={walletId} onSync={() => setSyncOpen(true)} syncing={syncRunning} />
        <div className={`flex w-full items-center gap-8 ${SURFACE_SECTION}`}>
          <ReceiveQr
            value={selected}
            invoice={{
              addressLabel: RECEIVE_INVOICE_ADDRESS_LABELS.shielded,
              address: selected,
              amount: null,
              paymentLink: null,
              network: status?.network ?? null,
            }}
          />

          <div className={"flex min-w-0 flex-1 flex-col"}>
            <div className={"flex min-w-0 flex-col gap-[.5rem]"}>
              <div className={"flex items-center gap-2"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  Shielded Address
                </Text>
                <CustomBadge
                  variant={"accent"}
                  text={receiveCardCopy.privateChip}
                  icon={<ShieldSmallIcon size={12} className={"text-dash-brand dark:text-dash-mint"} />}
                />
              </div>
              <div className={"flex min-w-0 items-center gap-[.625rem]"}>
                <ShieldedAddressSelect
                  addresses={receiveAddresses}
                  balances={synced ? balances : undefined}
                  selected={selected}
                  onSelect={setSelectedAddress}
                />
                <CopyButton text={selected} />
              </div>
            </div>
          </div>
        </div>
        </div>

        <ShieldedUnlockModal
          isOpen={syncOpen}
          onClose={() => setSyncOpen(false)}
          walletId={walletId ?? null}
        />
      </>
    )
  }

  const handleReveal = async (): Promise<void> => {
    if (!walletId || password.length === 0 || revealing) return
    setRevealing(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      setAddresses(await API.getShieldedAddresses(walletId, password))
      setPassword('')
    } catch {
      setError(receiveCardCopy.loadFailed)
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
      <div className={"flex items-center gap-2"}>
        <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={14} weight={"extrabold"} color={"brand"}>Shielded address</Text>
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
        {receiveCardCopy.shieldedUnlockPrompt}
      </Text>
      <PasswordField
        id={"shielded-receive-password"}
        value={password}
        onChange={handlePasswordChange}
        onSubmit={handleReveal}
        error={error}
        disabled={revealing}
        autoFocus={false}
      />
      <Button
        type={"button"}
        onClick={handleReveal}
        disabled={!walletId || password.length === 0 || revealing}
        variant={"solid"}
        colorScheme={"primary"}
        size={"compact"}
        className={"self-start"}
      >
        {revealing ? addressFormCopy.loading : receiveCardCopy.showAddress}
      </Button>
    </div>
  )
}
