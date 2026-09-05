import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const dialled = vi.hoisted(() => ({peers: [] as FakePeer[]}))

interface FakePeer {
  host: string
  port: number
  relay: boolean
  disconnects: number
  emit: (event: string, ...args: unknown[]) => boolean
}

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  return {
    Peer: class extends EventEmitter {
      host: string
      port: number
      relay: boolean
      disconnects = 0
      constructor(options: {host: string; port: number; relay: boolean}) {
        super()
        this.host = options.host
        this.port = options.port
        this.relay = options.relay
        dialled.peers.push(this as unknown as FakePeer)
      }
      connect = async (): Promise<this> => this
      disconnect = (): this => {
        this.disconnects++
        this.emit('disconnect')
        return this
      }
    },
  }
})

import {probePeer} from '../../src/main/p2p/net/peerProbe'
import {PEER_PROBE_TIMEOUT_MS} from '../../src/main/p2p/constants'

describe('probing a peer before it is pinned', () => {
  beforeEach(() => {
    dialled.peers = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts a peer that answers the version handshake, and drops the socket after', async () => {
    const probe = probePeer('1.2.3.4:19999', 'testnet')
    dialled.peers[0].emit('ready')

    expect(await probe).toEqual({ok: true, error: null})
    expect(dialled.peers[0].disconnects).toBe(1)
  })

  // A TCP connect is answered by anything listening on the port, so the
  // handshake is the whole test — a node that hangs up during it is not usable.
  it('refuses a peer that closes before the handshake', async () => {
    const probe = probePeer('1.2.3.4:19999', 'testnet')
    dialled.peers[0].emit('disconnect')

    expect(await probe).toEqual({ok: false, error: 'closed before the handshake'})
  })

  it('reports the socket error as the reason', async () => {
    const probe = probePeer('1.2.3.4:19999', 'testnet')
    dialled.peers[0].emit('error', new Error('connect ECONNREFUSED'))

    expect(await probe).toEqual({ok: false, error: 'connect ECONNREFUSED'})
  })

  // Node retries SYN for minutes before reporting a connect failure, so without
  // this a dial to a host that is not there never ends.
  it('gives up on a peer that answers nothing', async () => {
    vi.useFakeTimers()
    const probe = probePeer('1.2.3.4:19999', 'testnet')
    vi.advanceTimersByTime(PEER_PROBE_TIMEOUT_MS)

    expect(await probe).toEqual({ok: false, error: `no handshake within ${PEER_PROBE_TIMEOUT_MS}ms`})
  })

  it('dials the network default port for an entry without one', async () => {
    const probe = probePeer('1.2.3.4', 'testnet')
    dialled.peers[0].emit('ready')
    await probe

    expect(dialled.peers[0].port).toBe(19999)
  })

  it('refuses an entry it cannot parse without opening a socket', async () => {
    expect(await probePeer('1.2.3.4:99999', 'mainnet')).toEqual({ok: false, error: 'not a host or host:port'})
    expect(dialled.peers).toEqual([])
  })
})
