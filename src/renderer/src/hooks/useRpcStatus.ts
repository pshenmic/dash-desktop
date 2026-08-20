import {useEffect, useState} from 'react'
import {API} from '@renderer/api'
import {Network} from '@renderer/api/types'
import {RPC_STATUS_POLL_MS} from '@renderer/constants/intervals'
import {RpcHealthStatus} from '@renderer/types/connection'

export function useRpcStatus(network: Network | null, enabled: boolean): RpcHealthStatus {
  const [status, setStatus] = useState<RpcHealthStatus>('checking')

  useEffect(() => {
    if (!enabled || network === null) {
      setStatus('checking')
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const check = async (): Promise<void> => {
      const connected = await API.getRpcStatus(network).catch(() => false)
      if (cancelled) return
      setStatus(connected ? 'connected' : 'unavailable')
      timer = setTimeout(check, RPC_STATUS_POLL_MS)
    }

    setStatus('checking')
    void check()

    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
    }
  }, [enabled, network])

  return status
}
