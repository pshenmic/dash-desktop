import { Navigate, Route, Routes, useLocation } from "react-router-dom"
import DashboardPage from "./pages/Dashboard"
import TransactionsPage from "./pages/Transactions"
import SendPage from "./pages/Send"
import Sidebar from "./components/sidebar"
import LoginPage from "./pages/auth/Login"
import ForgotPasswordPage from "./pages/auth/ForgotPassword"
import Layout from "./components/Layout"
import CreateWalletWrapper from "./pages/auth/CreateWalletWrapper"
import ReceivePage from "./pages/Receive"
import ShieldedPage from "./pages/Shielded"
import IdentitiesPage from "./pages/Identities"
import IdentityRegistrationPage from "./pages/IdentityRegistration"
import AddressesPage from "./pages/Addresses"
import SettingsPage from "./pages/Settings"
import LogsPage from "./pages/Logs"
import { useAuth } from "./contexts/AuthContext"
import { useDebugMode } from "./hooks/useDebugMode"
import { ConnectionModeProvider } from "./contexts/ConnectionModeContext"
import { LOCK_FADE_MS } from "./constants"

function App(): React.JSX.Element {
  const { isAuthenticated, isLockingOut } = useAuth()
  const location = useLocation()
  const debugMode = useDebugMode()

  if (location.pathname === '/create-wallet') {
    return (
      <Routes>
        <Route path="/create-wallet" element={<CreateWalletWrapper />} />
      </Routes>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <ConnectionModeProvider>
      <div
        className={`flex transition-opacity ease-out ${isLockingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{ transitionDuration: `${LOCK_FADE_MS}ms` }}
      >
        <Sidebar />
        <Layout>
          <Routes>
            <Route path={"/"} element={<DashboardPage />} />
            <Route path={"/transactions"} element={<TransactionsPage />} />
            <Route path={"/send"} element={<SendPage />} />
            <Route path={"/receive"} element={<ReceivePage />} />
            <Route path={"/shielded"} element={debugMode ? <ShieldedPage /> : <Navigate to={"/"} replace />} />
            <Route path={"/shield"} element={<Navigate to={"/send?from=platformAddress&to=shielded"} replace />} />
            <Route path={"/send-private"} element={<Navigate to={"/send?from=shielded&to=shielded"} replace />} />
            <Route path={"/unshield"} element={<Navigate to={"/send?from=shielded&to=platformAddress"} replace />} />
            <Route path={"/withdraw-l1"} element={<Navigate to={"/send?from=shielded&to=coreAddress"} replace />} />
            <Route path={"/addresses"} element={<AddressesPage />} />
            <Route path={"/identities"} element={<IdentitiesPage />} />
            <Route path={"/identities/register"} element={<IdentityRegistrationPage />} />
            <Route path={"/settings"} element={<SettingsPage />} />
            <Route path={"/settings/logs"} element={<LogsPage />} />
          </Routes>
        </Layout>
      </div>
    </ConnectionModeProvider>
  )
}

export default App
