import React, { createContext, useContext } from 'react'
import { useConnectionMode, UseConnectionMode } from '@renderer/hooks/useConnectionMode'
import { usePrefetchWalletData } from '@renderer/hooks/usePrefetchWalletData'

const ConnectionModeContext = createContext<UseConnectionMode | null>(null)

export function ConnectionModeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const value = useConnectionMode()
  usePrefetchWalletData(value.ready)
  if (!value.ready) return <></>
  return <ConnectionModeContext.Provider value={value}>{children}</ConnectionModeContext.Provider>
}

export function useConnectionModeContext(): UseConnectionMode {
  const ctx = useContext(ConnectionModeContext)
  if (!ctx) throw new Error('useConnectionModeContext must be used inside ConnectionModeProvider')
  return ctx
}
