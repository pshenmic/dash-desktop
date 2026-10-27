import { useId, useState } from 'react'
import { HighlightedIdentifier, Input, SuccessIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import CheckRow from '@renderer/components/ui/CheckRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PasswordField from '@renderer/components/ui/PasswordField'
import PendingRow from '@renderer/components/ui/PendingRow'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import StatusPill from '@renderer/components/ui/StatusPill'
import { toast } from '@renderer/components/ui/Toast'
import { API } from '@renderer/api'
import { MasternodePreviewAPI } from '@renderer/api/preview/MasternodePreviewAPI'
import { masternodePreviewCacheKey } from '@renderer/api/preview/previewStore'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import {
  ADD_NODE_CANDIDATES_CLASS,
  ADD_NODE_COPY,
  ADD_NODE_FACT_ROW_CLASS,
  ADD_NODE_INPUT_CLASS,
  ADD_NODE_PRO_TX_HASH_CLASS,
  ADD_NODE_SOURCE_OPTIONS,
  COUNT_NOUNS,
} from '@renderer/constants/masternodeNodes'
import { PREVIEW_DEFAULT_NETWORK, PREVIEW_DONE_NOTE } from '@renderer/constants/masternodePreview'
import {
  MASTERNODE_ACCESS_LABELS,
  MASTERNODE_CACHE_NAMESPACES,
  MASTERNODE_STATUS_PILLS,
  MASTERNODE_TYPE_BADGES,
} from '@renderer/constants/masternodes'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AddNodePhase, AddNodeSource, MasternodeAccess, VotingKeyInputKind } from '@renderer/enums/Masternodes'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { setAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import { countLabel } from '@renderer/utils/countLabel'
import { getErrorMessage } from '@renderer/utils/error'
import { addedVotingPower, isNodeAlreadyAdded, nodeWeightLabel } from '@renderer/utils/masternodeNodes'
import { toggledSet } from '@renderer/utils/masternodes'
import { classifyVotingKeyInput, isProTxHash, votingKeyMessage } from '@renderer/utils/votingKey'
import type { AddNodeCandidateProps } from '@renderer/types/MasternodeNodes'
import type { MasternodeDto } from '@renderer/types/Masternodes'
import type { AddNodeModalProps } from '@renderer/types/MasternodeScreens'

function AddNodeCandidate({ node, checked, alreadyAdded, meta, onChange }: AddNodeCandidateProps): React.JSX.Element {
  const status = MASTERNODE_STATUS_PILLS[node.status]
  return (
    <CheckRow label={node.label} checked={checked} disabled={alreadyAdded} onChange={onChange}>
      <div className={'flex min-w-0 flex-col gap-1'}>
        <div className={'flex min-w-0 items-center justify-between gap-3'}>
          <div className={'flex min-w-0 items-center gap-2'}>
            <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{node.label}</Text>
            <CustomBadge {...MASTERNODE_TYPE_BADGES[node.type]} className={'shrink-0'} />
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 tabular-nums'}>{meta}</Text>
        </div>
        <HighlightedIdentifier className={ADD_NODE_PRO_TX_HASH_CLASS}>{node.proTxHash}</HighlightedIdentifier>
      </div>
    </CheckRow>
  )
}

export default function AddNodeModal({
  open,
  onClose,
  initialSource = AddNodeSource.VotingKey,
  expectedProTxHash,
}: AddNodeModalProps): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? undefined
  const network = status?.network ?? PREVIEW_DEFAULT_NETWORK
  const { nodes } = useMasternodes(walletId)
  const keyId = useId()
  const hashId = useId()
  const passwordId = useId()
  const [phase, setPhase] = useState(AddNodePhase.Input)
  const [source, setSource] = useState(initialSource)
  const [votingKey, setVotingKey] = useState('')
  const [proTxHash, setProTxHash] = useState('')
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<MasternodeDto[]>([])
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [addedCount, setAddedCount] = useState(0)
  const [seenOpen, setSeenOpen] = useState(false)

  if (open !== seenOpen) {
    setSeenOpen(open)
    if (open) {
      setPhase(AddNodePhase.Input)
      setSource(initialSource)
      setVotingKey('')
      setProTxHash(expectedProTxHash ?? '')
      setLookupError(null)
      setCandidates([])
      setSelected(new Set())
      setPassword('')
      setPasswordInvalid(false)
      setVerifying(false)
      setAddedCount(0)
    }
  }

  const withKey = source === AddNodeSource.VotingKey
  const access = withKey ? MasternodeAccess.VotingKey : MasternodeAccess.WatchOnly
  const keyKind = classifyVotingKeyInput(votingKey, network)
  const keyMessage = votingKeyMessage(keyKind, network)
  const hashInvalid = proTxHash.trim() !== '' && !isProTxHash(proTxHash)
  const inputValid = withKey ? keyKind === VotingKeyInputKind.Valid : isProTxHash(proTxHash)
  const adding = verifying || phase === AddNodePhase.Adding
  const expectedMissing = expectedProTxHash != null && withKey
    && !candidates.some(node => node.proTxHash === expectedProTxHash)

  const changeSource = (next: AddNodeSource): void => {
    setSource(next)
    setLookupError(null)
  }

  const find = async (): Promise<void> => {
    if (walletId === undefined || !inputValid) return
    setLookupError(null)
    setPhase(AddNodePhase.Finding)
    try {
      const found = withKey
        ? await MasternodePreviewAPI.findMasternodesByVotingKey(walletId, votingKey.trim(), expectedProTxHash)
        : await MasternodePreviewAPI.findMasternode(walletId, proTxHash.trim()).then(node => (node === null ? [] : [node]))
      if (found.length === 0) {
        setLookupError(withKey ? ADD_NODE_COPY.noKeyMatch : ADD_NODE_COPY.noHashMatch)
        setPhase(AddNodePhase.Input)
        return
      }
      setCandidates(found)
      setSelected(new Set(found.filter(node => !isNodeAlreadyAdded(node, nodes, source)).map(node => node.proTxHash)))
      setPassword('')
      setPasswordInvalid(false)
      setPhase(AddNodePhase.Review)
    } catch (e) {
      console.error('masternode lookup failed', e)
      toast.error(`**${ADD_NODE_COPY.lookupFailed}** ${getErrorMessage(e)}`)
      setPhase(AddNodePhase.Input)
    }
  }

  const add = async (): Promise<void> => {
    if (walletId === undefined || selected.size === 0 || adding) return
    if (withKey) {
      if (password.length === 0) return
      setVerifying(true)
      setPasswordInvalid(false)
      let valid: boolean
      try {
        valid = await API.verifyWalletPassword(walletId, password)
      } catch (e) {
        console.error('add masternode failed', e)
        toast.error(`**${ADD_NODE_COPY.addFailed}** ${getErrorMessage(e)}`)
        setVerifying(false)
        return
      }
      setVerifying(false)
      if (!valid) {
        setPasswordInvalid(true)
        return
      }
    }
    const secret = withKey ? password : null
    const hashes = [...selected]
    setPassword('')
    setPhase(AddNodePhase.Adding)
    try {
      const next = await MasternodePreviewAPI.addMasternodes(walletId, hashes, withKey ? votingKey.trim() : null, secret)
      setAsyncCache(MASTERNODE_CACHE_NAMESPACES.nodes, masternodePreviewCacheKey(walletId), next)
      setVotingKey('')
      setAddedCount(hashes.length)
      setPhase(AddNodePhase.Done)
    } catch (e) {
      console.error('add masternode failed', e)
      toast.error(`**${ADD_NODE_COPY.addFailed}** ${getErrorMessage(e)}`)
      setPhase(AddNodePhase.Review)
    }
  }

  let body: React.JSX.Element
  if (phase === AddNodePhase.Input) {
    body = (
      <>
        <SegmentedControl
          appearance={SegmentedControlAppearance.Boxed}
          ariaLabel={ADD_NODE_COPY.sourceLabel}
          options={ADD_NODE_SOURCE_OPTIONS}
          value={source}
          onChange={changeSource}
          className={'mt-5'}
        />
        {withKey ? (
          <div className={'mt-5 flex flex-col'}>
            <label htmlFor={keyId} className={'mb-2'}>
              <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{ADD_NODE_COPY.votingKeyLabel}</Text>
            </label>
            <Input
              id={keyId}
              type={'password'}
              variant={'outlined'}
              colorScheme={keyKind === VotingKeyInputKind.Empty || keyKind === VotingKeyInputKind.Valid ? 'primary' : 'error'}
              placeholder={ADD_NODE_COPY.votingKeyPlaceholder}
              value={votingKey}
              onChange={(event) => { setLookupError(null); setVotingKey(event.target.value) }}
              onKeyDown={(event) => { if (event.key === 'Enter') void find() }}
              spellCheck={false}
              autoComplete={'off'}
              autoFocus
              className={ADD_NODE_INPUT_CLASS}
            />
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-2 px-1'}>{ADD_NODE_COPY.votingKeyHint}</Text>
            {keyMessage !== '' && (
              <Text
                size={12}
                weight={'medium'}
                color={keyKind === VotingKeyInputKind.Valid ? 'brand' : 'red'}
                className={`mt-1 px-1 ${keyKind === VotingKeyInputKind.Valid ? 'text-dash-green!' : ''}`}
              >
                {keyMessage}
              </Text>
            )}
          </div>
        ) : (
          <div className={'mt-5 flex flex-col'}>
            <label htmlFor={hashId} className={'mb-2'}>
              <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{ADD_NODE_COPY.proTxHashLabel}</Text>
            </label>
            <Input
              id={hashId}
              type={'text'}
              variant={'outlined'}
              colorScheme={hashInvalid ? 'error' : 'primary'}
              placeholder={ADD_NODE_COPY.proTxHashPlaceholder}
              value={proTxHash}
              onChange={(event) => { setLookupError(null); setProTxHash(event.target.value) }}
              onKeyDown={(event) => { if (event.key === 'Enter') void find() }}
              spellCheck={false}
              autoComplete={'off'}
              autoFocus
              className={`${ADD_NODE_INPUT_CLASS} font-mono`}
            />
            {hashInvalid && (
              <Text size={12} weight={'medium'} color={'red'} className={'mt-2 px-1'}>{ADD_NODE_COPY.proTxHashInvalid}</Text>
            )}
          </div>
        )}
        {lookupError && (
          <div role={'alert'} className={'mt-2 px-1'}>
            <Text size={12} weight={'medium'} color={'red'}>{lookupError}</Text>
          </div>
        )}
        <ModalActions
          secondary={{ label: ADD_NODE_COPY.cancel, onClick: onClose }}
          primary={{
            label: withKey ? ADD_NODE_COPY.findNodes : ADD_NODE_COPY.findNode,
            onClick: () => { void find() },
            disabled: !inputValid,
          }}
        />
      </>
    )
  } else if (phase === AddNodePhase.Finding) {
    body = <PendingRow label={ADD_NODE_COPY.finding} className={'mt-5'} />
  } else if (phase === AddNodePhase.Done) {
    body = (
      <>
        <div className={'mt-5 mb-1 flex flex-col items-center text-center'}>
          <div className={'success-pop'}>
            <SuccessIcon size={56} />
          </div>
          <Text size={16} weight={'extrabold'} color={'brand'} className={'mt-3'}>
            {`${countLabel(addedCount, COUNT_NOUNS.node)} ${ADD_NODE_COPY.added}`}
          </Text>
        </div>
        <Text reset as={'p'} size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-4 text-center'}>
          {PREVIEW_DONE_NOTE}
        </Text>
        <ModalActions primary={{ label: ADD_NODE_COPY.done, onClick: onClose }} />
      </>
    )
  } else {
    const heading = withKey
      ? `${countLabel(candidates.length, COUNT_NOUNS.node)} ${candidates.length === 1 ? ADD_NODE_COPY.usesThisKey : ADD_NODE_COPY.useThisKey}`
      : `${countLabel(candidates.length, COUNT_NOUNS.node)} ${ADD_NODE_COPY.found}`
    body = (
      <>
        <Text reset as={'p'} size={14} weight={'medium'} color={'brand'} className={'mt-5'}>{heading}</Text>
        {expectedMissing && (
          <Text reset as={'p'} size={12} weight={'medium'} color={'brand'} className={'mt-1 wrap-anywhere text-dash-orange!'}>
            {`${ADD_NODE_COPY.expectedMismatch} ${expectedProTxHash}.`}
          </Text>
        )}
        <FadingScrollArea className={`mt-3 ${ADD_NODE_CANDIDATES_CLASS}`}>
          {candidates.map(node => {
            const alreadyAdded = isNodeAlreadyAdded(node, nodes, source)
            return (
              <AddNodeCandidate
                key={node.proTxHash}
                node={node}
                alreadyAdded={alreadyAdded}
                meta={alreadyAdded ? ADD_NODE_COPY.alreadyAdded : nodeWeightLabel({ type: node.type, access })}
                checked={!alreadyAdded && selected.has(node.proTxHash)}
                onChange={checked => setSelected(current => toggledSet(current, node.proTxHash, checked))}
              />
            )
          })}
        </FadingScrollArea>
        <div className={`mt-4 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
          <div className={ADD_NODE_FACT_ROW_CLASS}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{ADD_NODE_COPY.access}</Text>
            <Text size={12} weight={'medium'} color={'brand'}>{MASTERNODE_ACCESS_LABELS[access]}</Text>
          </div>
          {withKey && (
            <div className={ADD_NODE_FACT_ROW_CLASS}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{ADD_NODE_COPY.votingPower}</Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`+${addedVotingPower(candidates, selected)}`}</Text>
            </div>
          )}
        </div>
        {withKey && (
          <>
            <PasswordField
              id={passwordId}
              value={password}
              onChange={(value) => { setPasswordInvalid(false); setPassword(value) }}
              onSubmit={() => { void add() }}
              error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
              disabled={adding}
              className={'mt-5'}
            />
            <Text reset as={'p'} size={12} weight={'medium'} color={'brand'} opacity={50} className={'mt-2 px-1'}>
              {ADD_NODE_COPY.passwordHint}
            </Text>
          </>
        )}
        <ModalActions
          secondary={{ label: ADD_NODE_COPY.back, onClick: () => setPhase(AddNodePhase.Input), disabled: adding }}
          primary={{
            label: `${ADD_NODE_COPY.add} ${countLabel(selected.size, COUNT_NOUNS.node)}`,
            onClick: () => { void add() },
            disabled: selected.size === 0 || (withKey && password.length === 0),
            loading: adding,
          }}
        />
      </>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ADD_NODE_COPY.title}
      description={phase === AddNodePhase.Input ? ADD_NODE_COPY.description : undefined}
      size={ModalSize.Lg}
      dismissible={!adding}
    >
      <div className={'phase-fade-in'} key={phase === AddNodePhase.Adding ? AddNodePhase.Review : phase}>
        {body}
      </div>
    </Modal>
  )
}
