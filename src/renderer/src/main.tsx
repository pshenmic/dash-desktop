import '@fontsource/manrope/300.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import './assets/styles/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from 'dash-ui-kit/react'
import { ToastContainer } from './components/ui/Toast'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeController } from './hooks/useThemeController'
import { ZoomController } from './hooks/useZoomController'
import { initialResolvedTheme } from './utils/theme'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider initialTheme={initialResolvedTheme()}>
      <ThemeController />
      <ZoomController />
      <HashRouter>
        <AuthProvider>
          <App />
          <ToastContainer />
        </AuthProvider>
    </HashRouter>
    </ThemeProvider>
  </StrictMode>
)
