import { MESSAGE_PORT_TAG } from '@renderer/constants/notifications'
import type { NewTransactionMessage, NotifyMessage } from './types'

type NewTransactionListener = (transaction: NewTransactionMessage) => void

const listeners = new Set<NewTransactionListener>()
let port: MessagePort | null = null

// A MessagePort has no representation on contextBridge, so the channel is
// opened here and one end handed to the preload over window.postMessage, which
// transfers it natively. One channel per document: the main process holds a
// single port and closes whichever one a reload supersedes.
function connect(): void {
  if (port != null) return
  const channel = new MessageChannel()
  channel.port1.addEventListener('message', (event: MessageEvent<NotifyMessage>) => {
    if (event.data.type !== 'NewTransaction') return
    for (const listener of listeners) listener(event.data.data)
  })
  channel.port1.start()
  port = channel.port1
  window.postMessage(MESSAGE_PORT_TAG, '*', [channel.port2])
}

// The push counterpart to the API class: transactions are announced by the main
// process rather than asked for, so there is nothing to invoke.
export function onNewTransaction(listener: NewTransactionListener): () => void {
  connect()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
