import { useEffect, useRef } from 'react'
import { toast } from '@renderer/components/ui/Toast'

export function useErrorToast(error: string | null, enabled = true): void {
  const previous = useRef<string | null>(null)
  useEffect(() => {
    if (enabled && error && error !== previous.current) toast.error(error)
    previous.current = error
  }, [error, enabled])
}
