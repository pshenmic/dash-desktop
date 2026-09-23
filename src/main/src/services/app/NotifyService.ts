import {MessagePortMain} from 'electron'
import {Message, MessageKind, NewTransactionMessage} from '../../types/Message'
import {Logger} from '../../utils/logger'

const log = new Logger('notify')

// Push channel to the renderer. The port arrives from the window rather than
// being opened here, so nothing has to hand a webContents to the backend, and
// a renderer that never connects costs a dropped message instead of an error.
export class NotifyService {
  private port: MessagePortMain | null = null

  // A reload opens a second port before the first one closes, so the old one is
  // dropped here rather than on its own close event, which would race.
  connect(port: MessagePortMain): void {
    this.port?.close()
    this.port = port
    port.on('close', () => {
      if (this.port === port) this.port = null
    })
    port.start()
    log.debug('renderer connected')
  }

  newTransaction(transaction: NewTransactionMessage): void {
    this.send({type: 'NewTransaction', data: transaction})
  }

  private send<K extends MessageKind>(message: Message<K>): void {
    if (this.port == null) return
    this.port.postMessage(message)
  }
}
