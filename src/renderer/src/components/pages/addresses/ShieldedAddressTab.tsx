import { useEffect, useMemo, useState } from 'react'
import { Button, Text, ShieldSmallIcon, InfoTooltip, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import AddressRow from '@renderer/components/ui/AddressRow'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import PasswordField from '@renderer/components/ui/PasswordField'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import ShieldedNotesAlert from '@renderer/components/ui/ShieldedNotesAlert'
import { API } from '@renderer/api'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import { shieldedBalancesByAddress } from '@renderer/utils/shieldedBalances'
import { creditsToDuffs } from '@renderer/utils/balance'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import {
  addressesPage,
  addressFormCopy,
  INVALID_WALLET_PASSWORD_MESSAGE,
  SHIELDED_BALANCE_UNKNOWN_TOOLTIP,
} from '@renderer/constants'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'

export default function ShieldedAddressTab({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)

  const sync = useShieldedSyncState(walletId)
  const { isBalanceVisible } = useBalanceVisibility()
  const synced = sync.phase === ShieldedSyncPhase.Done
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const balances = useMemo(() => shieldedBalancesByAddress(sync.notes), [sync.notes])

  useEffect(() => {
    setAddresses(null)
    setPassword('')
    setError(null)
    setShowPasswordForm(false)
    if (!walletId) {
      setChecking(false)
      return
    }
    let dead = false
    setChecking(true)
    API.getShieldedAddresses(walletId)
      .then((cached) => { if (!dead) setAddresses(cached) })
      .catch(() => { /* fall through to unlock form */ })
      .finally(() => { if (!dead) setChecking(false) })
    return () => { dead = true }
  }, [walletId])

  const withPassword = async (action: (pwd: string) => Promise<void>, failureMessage: string): Promise<void> => {
    if (!walletId || password.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      await action(password)
      setPassword('')
      setShowPasswordForm(false)
    } catch {
      setError(failureMessage)
    } finally {
      setBusy(false)
    }
  }

  const handleReveal = (): Promise<void> => withPassword(async (pwd) => {
    setAddresses(await API.getShieldedAddresses(walletId!, pwd))
    if (!synced && !syncRunning) {
      API.startShieldedSync(walletId!, pwd).catch(() => {})
    }
  }, addressFormCopy.loadFailed)

  const handleConfirmAdd = (): Promise<void> => withPassword(async (pwd) => {
    setAddresses(await API.addShieldedAddress(walletId!, pwd))
  }, addressFormCopy.addFailed)

  // Every reveal derives from the seed, so every reveal asks. Nothing holds the
  // password between clicks — L1 and platform addresses need no password at all,
  // and shielded is the one class that cannot borrow that.
  const handleNewAddress = (): void => {
    if (!walletId || busy) return
    setError(null)
    setShowPasswordForm(true)
  }

  const handlePasswordChange = (value: string): void => {
    setError(null)
    setPassword(value)
  }

  if (checking) {
    return <ListSkeleton rows={3} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (addresses === null) {
    return (
      <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={"flex items-center gap-2"}>
          <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={14} weight={"extrabold"} color={"brand"}>Shielded addresses</Text>
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          {addressFormCopy.shieldedPrompt}
        </Text>
        <PasswordField
          id={"shielded-addresses-password"}
          value={password}
          onChange={handlePasswordChange}
          onSubmit={handleReveal}
          error={error}
          disabled={busy}
          autoFocus={false}
        />
        <Button
          type={"button"}
          onClick={handleReveal}
          disabled={!walletId || password.length === 0 || busy}
          variant={"solid"}
          colorScheme={"primary"}
          size={"compact"}
          className={"self-start"}
        >
          {busy ? addressFormCopy.loading : addressFormCopy.showAddresses}
        </Button>
      </div>
    )
  }

  return (
    <>
    <div className={"flex flex-col gap-[.625rem]"}>
      <ShieldedNotesAlert walletId={walletId} onSync={() => setSyncOpen(true)} syncing={syncRunning} />
      {addresses.map((address) => {
        const credits = balances.get(address) ?? 0n
        return (
          <AddressRow
            key={address}
            address={address}
            leading={<ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />}
            amount={synced ? (
              <CreditsAmount credits={credits} compact unit={"Credits"} showFiat={false} align={"end"} amountClassName={"font-bold"} />
            ) : (
              <Tooltip label={SHIELDED_BALANCE_UNKNOWN_TOOLTIP}>
                <span>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={40}>—</Text>
                </span>
              </Tooltip>
            )}
            fiatDuffs={synced ? creditsToDuffs(credits) : null}
            hidden={synced && !isBalanceVisible}
          />
        )
      })}
      {showPasswordForm ? (
        <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
          <PasswordField
            id={"shielded-add-password"}
            value={password}
            onChange={handlePasswordChange}
            onSubmit={handleConfirmAdd}
            error={error}
            disabled={busy}
            autoFocus={false}
          />
          <Button
            type={"button"}
            onClick={handleConfirmAdd}
            disabled={!walletId || password.length === 0 || busy}
            variant={"solid"}
            colorScheme={"primary"}
            size={"compact"}
            className={"self-start"}
          >
            {busy ? addressFormCopy.adding : 'Add address'}
          </Button>
        </div>
      ) : (
        <div className={"flex flex-col gap-2 items-start"}>
          {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
          {sync.phase === ShieldedSyncPhase.Error && (
            <Text size={12} weight={"medium"} color={"red"}>{sync.error ?? 'Note sync failed.'}</Text>
          )}
          <div className={"flex items-center gap-2"}>
            <Button
              type={"button"}
              onClick={handleNewAddress}
              disabled={!walletId || busy}
              variant={"solid"}
              colorScheme={"primary"}
              size={"compact"}
            >
              {busy ? addressFormCopy.adding : 'New address'}
            </Button>
            <InfoTooltip content={addressesPage.shieldedSharedBalance} />
            {syncRunning && (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                {sync.phase === ShieldedSyncPhase.Recovering
                  ? 'Recovering your notes…'
                  : sync.total > 0
                    ? `Syncing notes ${sync.fetched.toLocaleString('en-US')} / ${sync.total.toLocaleString('en-US')}`
                    : 'Syncing notes…'}
              </Text>
            )}
          </div>
        </div>
      )}
    </div>
    <ShieldedUnlockModal
      isOpen={syncOpen}
      onClose={() => setSyncOpen(false)}
      walletId={walletId ?? null}
    />
    </>
  )
}
