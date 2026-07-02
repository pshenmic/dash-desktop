import { Route, Routes, useLocation } from "react-router-dom"
import DashboardPage from "./pages/Dashboard"
import TransactionsPage from "./pages/Transactions"
import SendPage from "./pages/Send"
import Sidebar from "./components/sidebar"
import LoginPage from "./pages/auth/Login"
import Layout from "./components/Layout"
import CreateWalletWrapper from "./pages/auth/CreateWalletWrapper"
import ReceivePage from "./pages/Receive"
import ShieldPage from "./pages/Shield"
import ShieldedPage from "./pages/Shielded"
import SendPrivatePage from "./pages/SendPrivate"
import UnshieldPage from "./pages/Unshield"
import IdentitiesPage from "./pages/Identities"
import AddressesPage from "./pages/Addresses"
import SettingsPage from "./pages/Settings"
import { useAuth } from "./contexts/AuthContext"
import { usePrefetchWalletData } from "./hooks/usePrefetchWalletData"
import { ConnectionModeProvider } from "./contexts/ConnectionModeContext"

function App(): React.JSX.Element {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  usePrefetchWalletData()

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
      </Routes>
    )
  }

  return (
    <ConnectionModeProvider>
      <div className={"flex"}>
        <Sidebar />
        <Layout>
          <Routes>
            <Route path={"/"} element={<DashboardPage />} />
            <Route path={"/transactions"} element={<TransactionsPage />} />
            <Route path={"/send"} element={<SendPage />} />
            <Route path={"/receive"} element={<ReceivePage />} />
            <Route path={"/shield"} element={<ShieldPage />} />
            <Route path={"/shielded"} element={<ShieldedPage />} />
            <Route path={"/send-private"} element={<SendPrivatePage />} />
            <Route path={"/unshield"} element={<UnshieldPage />} />
            <Route path={"/addresses"} element={<AddressesPage />} />
            <Route path={"/identities"} element={<IdentitiesPage />} />
            <Route path={"/settings"} element={<SettingsPage />} />
          </Routes>
        </Layout>
      </div>
    </ConnectionModeProvider>
  )
}

export default App
