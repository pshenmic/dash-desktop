import './assets/styles/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from 'dash-ui-kit/react'
import { ToastContainer } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeController } from './hooks/useThemeController'
import { initialResolvedTheme } from './utils/theme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider initialTheme={initialResolvedTheme()}>
      <ThemeController />
      <HashRouter>
        <AuthProvider>
          <App />
          <ToastContainer />
        </AuthProvider>
    </HashRouter>
    </ThemeProvider>
  </StrictMode>
)
