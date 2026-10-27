import { useState } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-extended'
import PasswordField from '@renderer/components/ui/PasswordField'
import { API } from '@renderer/api'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { addressFormCopy, INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'

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
    <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
      <Text size={14} weight={"extrabold"} color={"brand"}>Platform addresses</Text>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
        {addressFormCopy.platformPrompt}
      </Text>
      <PasswordField
        id={"platform-addresses-password"}
        value={password}
        onChange={(value) => {
          setError(null)
          setPassword(value)
        }}
        onSubmit={handleUnlock}
        error={error}
        disabled={unlocking}
        autoFocus={false}
      />
      <Button
        type={"button"}
        onClick={handleUnlock}
        disabled={!walletId || password.length === 0 || unlocking}
        variant={"solid"}
        colorScheme={"primary"}
        size={"compact"}
        className={"self-start"}
      >
        {unlocking ? addressFormCopy.loading : addressFormCopy.showAddresses}
      </Button>
    </div>
  )
}
