import { Outlet } from 'react-router-dom'
import { useAuth } from '@renderer/contexts/AuthContext'
import { DashpayDemoProvider } from '@renderer/contexts/DashpayDemoContext'

export default function DemoLayout(): React.JSX.Element {
  const { status } = useAuth()
  return <DashpayDemoProvider key={`${status?.selectedWalletId ?? ''}:${status?.network ?? ''}`}><Outlet /></DashpayDemoProvider>
}
