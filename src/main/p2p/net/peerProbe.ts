import {Peer} from 'dash-core-p2p'
import {Network} from '../../src/types/Network'
import {DEFAULT_PEER_PORT, PEER_PROBE_TIMEOUT_MS} from '../constants'
import {parsePeerAddress} from './peerAddress'
import {PeerProbeResult} from '../types/pool'

// Available means the version handshake answered: a bare TCP connect is
// answered by anything listening on the port. Off the pools — the entry is in
// no address book yet, and one dial must not disturb a running session.
export function probePeer(entry: string, network: Network): Promise<PeerProbeResult> {
  const addr = parsePeerAddress(entry, DEFAULT_PEER_PORT[network])
  const host = addr?.ip.v4 ?? addr?.ip.v6
  if (addr == null || host == null) {
    return Promise.resolve({ok: false, error: 'not a host or host:port'})
  }

  return new Promise<PeerProbeResult>(resolve => {
    let settled = false
    let peer: Peer | undefined

    const finish = (error: string | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // Before the disconnect, or tearing the socket down re-enters this
      // through the handler below.
      peer?.removeAllListeners()
      peer?.disconnect()
      resolve({ok: error == null, error})
    }

    const timer = setTimeout(
      () => finish(`no handshake within ${PEER_PROBE_TIMEOUT_MS}ms`),
      PEER_PROBE_TIMEOUT_MS,
    )
    // Every failure answers rather than rejecting: a caller waiting on the IPC
    // reply would otherwise sit out its own timeout for an error already known.
    try {
      peer = new Peer({host, port: addr.port, network, relay: false})
      peer.on('ready', () => finish(null))
      peer.on('error', (err: Error) => finish(err.message))
      // A node that drops us mid-handshake — banned, at capacity, or speaking
      // another network — closes the socket without ever erroring.
      peer.on('disconnect', () => finish('closed before the handshake'))
      peer.connect().catch((err: unknown) => finish(reason(err)))
    } catch (err) {
      finish(reason(err))
    }
  })
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
