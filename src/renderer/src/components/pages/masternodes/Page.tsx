import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AddIcon, Button, Text } from '@renderer/components/dash-ui-kit-extended'
import PageHeader from '@renderer/components/ui/PageHeader'
import PageTabs from '@renderer/components/ui/PageTabs'
import PreviewBadge from '@renderer/components/ui/PreviewBadge'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { LIST_GROUP_LABEL_CLASS } from '@renderer/constants/listToolbar'
import { MASTERNODE_PRESET_OPTIONS, MASTERNODES_PAGE_COPY } from '@renderer/constants/masternodeNodes'
import { PREVIEW_DEFAULT_NETWORK } from '@renderer/constants/masternodePreview'
import {
  CONTESTS_PAGE_SIZE,
  MASTERNODE_PARAMS,
  MASTERNODES_PAGE_SIZE,
  MASTERNODES_TAB_LABELS,
} from '@renderer/constants/masternodes'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ContestSegment, ContestSort, MasternodePreviewPreset, MasternodesTab, NodeSegment } from '@renderer/enums/Masternodes'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { useDetailScrollRestore } from '@renderer/hooks/useDetailScrollRestore'
import { useMasternodePreviewPreset } from '@renderer/hooks/useMasternodePreviewPreset'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import { useMasternodeVotes } from '@renderer/hooks/useMasternodeVotes'
import { useNameContests } from '@renderer/hooks/useNameContests'
import { useNow } from '@renderer/hooks/useNow'
import { enumParam, withParams } from '@renderer/utils/searchParams'
import type { MasternodesNavigationState } from '@renderer/types/MasternodeNodes'
import type { MasternodesPageProps } from '@renderer/types/MasternodeScreens'
import ContestDetail from './contests/ContestDetail'
import ContestsTab from './contests/ContestsTab'
import AddNodeModal from './nodes/AddNodeModal'
import NodeDetail from './nodes/NodeDetail'
import NodesTab from './nodes/NodesTab'
import SummaryStrip from './SummaryStrip'

export default function MasternodesPage({ walletId }: MasternodesPageProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? PREVIEW_DEFAULT_NETWORK
  const now = useNow()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { preset, setPreset } = useMasternodePreviewPreset()
  const { nodes, loading: nodesLoading } = useMasternodes(walletId)
  const { contests, loading: contestsLoading } = useNameContests(walletId)
  const { votes, loading: votesLoading } = useMasternodeVotes(walletId)
  const [nodeQuery, setNodeQuery] = useState('')
  const [nodeVisibleCount, setNodeVisibleCount] = useState(MASTERNODES_PAGE_SIZE)
  const [contestQuery, setContestQuery] = useState('')
  const [contestSort, setContestSort] = useState(ContestSort.EndingSoon)
  const [yourNamesOnly, setYourNamesOnly] = useState(false)
  const [contestVisibleCount, setContestVisibleCount] = useState(CONTESTS_PAGE_SIZE)
  const [addNodeOpen, setAddNodeOpen] = useState(false)

  const tab = enumParam(MasternodesTab, searchParams.get(MASTERNODE_PARAMS.tab), MasternodesTab.Contests)
  const rawSegment = searchParams.get(MASTERNODE_PARAMS.segment)
  const nodeSegment = enumParam(NodeSegment, rawSegment, NodeSegment.All)
  const contestSegment = enumParam(ContestSegment, rawSegment, ContestSegment.Open)
  const contest = searchParams.get(MASTERNODE_PARAMS.contest)
  const node = contest === null ? searchParams.get(MASTERNODE_PARAMS.node) : null
  const detailKey = contest ?? node
  const saveListScroll = useDetailScrollRestore(detailKey)

  const replaceParams = (patch: Record<string, string | null>): void => {
    setSearchParams(withParams(searchParams, patch), { replace: true })
  }

  const openDetail = (param: string, value: string): void => {
    if (detailKey === null) saveListScroll()
    const state: MasternodesNavigationState = { fromList: true }
    setSearchParams(withParams(searchParams, { [param]: value }), { state })
  }

  const closeDetail = (): void => {
    if ((location.state as MasternodesNavigationState | null)?.fromList === true) {
      navigate(-1)
      return
    }
    replaceParams({ [contest !== null ? MASTERNODE_PARAMS.contest : MASTERNODE_PARAMS.node]: null })
  }

  const resetWindows = (): void => {
    setNodeVisibleCount(MASTERNODES_PAGE_SIZE)
    setContestVisibleCount(CONTESTS_PAGE_SIZE)
  }

  const changeTab = (next: string): void => {
    resetWindows()
    replaceParams({ [MASTERNODE_PARAMS.tab]: next, [MASTERNODE_PARAMS.segment]: null })
  }

  const selectNodes = (segment: NodeSegment): void => {
    setNodeVisibleCount(MASTERNODES_PAGE_SIZE)
    replaceParams({ [MASTERNODE_PARAMS.tab]: MasternodesTab.Nodes, [MASTERNODE_PARAMS.segment]: segment })
  }

  const selectContests = (segment: ContestSegment): void => {
    setContestVisibleCount(CONTESTS_PAGE_SIZE)
    replaceParams({ [MASTERNODE_PARAMS.tab]: MasternodesTab.Contests, [MASTERNODE_PARAMS.segment]: segment })
  }

  const changePreset = (next: MasternodePreviewPreset): void => {
    resetWindows()
    setPreset(next)
  }

  const openAddNode = (): void => setAddNodeOpen(true)
  const openContest = (normalizedLabel: string): void => openDetail(MASTERNODE_PARAMS.contest, normalizedLabel)

  let content: React.JSX.Element
  if (contest !== null) {
    content = (
      <ContestDetail
        walletId={walletId}
        now={now}
        normalizedLabel={contest}
        onBack={closeDetail}
        onAddNode={openAddNode}
      />
    )
  } else if (node !== null) {
    content = <NodeDetail walletId={walletId} proTxHash={node} onBack={closeDetail} onOpenContest={openContest} />
  } else {
    const summaryLoading = (nodesLoading && nodes.length === 0)
      || (contestsLoading && contests.length === 0)
      || (votesLoading && votes.length === 0 && nodes.length > 0)
    content = (
      <>
        <PageHeader
          title={PAGE_HEADERS.masternodes.title}
          subtitle={PAGE_HEADERS.masternodes.subtitle}
          titleAddon={(
            <PreviewBadge
              controls={(
                <>
                  <Text size={10} weight={'extrabold'} color={'brand'} opacity={50} className={LIST_GROUP_LABEL_CLASS}>
                    {MASTERNODES_PAGE_COPY.presetLabel}
                  </Text>
                  <SegmentedControl
                    appearance={SegmentedControlAppearance.Boxed}
                    ariaLabel={MASTERNODES_PAGE_COPY.presetLabel}
                    options={MASTERNODE_PRESET_OPTIONS}
                    value={preset}
                    onChange={changePreset}
                    className={'w-full [&>button]:flex-1'}
                  />
                </>
              )}
            />
          )}
          actions={(
            <Button type={'button'} size={'compact'} colorScheme={'primary'} className={'gap-2'} onClick={openAddNode}>
              <AddIcon size={12} color={'currentColor'} />
              {MASTERNODES_PAGE_COPY.addNode}
            </Button>
          )}
        />
        <SummaryStrip
          nodes={nodes}
          contests={contests}
          votes={votes}
          loading={summaryLoading}
          network={network}
          now={now}
          onSelectNodes={selectNodes}
          onSelectContests={selectContests}
          onAddNode={openAddNode}
        />
        <div className={`relative ${SURFACE_PANEL}`}>
          <PageTabs
            value={tab}
            onValueChange={changeTab}
            items={[
              {
                value: MasternodesTab.Contests,
                label: MASTERNODES_TAB_LABELS[MasternodesTab.Contests],
                content: (
                  <ContestsTab
                    walletId={walletId}
                    network={network}
                    now={now}
                    segment={contestSegment}
                    onSegmentChange={selectContests}
                    query={contestQuery}
                    onQueryChange={(query) => { setContestQuery(query); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
                    sort={contestSort}
                    onSortChange={(sort) => { setContestSort(sort); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
                    yourNamesOnly={yourNamesOnly}
                    onYourNamesOnlyChange={(value) => { setYourNamesOnly(value); setContestVisibleCount(CONTESTS_PAGE_SIZE) }}
                    visibleCount={contestVisibleCount}
                    onShowMore={() => setContestVisibleCount(count => count + CONTESTS_PAGE_SIZE)}
                    onOpenContest={openContest}
                    onAddNode={openAddNode}
                  />
                ),
              },
              {
                value: MasternodesTab.Nodes,
                label: MASTERNODES_TAB_LABELS[MasternodesTab.Nodes],
                content: (
                  <NodesTab
                    walletId={walletId}
                    segment={nodeSegment}
                    onSegmentChange={selectNodes}
                    query={nodeQuery}
                    onQueryChange={(query) => { setNodeQuery(query); setNodeVisibleCount(MASTERNODES_PAGE_SIZE) }}
                    visibleCount={nodeVisibleCount}
                    onShowMore={() => setNodeVisibleCount(count => count + MASTERNODES_PAGE_SIZE)}
                    onOpenNode={(proTxHash) => openDetail(MASTERNODE_PARAMS.node, proTxHash)}
                    onAddNode={openAddNode}
                  />
                ),
              },
            ]}
          />
        </div>
      </>
    )
  }

  return (
    <div className={'relative flex flex-col pb-12'}>
      <div className={'px-12'}>{content}</div>
      <AddNodeModal open={addNodeOpen} onClose={() => setAddNodeOpen(false)} />
    </div>
  )
}
