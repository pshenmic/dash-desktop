import React, { createContext, useContext } from 'react'
import { useConnectionMode, UseConnectionMode } from '@renderer/hooks/useConnectionMode'

const ConnectionModeContext = createContext<UseConnectionMode | null>(null)

export function ConnectionModeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const value = useConnectionMode()
  return <ConnectionModeContext.Provider value={value}>{children}</ConnectionModeContext.Provider>
}

export function useConnectionModeContext(): UseConnectionMode {
  const ctx = useContext(ConnectionModeContext)
  if (!ctx) throw new Error('useConnectionModeContext must be used inside ConnectionModeProvider')
  return ctx
}
