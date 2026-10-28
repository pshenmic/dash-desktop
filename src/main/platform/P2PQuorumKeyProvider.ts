import {PlatformExplorerQuorumKeyProvider, QuorumKeyProvider} from 'dash-platform-sdk'
import {Network} from '../src/types/Network'
import {Logger} from '../src/utils/logger'

const log = new Logger('platform')

// Built once per network and never swapped, so the SDK holds no keys of its own
// to go stale. Explorer answers only what p2p has not proven: a set behind the
// tip lacks the newest.
export class P2PQuorumKeyProvider implements QuorumKeyProvider {
  private keys = new Map<string, Uint8Array>()
  private readonly explorer: PlatformExplorerQuorumKeyProvider

  constructor(private readonly network: Network) {
    this.explorer = new PlatformExplorerQuorumKeyProvider(network)
  }

  // Keyed `llmqType:quorumHash`, the same hex the SDK reads off a proof.
  setKeys(keys: Map<string, Uint8Array>): void {
    if ((this.keys.size > 0) !== (keys.size > 0)) {
      log.info(`${this.network}: proofs now verified with ${keys.size > 0 ? `${keys.size} quorum key(s) proven by p2p` : 'Platform Explorer quorum keys'}`)
    }
    this.keys = keys
  }

  getQuorumPublicKey = async (quorumType: number, quorumHash: string): Promise<string> => {
    const proven = this.keys.get(`${quorumType}:${quorumHash}`)
    return proven != null ? Buffer.from(proven).toString('hex') : this.explorer.getQuorumPublicKey(quorumType, quorumHash)
  }
}
