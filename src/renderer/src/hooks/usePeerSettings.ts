import {useCallback, useEffect, useRef, useState} from 'react'
import {API} from '@renderer/api'
import type {Network, PeerInfo, PeerMode} from '@renderer/api/types'
import {PEER_POLL_INTERVAL_MS} from '@renderer/constants/connection'
import type {PeerMutation, UsePeerSettingsResult} from '@renderer/types/connection'
import {appendPeerEntry, dedupePeerEntries, peerIdentity, removePeerEntry} from '@renderer/utils/peers'
import {getErrorMessage} from '@renderer/utils/error'

export function usePeerSettings(
  network: Network | null,
  pollConnectedPeers: boolean,
): UsePeerSettingsResult {
  const [configuredMode, setConfiguredMode] = useState<PeerMode | null>(null)
  const [connectedPeers, setConnectedPeers] = useState<PeerInfo[]>([])
  const [dynamicPeers, setDynamicPeers] = useState<string[]>([])
  const [staticPeers, setStaticPeers] = useState<string[]>([])
  const [bannedPeers, setBannedPeers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsReady, setSettingsReady] = useState(false)
  const [loadedNetwork, setLoadedNetwork] = useState<Network | null | undefined>(undefined)
  const [loadVersion, setLoadVersion] = useState(0)
  const [pending, setPending] = useState<PeerMutation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const generationRef = useRef(0)
  const connectedRequestRef = useRef<number | null>(null)
  const connectedRefreshQueuedRef = useRef(false)
  const pendingRef = useRef<PeerMutation | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      generationRef.current += 1
    }
  }, [])

  useEffect(() => {
    generationRef.current += 1
    const generation = generationRef.current
    setConnectedPeers([])
    setDynamicPeers([])
    setStaticPeers([])
    setBannedPeers([])
    setLoading(true)
    setSettingsReady(false)
    setLoadedNetwork(undefined)
    setError(null)
    connectedRefreshQueuedRef.current = false

    if (network === null) {
      API.getPreferences()
        .then(preferences => {
          if (mountedRef.current && generationRef.current === generation) {
            setConfiguredMode(preferences.network.mode)
          }
        })
        .catch(loadError => {
          if (mountedRef.current && generationRef.current === generation) {
            setConfiguredMode(null)
            setError(`Could not load peer mode. ${getErrorMessage(loadError)}`)
          }
        })
        .finally(() => {
          if (mountedRef.current && generationRef.current === generation) {
            setLoadedNetwork(null)
            setLoading(false)
          }
        })
      return
    }

    connectedRequestRef.current = generation
    Promise.allSettled([
      API.getPreferences(),
      API.getConnectedPeers(),
      API.getDynamicPeers(network),
      API.getStaticPeers(network),
      API.getBannedPeers(network),
    ]).then(([preferences, connected, dynamic, staticResult, banned]) => {
      if (!mountedRef.current || generationRef.current !== generation) return

      const failures: string[] = []
      if (preferences.status === 'fulfilled') setConfiguredMode(preferences.value.network.mode)
      else failures.push(`peer mode: ${getErrorMessage(preferences.reason)}`)
      if (connected.status === 'fulfilled') setConnectedPeers(connected.value)
      else failures.push(`connected peers: ${getErrorMessage(connected.reason)}`)
      if (dynamic.status === 'fulfilled') setDynamicPeers(dynamic.value)
      else failures.push(`dynamic peers: ${getErrorMessage(dynamic.reason)}`)
      if (staticResult.status === 'fulfilled') setStaticPeers(staticResult.value)
      else failures.push(`static peers: ${getErrorMessage(staticResult.reason)}`)
      if (banned.status === 'fulfilled') setBannedPeers(banned.value)
      else failures.push(`banned peers: ${getErrorMessage(banned.reason)}`)

      setSettingsReady(
        preferences.status === 'fulfilled'
        && dynamic.status === 'fulfilled'
        && staticResult.status === 'fulfilled'
        && banned.status === 'fulfilled',
      )
      setLoadedNetwork(network)
      setError(failures.length === 0 ? null : `Could not load ${failures.join('; ')}`)
      setLoading(false)
    }).finally(() => {
      if (connectedRequestRef.current === generation) connectedRequestRef.current = null
    })
  }, [loadVersion, network])

  const refreshConnectedPeers = useCallback(async (): Promise<void> => {
    const generation = generationRef.current
    if (network === null) return
    if (connectedRequestRef.current === generation) {
      connectedRefreshQueuedRef.current = true
      return
    }

    do {
      connectedRefreshQueuedRef.current = false
      connectedRequestRef.current = generation
      try {
        const peers = await API.getConnectedPeers()
        if (mountedRef.current && generationRef.current === generation) {
          setConnectedPeers(peers)
          setError(current => {
            if (current?.startsWith('Could not refresh connected peers.')) return null
            if (current?.startsWith('Could not load connected peers:') && !current.includes('; ')) return null
            return current
          })
        }
      } catch (refreshError) {
        if (mountedRef.current && generationRef.current === generation) {
          setError(current => current ?? `Could not refresh connected peers. ${getErrorMessage(refreshError)}`)
        }
      } finally {
        if (connectedRequestRef.current === generation) connectedRequestRef.current = null
      }
    } while (connectedRefreshQueuedRef.current && generationRef.current === generation)
  }, [network])

  useEffect(() => {
    if (network === null || !pollConnectedPeers) return
    const timer = setInterval(() => void refreshConnectedPeers(), PEER_POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [network, pollConnectedPeers, refreshConnectedPeers])

  const beginMutation = useCallback((mutation: PeerMutation): void => {
    if (pendingRef.current !== null) throw new Error('Another peer setting is still being applied.')
    pendingRef.current = mutation
    setPending(mutation)
    setError(null)
  }, [])

  const finishMutation = useCallback((mutation: PeerMutation): void => {
    if (pendingRef.current !== mutation) return
    pendingRef.current = null
    if (mountedRef.current) setPending(null)
  }, [])

  const failMutation = useCallback((mutationError: unknown, generation: number): void => {
    if (mountedRef.current && generationRef.current === generation) {
      setError(getErrorMessage(mutationError))
    }
  }, [])

  const setMode = useCallback(async (mode: PeerMode): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before changing peer mode.')
    }
    if (configuredMode === mode) return
    const mutation: PeerMutation = 'set-mode'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      await API.setPeerMode(mode)
      if (mountedRef.current) setConfiguredMode(mode)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getPreferences()
        .then(preferences => {
          if (mountedRef.current) setConfiguredMode(preferences.network.mode)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [beginMutation, configuredMode, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady])

  const addDynamicPeer = useCallback(async (peer: string): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before adding a peer.')
    }
    const current = dedupePeerEntries(dynamicPeers, network)
    const next = appendPeerEntry(current, peer, network)
    if (next.length === current.length) {
      setDynamicPeers(current)
      return
    }

    const mutation: PeerMutation = 'add-dynamic'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      await API.setDynamicPeers(network, next)
      if (mountedRef.current && generationRef.current === generation) setDynamicPeers(next)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getDynamicPeers(network)
        .then(peers => {
          if (mountedRef.current && generationRef.current === generation) setDynamicPeers(peers)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [beginMutation, dynamicPeers, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady])

  const removeDynamicPeer = useCallback(async (peer: string): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before removing a peer.')
    }
    const next = removePeerEntry(dynamicPeers, peer, network)
    if (next.length === dynamicPeers.length) return

    const mutation: PeerMutation = 'remove-dynamic'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      await API.setDynamicPeers(network, next)
      if (mountedRef.current && generationRef.current === generation) setDynamicPeers(next)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getDynamicPeers(network)
        .then(peers => {
          if (mountedRef.current && generationRef.current === generation) setDynamicPeers(peers)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [beginMutation, dynamicPeers, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady])

  const addStaticPeer = useCallback(async (peer: string): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before adding a static peer.')
    }
    const target = peerIdentity(peer, network)
    if (staticPeers.some(entry => peerIdentity(entry, network) === target)) return

    const mutation: PeerMutation = 'add-static'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      const next = await API.pushStaticPeer(network, peer.trim())
      if (mountedRef.current && generationRef.current === generation) setStaticPeers(next)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getStaticPeers(network)
        .then(peers => {
          if (mountedRef.current && generationRef.current === generation) setStaticPeers(peers)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [beginMutation, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady, staticPeers])

  const removeStaticPeer = useCallback(async (peer: string): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before removing a static peer.')
    }
    const mutation: PeerMutation = 'remove-static'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      const next = await API.removeStaticPeer(network, peer)
      if (mountedRef.current && generationRef.current === generation) setStaticPeers(next)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getStaticPeers(network)
        .then(peers => {
          if (mountedRef.current && generationRef.current === generation) setStaticPeers(peers)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [beginMutation, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady])

  const banPeer = useCallback(async (peer: string): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before banning a peer.')
    }
    const current = dedupePeerEntries(bannedPeers, network)
    const next = appendPeerEntry(current, peer, network)
    if (next.length === current.length) {
      setBannedPeers(current)
      return
    }

    const mutation: PeerMutation = 'ban'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      await API.setBannedPeers(network, next)
      if (mountedRef.current && generationRef.current === generation) setBannedPeers(next)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getBannedPeers(network)
        .then(peers => {
          if (mountedRef.current && generationRef.current === generation) setBannedPeers(peers)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [bannedPeers, beginMutation, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady])

  const unbanPeer = useCallback(async (peer: string): Promise<void> => {
    if (network === null || loadedNetwork !== network || !settingsReady) {
      throw new Error('Wait for peer settings to load before unbanning a peer.')
    }
    const next = removePeerEntry(bannedPeers, peer, network)
    if (next.length === bannedPeers.length) return

    const mutation: PeerMutation = 'unban'
    const generation = generationRef.current
    beginMutation(mutation)
    try {
      await API.setBannedPeers(network, next)
      if (mountedRef.current && generationRef.current === generation) setBannedPeers(next)
      await refreshConnectedPeers()
    } catch (mutationError) {
      await API.getBannedPeers(network)
        .then(peers => {
          if (mountedRef.current && generationRef.current === generation) setBannedPeers(peers)
        })
        .catch(() => {
          if (mountedRef.current && generationRef.current === generation) setSettingsReady(false)
        })
      failMutation(mutationError, generation)
      throw mutationError
    } finally {
      finishMutation(mutation)
    }
  }, [bannedPeers, beginMutation, failMutation, finishMutation, loadedNetwork, network, refreshConnectedPeers, settingsReady])

  const currentSettingsReady = settingsReady && loadedNetwork === network

  const reload = useCallback((): void => {
    if (pendingRef.current === null) setLoadVersion(current => current + 1)
  }, [])

  return {
    configuredMode,
    connectedPeers,
    dynamicPeers,
    staticPeers,
    bannedPeers,
    loading: loading || loadedNetwork !== network,
    settingsReady: currentSettingsReady,
    pending,
    error,
    clearError: () => setError(null),
    reload,
    setMode,
    addDynamicPeer,
    removeDynamicPeer,
    addStaticPeer,
    removeStaticPeer,
    banPeer,
    unbanPeer,
  }
}
