import {MessagePortMain} from 'electron'
import {Message, MessageKind, NewTransactionMessage} from '../../types/Message'
import {Logger} from '../../utils/logger'

const log = new Logger('notify')

export class NotifyService {
  private port: MessagePortMain | null = null

  connect(port: MessagePortMain): void {
    if (port!=null) {
      log.warn('Port already in use. Closing previous port')
      this.port?.close()
    }

    this.port = port
    this.port?.close()

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
