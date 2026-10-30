import { useParams } from 'react-router-dom'
import AddKeys from '@renderer/components/pages/identities/addKeys/AddKeys'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function IdentityAddKeysPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const { identifier } = useParams()
  const walletId = status?.selectedWalletId
  if (walletId == null || identifier == null) return null
  return <AddKeys key={walletId} walletId={walletId} identifier={identifier} />
}
