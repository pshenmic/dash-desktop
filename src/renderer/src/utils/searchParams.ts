import { DASHPAY_PARAMS } from '@renderer/constants/dashPay'

export function withParams(search: string | URLSearchParams, patch: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams(search)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (value === null) params.delete(key)
    else params.set(key, value)
  }
  return params.toString()
}

export function enumParam<T extends string>(values: Record<string, T>, raw: string | null | undefined, fallback: T): T {
  return Object.values(values).find(value => value === raw) ?? fallback
}

export function returnHref(returnTo: string | null | undefined, fallback: string, actingIdentifier: string | null): string {
  const target = returnTo != null && returnTo.startsWith('/') ? returnTo : fallback
  if (actingIdentifier == null) return target
  const queryStart = target.indexOf('?')
  const path = queryStart < 0 ? target : target.slice(0, queryStart)
  const search = queryStart < 0 ? '' : target.slice(queryStart + 1)
  return `${path}?${withParams(search, { [DASHPAY_PARAMS.identity]: actingIdentifier })}`
}
