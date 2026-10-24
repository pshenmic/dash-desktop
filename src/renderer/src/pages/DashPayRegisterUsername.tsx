import RegisterUsername from '@renderer/components/pages/dashpay/register/RegisterUsername'
import { useAuth } from '@renderer/contexts/AuthContext'

export default function DashPayRegisterUsernamePage(): React.JSX.Element | null {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId
  if (walletId == null) return null
  return <RegisterUsername key={walletId} walletId={walletId} />
}
