import { useEffect, useState } from 'react'
import { NOW_TICK_MS } from '@renderer/constants/timeLeft'

export function useNow(intervalMs: number = NOW_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
