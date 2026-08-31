import { useState } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'

export default function AddAddressSection({ walletId, kind }: { walletId: string | undefined, kind: 'receiving' | 'change' | 'platform' }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Every address here is public derivation off a persisted account xpub, so
  // none of them asks for the password.
  const handleAdd = async (): Promise<void> => {
    if (!walletId || busy) return
    setBusy(true)
    setError(null)
    try {
      if (kind === 'platform') {
        await API.addPlatformAddress(walletId)
        invalidateAsyncCache('platformAddresses', walletId)
      } else {
        await API.addWalletAddress(walletId, kind === 'change')
        invalidateAsyncCache('addresses', walletId)
      }
      refreshBalance(walletId)
    } catch {
      setError(`Could not derive a new ${kind === 'platform' ? 'platform ' : ''}address. Please try again.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={"flex flex-col gap-2 items-start"}>
      {error && <Text size={12} weight={"medium"} color={"red"}>{error}</Text>}
      <Button
        type={"button"}
        onClick={handleAdd}
        disabled={!walletId || busy}
        variant={"solid"}
        colorScheme={"primary"}
        size={"sm"}
        className={"min-h-0! py-2! rounded-[.75rem]"}
      >
        {busy ? 'Deriving…' : 'New address'}
      </Button>
    </div>
  )
}
