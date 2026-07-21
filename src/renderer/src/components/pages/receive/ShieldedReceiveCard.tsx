import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { useTheme } from 'dash-ui-kit/react'
import { Button, Input, Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import ShieldedAddressSelect from '@renderer/components/pages/transfer/ShieldedAddressSelect'
import { defaultReceiveShieldedAddress } from '@renderer/utils/receiveDefaults'
import { shieldedBalancesByAddress } from '@renderer/utils/shieldedBalances'
import { API } from '@renderer/api'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'

export default function ShieldedReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const { theme } = useTheme()

  const sync = useShieldedSyncState(walletId)
  const synced = sync.phase === ShieldedSyncPhase.Done
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

  if (checking) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (addresses !== null) {
    const selected = selectedAddress != null && addresses.includes(selectedAddress)
      ? selectedAddress
      : defaultReceiveShieldedAddress(addresses, balances) ?? addresses[0]
    const qrCodeColor = theme === 'dark' ? 'white' : 'var(--color-dash-brand)'

    return (
      <div className={"flex items-center gap-8 rounded-4xl dash-block p-6 max-w-190"}>
        <QRCode
          value={selected}
          size={225}
          fgColor={qrCodeColor}
          bgColor={"transparent"}
          className={"rounded-[.5625rem] shrink-0"}
        />

        <div className={"flex flex-col w-full min-w-0"}>
          <div className={"flex flex-col gap-[.5rem]"}>
            <Text size={12} weight={"normal"} color={"brand"} opacity={50}>
              Shielded Address
            </Text>
            <div className={"flex items-center gap-[.625rem]"}>
              <div className={"flex-1 min-w-0"}>
                <ShieldedAddressSelect
                  addresses={addresses}
                  balances={synced ? balances : undefined}
                  selected={selected}
                  onSelect={setSelectedAddress}
                />
              </div>
              <CopyButton text={selected} />
            </div>
          </div>

          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-8"}>
            Share this address to receive private funds — incoming payments reveal nothing about sender, recipient or amount on-chain. It is safe to reuse.
          </Text>
        </div>
      </div>
    )
  }

  const handleReveal = async (): Promise<void> => {
    if (!walletId || password.length === 0 || revealing) return
    setRevealing(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError('Incorrect password. Please try again.')
        return
      }
      setAddresses(await API.getShieldedAddresses(walletId, password))
      setPassword('')
    } catch {
      setError('Could not derive the shielded address. Please try again.')
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block max-w-115"}>
      <div className={"flex items-center gap-2"}>
        <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={14} weight={"extrabold"} color={"brand"}>Shielded address</Text>
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
        Your shielded address is derived from your seed. Enter your wallet password to reveal it. Your seed never leaves this device.
      </Text>
      <Input
        id={"shielded-receive-password"}
        type={"password"}
        placeholder={"Wallet password"}
        value={password}
        variant={"outlined"}
        onChange={(e) => {
          setError(null)
          setPassword(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleReveal()
        }}
        className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
        colorScheme={error ? 'error' : 'primary'}
        disabled={revealing}
      />
      {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
      <Button
        type={"button"}
        onClick={handleReveal}
        disabled={!walletId || password.length === 0 || revealing}
        variant={"solid"}
        colorScheme={"primary"}
        size={"sm"}
        className={"min-h-0! py-2! rounded-[.75rem] self-start"}
      >
        {revealing ? 'Deriving…' : 'Reveal address'}
      </Button>
    </div>
  )
}
