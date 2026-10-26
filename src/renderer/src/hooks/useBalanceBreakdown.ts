import { useState } from 'react'
import { LS_BALANCE_BREAKDOWN_OPEN } from '@renderer/constants/balance'

function readBreakdownOpen(): boolean {
  try {
    return localStorage.getItem(LS_BALANCE_BREAKDOWN_OPEN) === 'true'
  } catch {
    return false
  }
}

export function useBalanceBreakdown(): { isBreakdownOpen: boolean; toggleBreakdown: () => void } {
  const [isBreakdownOpen, setBreakdownOpen] = useState(readBreakdownOpen)

  const toggleBreakdown = (): void => {
    const next = !isBreakdownOpen
    setBreakdownOpen(next)
    try {
      localStorage.setItem(LS_BALANCE_BREAKDOWN_OPEN, String(next))
    } catch {}
  }

  return { isBreakdownOpen, toggleBreakdown }
}
