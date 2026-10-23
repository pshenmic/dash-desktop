import {useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react'
import {API} from '@renderer/api'
import type {DapiUrlStatus, Network, PeerMode} from '@renderer/api/types'
import {PEER_POLL_INTERVAL_MS} from '@renderer/constants/connection'
import type {PlatformNodeMutation, UsePlatformNodeSettingsResult} from '@renderer/types/connection'
import {getErrorMessage} from '@renderer/utils/error'
import {appendPlatformNode, removePlatformNode} from '@renderer/utils/platformNodes'
import {
  getPlatformNodeMutationSnapshot,
  runPlatformNodeMutation,
  subscribePlatformNodeMutations,
} from '@renderer/stores/platformNodeMutations'

export function usePlatformNodeSettings(network: Network | null): UsePlatformNodeSettingsResult {
  const mutationState = useSyncExternalStore(subscribePlatformNodeMutations, getPlatformNodeMutationSnapshot)
  const [configuredMode, setConfiguredMode] = useState<PeerMode | null>(null)
  const [staticNodes, setStaticNodes] = useState<string[]>([])
  const [hasStaticNodes, setHasStaticNodes] = useState(false)
  const [activeNodes, setActiveNodes] = useState<DapiUrlStatus[]>([])
  const [loadedNetwork, setLoadedNetwork] = useState<Network | null | undefined>(undefined)
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeNodesLoading, setActiveNodesLoading] = useState(false)
  const [settingsReady, setSettingsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeNodesError, setActiveNodesError] = useState<string | null>(null)
  const [loadVersion, setLoadVersion] = useState(0)
  const mountedRef = useRef(true)
  const generationRef = useRef(0)
  const activeRequestRef = useRef<Promise<void> | null>(null)

  useLayoutEffect(() => {
    mountedRef.current = true
    generationRef.current += 1
    activeRequestRef.current = null
    setConfiguredMode(null)
    setStaticNodes([])
    setHasStaticNodes(false)
    setActiveNodes([])
    setLoadedNetwork(undefined)
    setLoadedRevision(null)
    setSettingsReady(false)
    setError(null)
    setActiveNodesError(null)
    return () => {
      mountedRef.current = false
      generationRef.current += 1
    }
  }, [network])

  useEffect(() => {
    setLoading(true)
    setSettingsReady(false)
    if (mutationState.pending !== null) return
    const revision = mutationState.revision
    let cancelled = false
    Promise.allSettled([
      API.getPreferences(),
      network === null ? Promise.resolve([]) : API.getDapiUrls(network),
    ]).then(([preferences, nodes]) => {
      const currentMutation = getPlatformNodeMutationSnapshot()
      if (cancelled || currentMutation.pending !== null || currentMutation.revision !== revision) return
      const failures: string[] = []
      if (preferences.status === 'fulfilled') {
        setConfiguredMode(preferences.value.network.dapi.mode)
        setHasStaticNodes(preferences.value.network.dapi.mainnet.length > 0 || preferences.value.network.dapi.testnet.length > 0)
      } else {
        failures.push(`node mode: ${getErrorMessage(preferences.reason)}`)
      }
      if (nodes.status === 'fulfilled') setStaticNodes(nodes.value)
      else failures.push(`static nodes: ${getErrorMessage(nodes.reason)}`)
      setSettingsReady(network !== null && failures.length === 0)
      setLoadedNetwork(network)
      setLoadedRevision(revision)
      if (failures.length > 0) setError(`Could not load Platform settings. ${failures.join('; ')}`)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [network, loadVersion, mutationState.pending, mutationState.revision])

  const refreshActiveNodes = useCallback((showLoading = false): Promise<void> => {
    if (network === null) return Promise.resolve()
    if (activeRequestRef.current !== null) return activeRequestRef.current
    const generation = generationRef.current
    if (showLoading) setActiveNodesLoading(true)
    const request = API.getActiveDapiUrls(network)
      .then(nodes => {
        if (!mountedRef.current || generationRef.current !== generation || activeRequestRef.current !== request) return
        setActiveNodes(nodes)
        setActiveNodesError(null)
      })
      .catch(loadError => {
        if (!mountedRef.current || generationRef.current !== generation || activeRequestRef.current !== request) return
        setActiveNodesError(`Could not load active Platform nodes. ${getErrorMessage(loadError)}`)
      })
      .finally(() => {
        if (activeRequestRef.current !== request) return
        activeRequestRef.current = null
        if (mountedRef.current && generationRef.current === generation) setActiveNodesLoading(false)
      })
    activeRequestRef.current = request
    return request
  }, [network])

  useEffect(() => {
    if (network === null) {
      setActiveNodesLoading(false)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    activeRequestRef.current = null
    const poll = async (showLoading = false): Promise<void> => {
      await refreshActiveNodes(showLoading)
      if (!cancelled) timer = setTimeout(() => void poll(), PEER_POLL_INTERVAL_MS)
    }
    void poll(true)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [network, refreshActiveNodes, mutationState.revision])

  const applyMutation = useCallback(async (
    mutation: PlatformNodeMutation,
    action: () => Promise<void>,
  ): Promise<void> => {
    if (!mountedRef.current || network === null || loadedNetwork !== network || !settingsReady || loadedRevision === null) {
      throw new Error('Wait for Platform node settings to load before editing them.')
    }
    const generation = generationRef.current
    setError(null)
    try {
      await runPlatformNodeMutation(mutation, loadedRevision, async () => {
        await action()
        if (mountedRef.current && generationRef.current === generation) {
          activeRequestRef.current = null
          await refreshActiveNodes()
        }
      })
    } catch (mutationError) {
      if (mountedRef.current && generationRef.current === generation) {
        setError(getErrorMessage(mutationError))
      }
      throw mutationError
    }
  }, [loadedNetwork, loadedRevision, network, refreshActiveNodes, settingsReady])

  const setMode = useCallback(async (mode: PeerMode): Promise<void> => {
    if (configuredMode === mode) return
    await applyMutation('set-mode', () => API.setDapiMode(mode))
  }, [applyMutation, configuredMode])

  const addStaticNode = useCallback(async (url: string): Promise<boolean> => {
    let next: string[]
    try {
      next = appendPlatformNode(staticNodes, url)
    } catch (validationError) {
      setError(getErrorMessage(validationError))
      throw validationError
    }
    if (next.length === staticNodes.length) return false
    await applyMutation('save-nodes', () => API.setDapiUrls(network!, next))
    return true
  }, [applyMutation, network, staticNodes])

  const removeStaticNode = useCallback(async (url: string): Promise<void> => {
    const next = removePlatformNode(staticNodes, url)
    if (next.length === staticNodes.length) return
    await applyMutation('save-nodes', () => API.setDapiUrls(network!, next))
  }, [applyMutation, network, staticNodes])

  const currentNetwork = loadedNetwork === network
  const reload = useCallback((): void => {
    if (getPlatformNodeMutationSnapshot().pending !== null) return
    setError(null)
    setLoadVersion(current => current + 1)
    void refreshActiveNodes(true)
  }, [refreshActiveNodes])

  return {
    configuredMode: currentNetwork ? configuredMode : null,
    staticNodes: currentNetwork ? staticNodes : [],
    hasStaticNodes: currentNetwork && hasStaticNodes,
    activeNodes: currentNetwork ? activeNodes : [],
    loading: loading || !currentNetwork || loadedRevision !== mutationState.revision,
    activeNodesLoading,
    settingsReady: currentNetwork && settingsReady && loadedRevision === mutationState.revision && mutationState.pending === null,
    pending: mutationState.pending,
    error: currentNetwork ? error : null,
    activeNodesError: currentNetwork ? activeNodesError : null,
    reload,
    setMode,
    addStaticNode,
    removeStaticNode,
  }
}
