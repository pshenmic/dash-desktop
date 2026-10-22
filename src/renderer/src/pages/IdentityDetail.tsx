import { useParams } from 'react-router-dom'
import IdentityDetail from '@renderer/components/pages/identities/IdentityDetail'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function IdentityDetailPage(): React.JSX.Element | null {
  const { status } = useAuth()
  const { identifier } = useParams()
  const walletId = status?.selectedWalletId
  if (walletId == null || identifier == null) return null
  return <IdentityDetail key={walletId} walletId={walletId} identifier={identifier} />
}
