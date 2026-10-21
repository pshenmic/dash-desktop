import { useState } from 'react'
import { Button, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { addressFormCopy, INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'

export default function PlatformUnlockTab({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const handleUnlock = async (): Promise<void> => {
    if (!walletId || password.length === 0 || unlocking) return
    setUnlocking(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      setPassword('')
      invalidateAsyncCache('platformAddresses', walletId)
    } catch {
      setError(addressFormCopy.loadFailed)
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className={"flex flex-col gap-3 p-5 rounded-[.9375rem] dash-block max-w-115"}>
      <Text size={14} weight={"extrabold"} color={"brand"}>Platform addresses</Text>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
        {addressFormCopy.platformPrompt}
      </Text>
      <Input
        id={"platform-addresses-password"}
        type={"password"}
        placeholder={"Wallet password"}
        value={password}
        variant={"outlined"}
        onChange={(e) => {
          setError(null)
          setPassword(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleUnlock()
        }}
        className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
        colorScheme={error ? 'error' : 'primary'}
        disabled={unlocking}
      />
      {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
      <Button
        type={"button"}
        onClick={handleUnlock}
        disabled={!walletId || password.length === 0 || unlocking}
        variant={"solid"}
        colorScheme={"primary"}
        size={"sm"}
        className={"min-h-0! py-2! rounded-[.75rem] self-start"}
      >
        {unlocking ? addressFormCopy.loading : addressFormCopy.showAddresses}
      </Button>
    </div>
  )
}
