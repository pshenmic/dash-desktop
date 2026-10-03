import {PlatformVersionWASM} from 'pshenmic-dpp'
import {LATEST_PLATFORM_VERSION} from 'dash-platform-sdk/src/constants.js'
import {Logger} from '../../src/utils/logger'
import {Network} from '../../src/types/Network'
import {PLATFORM_VERSION_RETRY_MS, PLATFORM_VERSION_TTL_MS} from '../constants'
import {PlatformVersionLookup, ResolvedPlatformVersion} from '../types/service'
import {OperationContext} from './types'

const log = new Logger('platform')

const resolved = new Map<Network, ResolvedPlatformVersion>()

// Fees are versioned, and consensus charges at the version the network runs,
// not the newest one this dpp build knows.
export function platformVersion(ctx: OperationContext): Promise<PlatformVersionWASM> {
  const cached = resolved.get(ctx.network)
  if (cached != null && Date.now() < cached.expiresAt) return cached.version

  const lookup = lookUp(ctx)
  const entry: ResolvedPlatformVersion = {version: lookup.then(({version}) => version), expiresAt: Infinity}
  resolved.set(ctx.network, entry)
  void lookup.then(({answered}) => {
    entry.expiresAt = Date.now() + (answered ? PLATFORM_VERSION_TTL_MS : PLATFORM_VERSION_RETRY_MS)
  })
  return entry.version
}

async function lookUp(ctx: OperationContext): Promise<PlatformVersionLookup> {
  let running: number
  try {
    const [epoch] = await ctx.sdk.node.getEpochsInfo(1, false)
    running = Number(epoch.protocolVersion)
    if (!Number.isInteger(running)) throw new Error(`epoch reports protocol version ${String(epoch.protocolVersion)}`)
  } catch (err) {
    log.warn(`${ctx.network}: protocol version lookup failed, pricing at ${LATEST_PLATFORM_VERSION}:`, err)
    return {version: LATEST_PLATFORM_VERSION, answered: false}
  }

  if (running > LATEST_PLATFORM_VERSION) {
    log.warn(`${ctx.network} runs protocol ${running}, which this dpp build does not know; pricing at ${LATEST_PLATFORM_VERSION}`)
  }
  return {version: Math.min(running, LATEST_PLATFORM_VERSION), answered: true}
}
