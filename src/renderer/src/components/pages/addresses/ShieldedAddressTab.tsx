import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import { API } from '@renderer/api'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'

export default function ShieldedAddressTab({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [unlockedPassword, setUnlockedPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  const [syncModalOpen, setSyncModalOpen] = useState(false)

  const sync = useShieldedSyncState(walletId)
  const synced = sync.phase === 'done'
  const syncRunning = sync.phase === 'syncing' || sync.phase === 'recovering'
  const balances = useMemo(() => {
    const map = new Map<string, bigint>()
    for (const note of sync.notes) {
      if (note.spent) continue
      map.set(note.address, (map.get(note.address) ?? 0n) + BigInt(note.amount))
    }
    return map
  }, [sync.notes])

  useEffect(() => {
    setAddresses(null)
    setPassword('')
    setUnlockedPassword(null)
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

  const withPassword = async (action: (pwd: string) => Promise<void>): Promise<void> => {
    if (!walletId || password.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError('Incorrect password. Please try again.')
        return
      }
      await action(password)
      setUnlockedPassword(password)
      setPassword('')
      setShowPasswordForm(false)
    } catch {
      setError('Could not derive shielded addresses. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleReveal = (): Promise<void> => withPassword(async (pwd) => {
    setAddresses(await API.getShieldedAddresses(walletId!, pwd))
  })

  const handleConfirmAdd = (): Promise<void> => withPassword(async (pwd) => {
    setAddresses(await API.addShieldedAddress(walletId!, pwd))
  })

  const handleSync = async (): Promise<void> => {
    if (!walletId || syncRunning) return
    if (unlockedPassword == null) {
      setSyncModalOpen(true)
      return
    }
    setError(null)
    try {
      await API.startShieldedSync(walletId, unlockedPassword)
    } catch {
      setError('Could not start sync. Please try again.')
    }
  }

  const handleNewAddress = async (): Promise<void> => {
    if (!walletId || busy) return
    if (unlockedPassword == null) {
      setShowPasswordForm(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setAddresses(await API.addShieldedAddress(walletId, unlockedPassword))
    } catch {
      setError('Could not derive a new shielded address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const passwordInput = (onSubmit: () => void, id: string): React.JSX.Element => (
    <>
      <Input
        id={id}
        type={"password"}
        placeholder={"Wallet password"}
        value={password}
        variant={"outlined"}
        onChange={(e) => {
          setError(null)
          setPassword(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
        colorScheme={error ? 'error' : 'primary'}
        disabled={busy}
      />
      {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
    </>
  )

  if (checking) {
    return <ListSkeleton rows={3} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (addresses === null) {
    return (
      <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block max-w-115"}>
        <div className={"flex items-center gap-2"}>
          <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={14} weight={"extrabold"} color={"brand"}>Shielded addresses</Text>
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          Your shielded addresses are derived from your seed. Enter your wallet password to reveal them. Your seed never leaves this device.
        </Text>
        {passwordInput(handleReveal, 'shielded-addresses-password')}
        <Button
          type={"button"}
          onClick={handleReveal}
          disabled={!walletId || password.length === 0 || busy}
          variant={"solid"}
          colorScheme={"primary"}
          size={"md"}
          className={"rounded-[.9375rem]"}
        >
          {busy ? 'Deriving…' : 'Reveal addresses'}
        </Button>
      </div>
    )
  }

  return (
    <div className={"flex flex-col gap-[.625rem]"}>
      {addresses.map((address) => (
        <div key={address} className={"flex items-center justify-between gap-4 px-[.9375rem] py-[.625rem] rounded-[.875rem] dash-block"}>
          <div className={"flex items-center gap-2 min-w-0"}>
            <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
            <Text size={12} weight={"medium"} color={"brand"} className={"font-mono break-all"}>
              {address}
            </Text>
            <CopyButton text={address} />
          </div>
          <div className={"flex items-center gap-2 shrink-0"}>
            {synced ? (
              <Text size={14} weight={"medium"} color={"brand"}>
                <CreditsAmount credits={balances.get(address) ?? 0n} compact unit={"Credits"} align={"end"} amountClassName={"font-bold"} />
              </Text>
            ) : (
              <Text size={12} weight={"medium"} color={"brand"} opacity={40}>—</Text>
            )}
          </div>
        </div>
      ))}
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
        Your Orchard shielded addresses. All of them receive into the same private balance — share any of them; incoming payments reveal nothing about sender, recipient or amount on-chain.
        {!synced && !syncRunning && ' Sync your notes to see per-address balances.'}
      </Text>
      {showPasswordForm ? (
        <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block max-w-115"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            Enter your wallet password to derive a new shielded address.
          </Text>
          {passwordInput(handleConfirmAdd, 'shielded-add-password')}
          <Button
            type={"button"}
            onClick={handleConfirmAdd}
            disabled={!walletId || password.length === 0 || busy}
            variant={"solid"}
            colorScheme={"primary"}
            size={"md"}
            className={"rounded-[.9375rem]"}
          >
            {busy ? 'Deriving…' : 'Add address'}
          </Button>
        </div>
      ) : (
        <div className={"flex flex-col gap-2 items-start"}>
          {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
          {sync.phase === 'error' && (
            <Text size={12} weight={"medium"} color={"red"}>{sync.error ?? 'Note sync failed.'}</Text>
          )}
          <div className={"flex items-center gap-2"}>
            <Button
              type={"button"}
              onClick={handleNewAddress}
              disabled={!walletId || busy}
              variant={"solid"}
              colorScheme={"primary"}
              size={"md"}
              className={"rounded-[.9375rem]"}
            >
              {busy ? 'Deriving…' : 'New address'}
            </Button>
            <Button
              type={"button"}
              onClick={handleSync}
              disabled={!walletId || syncRunning}
              variant={"solid"}
              colorScheme={"lightBlue-mint"}
              size={"md"}
              className={"rounded-[.9375rem]"}
            >
              {syncRunning ? 'Syncing…' : synced ? 'Re-sync notes' : 'Sync notes'}
            </Button>
            {syncRunning && (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                {sync.phase === 'recovering'
                  ? 'Recovering your notes…'
                  : sync.total > 0
                    ? `Syncing notes ${sync.fetched.toLocaleString('en-US')} / ${sync.total.toLocaleString('en-US')}`
                    : 'Syncing notes…'}
              </Text>
            )}
          </div>
        </div>
      )}
      <ShieldedUnlockModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        walletId={walletId ?? null}
      />
    </div>
  )
}
