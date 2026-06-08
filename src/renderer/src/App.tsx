import { Route, Routes, useLocation } from "react-router-dom"
import TransactionsPage from "./pages/Transactions"
import SendPage from "./pages/Send"
import Sidebar from "./components/sidebar"
import LoginPage from "./pages/auth/Login"
import Layout from "./components/Layout"
import CreateWalletWrapper from "./pages/auth/CreateWalletWrapper"
import ReceivePage from "./pages/Receive"
import IdentitiesPage from "./pages/Identities"
import AddressesPage from "./pages/Addresses"
import SettingsPage from "./pages/Settings"
import { useAuth } from "./contexts/AuthContext"
import { usePrefetchWalletData } from "./hooks/usePrefetchWalletData"

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
    <div className={"flex"}>
      <Sidebar />
      <Layout>
        <Routes>
          <Route path={"/"} element={<TransactionsPage />} />
          <Route path={"/send"} element={<SendPage />} />
          <Route path={"/receive"} element={<ReceivePage />} />
          <Route path={"/addresses"} element={<AddressesPage />} />
          <Route path={"/identities"} element={<IdentitiesPage />} />
          <Route path={"/settings"} element={<SettingsPage />} />
        </Routes>
      </Layout>
    </div>
  )
}

export default App
