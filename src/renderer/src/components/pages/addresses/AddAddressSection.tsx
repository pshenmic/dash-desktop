import { useState } from 'react'
import { Button, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'

export default function AddAddressSection({ walletId, kind }: { walletId: string | undefined, kind: 'receiving' | 'change' | 'platform' }): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleAddPlatform = async (): Promise<void> => {
    if (!walletId || busy) return
    setBusy(true)
    setError(null)
    try {
      await API.addPlatformAddress(walletId)
      invalidateAsyncCache('platformAddresses', walletId)
    } catch {
      setError('Could not derive a new platform address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleAddL1 = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError('Incorrect password. Please try again.')
        return
      }
      await API.addWalletAddress(walletId, password, kind === 'change')
      invalidateAsyncCache('addresses', walletId)
      setPassword('')
      setShowForm(false)
    } catch {
      setError('Could not derive a new address. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (kind === 'platform') {
    return (
      <div className={"flex flex-col gap-2 items-start"}>
        {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
        <Button
          type={"button"}
          onClick={handleAddPlatform}
          disabled={!walletId || busy}
          variant={"solid"}
          colorScheme={"primary"}
          size={"md"}
          className={"rounded-[.9375rem]"}
        >
          {busy ? 'Deriving…' : 'New address'}
        </Button>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className={"flex flex-col gap-2 items-start"}>
        <Button
          type={"button"}
          onClick={() => setShowForm(true)}
          disabled={!walletId}
          variant={"solid"}
          colorScheme={"primary"}
          size={"md"}
          className={"rounded-[.9375rem]"}
        >
          New address
        </Button>
      </div>
    )
  }

  return (
    <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block max-w-115"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
        Enter your wallet password to derive a new {kind === 'change' ? 'change' : 'receiving'} address.
      </Text>
      <Input
        id={`add-${kind}-address-password`}
        type={"password"}
        placeholder={"Wallet password"}
        value={password}
        variant={"outlined"}
        onChange={(e) => {
          setError(null)
          setPassword(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAddL1()
        }}
        className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
        colorScheme={error ? 'error' : 'primary'}
        disabled={busy}
      />
      {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
      <Button
        type={"button"}
        onClick={handleAddL1}
        disabled={!walletId || password.length === 0 || busy}
        variant={"solid"}
        colorScheme={"primary"}
        size={"md"}
        className={"rounded-[.9375rem]"}
      >
        {busy ? 'Deriving…' : 'Add address'}
      </Button>
    </div>
  )
}
