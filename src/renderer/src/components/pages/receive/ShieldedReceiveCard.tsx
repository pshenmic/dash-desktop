import { useEffect, useState } from 'react'
import { Button, Input, Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-enxtended'
import CopyButton from '@renderer/components/ui/CopyButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { API } from '@renderer/api'

export default function ShieldedReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [address, setAddress] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)

  useEffect(() => {
    setAddress(null)
    setPassword('')
    setError(null)
    if (!walletId) {
      setChecking(false)
      return
    }
    let dead = false
    setChecking(true)
    API.getShieldedAddress(walletId)
      .then((cached) => { if (!dead) setAddress(cached) })
      .catch(() => { /* fall through to unlock form */ })
      .finally(() => { if (!dead) setChecking(false) })
    return () => { dead = true }
  }, [walletId])

  if (checking) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (address !== null) {
    return (
      <div className={"flex flex-col gap-3 p-6 rounded-4xl dash-block max-w-190"}>
        <div className={"flex items-center gap-2"}>
          <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={14} weight={"extrabold"} color={"brand"}>Shielded address</Text>
        </div>
        <div className={"flex items-center gap-[.625rem]"}>
          <Text size={14} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all"}>
            {address}
          </Text>
          <CopyButton text={address} />
        </div>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
          Share this address to receive private funds — incoming payments reveal nothing about sender, recipient or amount on-chain. It is safe to reuse.
        </Text>
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
      setAddress(await API.getShieldedAddress(walletId, password))
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
        size={"md"}
        className={"rounded-[.9375rem]"}
      >
        {revealing ? 'Deriving…' : 'Reveal address'}
      </Button>
    </div>
  )
}
