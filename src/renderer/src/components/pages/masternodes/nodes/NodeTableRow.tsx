import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ChevronIcon, CopyIcon2, DeleteIcon, ExternalLinkIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import { NODE_ROW_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_ACCESS_LABELS, MASTERNODE_STATUS_PILLS, MASTERNODE_TABLE_GRID, MASTERNODE_TYPE_BADGES } from '@renderer/constants/masternodes'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { MasternodeAccess } from '@renderer/enums/Masternodes'
import { formatCreationDate } from '@renderer/utils/date'
import { nodeWeightLabel } from '@renderer/utils/masternodeNodes'
import type { NodeTableRowProps } from '@renderer/types/MasternodeNodes'

export default function NodeTableRow({ node, onOpen, onRemove }: NodeTableRowProps): React.JSX.Element {
  const status = MASTERNODE_STATUS_PILLS[node.status]
  const access = node.access === MasternodeAccess.VotingKey
    ? `${NODE_ROW_COPY.added} ${formatCreationDate(new Date(node.addedAt))}`
    : NODE_ROW_COPY.noVotingKey

  return (
    <ContextMenu
      title={NODE_ROW_COPY.menuTitle}
      items={[
        {
          id: 'open',
          label: NODE_ROW_COPY.open,
          icon: <ExternalLinkIcon size={10} color={'currentColor'} />,
          onSelect: () => onOpen(node.proTxHash),
        },
        {
          id: 'copy',
          label: NODE_ROW_COPY.copy,
          icon: <CopyIcon2 color={'currentColor'} />,
          onSelect: () => { void navigator.clipboard.writeText(node.proTxHash) },
        },
        {
          id: 'remove',
          label: NODE_ROW_COPY.remove,
          icon: <DeleteIcon size={10} color={'currentColor'} />,
          tone: 'danger',
          onSelect: () => onRemove(node),
        },
      ]}
    >
      <button type={'button'} onClick={() => onOpen(node.proTxHash)} className={`${SECTION_TABLE_ROW} ${MASTERNODE_TABLE_GRID}`}>
        <div className={'flex min-w-0 flex-col gap-1'}>
          <div className={'flex min-w-0 items-center gap-2'}>
            <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{node.label}</Text>
            <CustomBadge {...MASTERNODE_TYPE_BADGES[node.type]} className={'shrink-0'} />
          </div>
          <HighlightedIdentifier ellipsis className={'text-[.625rem]! opacity-70'}>{node.proTxHash}</HighlightedIdentifier>
        </div>
        <div className={'flex min-w-0'}>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <div className={'flex min-w-0 flex-col gap-1'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{MASTERNODE_ACCESS_LABELS[node.access]}</Text>
          <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'truncate'}>{access}</Text>
        </div>
        <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{nodeWeightLabel(node)}</Text>
        <ChevronIcon size={12} color={'currentColor'} className={'-rotate-90 justify-self-end dash-text-default opacity-50'} />
      </button>
    </ContextMenu>
  )
}
