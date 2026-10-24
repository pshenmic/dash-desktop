import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { PREVIEW_BACKEND_ERRORS, PREVIEW_LATENCY_MS } from '@renderer/constants/masternodePreview'
import type {
  MasternodeDto,
  MasternodeVoteDto,
  MasternodeVoteResultDto,
  NameContestDto,
  VoteChoiceDto,
} from '@renderer/types/Masternodes'
import {
  addPreviewNodes,
  castPreviewVotes,
  findPreviewNode,
  findPreviewNodesByVotingKey,
  removePreviewNode,
  settleExpiredContests,
} from '@renderer/utils/masternodePreview'
import { previewLatency, readPreviewWallet, updatePreviewWallet } from './previewStore'

async function requirePassword(walletId: string, password: string): Promise<void> {
  if (!(await API.verifyWalletPassword(walletId, password))) throw new Error(INVALID_WALLET_PASSWORD_MESSAGE)
}

export class MasternodePreviewAPI {
  static async getMasternodes(walletId: string): Promise<MasternodeDto[]> {
    const state = await readPreviewWallet(walletId)
    await previewLatency(PREVIEW_LATENCY_MS.read)
    return state.nodes
  }

  static async findMasternodesByVotingKey(walletId: string, votingKey: string, expectedProTxHash?: string): Promise<MasternodeDto[]> {
    const state = await readPreviewWallet(walletId)
    await previewLatency(PREVIEW_LATENCY_MS.read)
    return findPreviewNodesByVotingKey(state, votingKey, expectedProTxHash)
  }

  static async findMasternode(walletId: string, proTxHash: string): Promise<MasternodeDto | null> {
    const state = await readPreviewWallet(walletId)
    await previewLatency(PREVIEW_LATENCY_MS.read)
    return findPreviewNode(state, proTxHash)
  }

  static async addMasternodes(
    walletId: string,
    proTxHashes: string[],
    votingKey: string | null,
    password: string | null,
  ): Promise<MasternodeDto[]> {
    if (password != null) await requirePassword(walletId, password)
    await previewLatency(PREVIEW_LATENCY_MS.write)
    return updatePreviewWallet(walletId, (state) => {
      const next = addPreviewNodes(state, proTxHashes, votingKey != null, Date.now())
      return { state: next, result: next.nodes }
    })
  }

  static async removeMasternode(walletId: string, proTxHash: string): Promise<MasternodeDto[]> {
    await previewLatency(PREVIEW_LATENCY_MS.write)
    return updatePreviewWallet(walletId, (state) => {
      const next = removePreviewNode(state, proTxHash)
      return { state: next, result: next.nodes }
    })
  }

  static async getNameContests(walletId: string): Promise<NameContestDto[]> {
    await previewLatency(PREVIEW_LATENCY_MS.read)
    return updatePreviewWallet(walletId, (state) => {
      const next = { ...state, contests: settleExpiredContests(state.contests, Date.now()) }
      return { state: next, result: next.contests }
    })
  }

  static async getMasternodeVotes(walletId: string): Promise<MasternodeVoteDto[]> {
    const state = await readPreviewWallet(walletId)
    await previewLatency(PREVIEW_LATENCY_MS.read)
    return state.votes
  }

  static async castMasternodeVotes(
    walletId: string,
    normalizedLabel: string,
    choice: VoteChoiceDto,
    proTxHashes: string[],
    password: string,
  ): Promise<MasternodeVoteResultDto[]> {
    await requirePassword(walletId, password)
    await previewLatency(PREVIEW_LATENCY_MS.vote)
    return updatePreviewWallet(walletId, (state) => {
      const outcome = castPreviewVotes(state, normalizedLabel, choice, proTxHashes, Date.now())
      if (outcome == null) throw new Error(PREVIEW_BACKEND_ERRORS.contestNotFound)
      return outcome
    })
  }
}
