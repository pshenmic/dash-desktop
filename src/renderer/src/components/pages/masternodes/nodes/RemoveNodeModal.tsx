import { useState } from 'react'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { toast } from '@renderer/components/ui/Toast'
import { MasternodePreviewAPI } from '@renderer/api/preview/MasternodePreviewAPI'
import { masternodePreviewCacheKey } from '@renderer/api/preview/previewStore'
import { REMOVE_NODE_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_CACHE_NAMESPACES } from '@renderer/constants/masternodes'
import { MasternodeAccess } from '@renderer/enums/Masternodes'
import { ModalActionTone } from '@renderer/enums/ModalActionTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { setAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { refreshMasternodeVotes } from '@renderer/hooks/useMasternodeVotes'
import { getErrorMessage } from '@renderer/utils/error'
import type { RemoveNodeModalProps } from '@renderer/types/MasternodeNodes'

export default function RemoveNodeModal({ open, onClose, walletId, node, onRemoved }: RemoveNodeModalProps): React.JSX.Element {
  const [shown, setShown] = useState(node)
  const [removing, setRemoving] = useState(false)
  if (node !== null && node !== shown) setShown(node)

  const remove = async (): Promise<void> => {
    if (shown === null || removing) return
    setRemoving(true)
    try {
      const nodes = await MasternodePreviewAPI.removeMasternode(walletId, shown.proTxHash)
      setAsyncCache(MASTERNODE_CACHE_NAMESPACES.nodes, masternodePreviewCacheKey(walletId), nodes)
      void refreshMasternodeVotes(walletId)
      toast.success(`**${REMOVE_NODE_COPY.removed}** ${shown.label}`)
      onClose()
      onRemoved?.()
    } catch (e) {
      console.error('remove masternode failed', e)
      toast.error(`**${REMOVE_NODE_COPY.failed}** ${getErrorMessage(e)}`)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${REMOVE_NODE_COPY.titlePrefix} ${shown?.label ?? ''}?`}
      description={shown?.access === MasternodeAccess.WatchOnly ? REMOVE_NODE_COPY.watchOnlyDescription : REMOVE_NODE_COPY.votingKeyDescription}
      size={ModalSize.Sm}
      dismissible={!removing}
    >
      <ModalActions
        tone={ModalActionTone.Danger}
        secondary={{ label: REMOVE_NODE_COPY.cancel, onClick: onClose, disabled: removing }}
        primary={{ label: REMOVE_NODE_COPY.remove, onClick: () => { void remove() }, loading: removing }}
      />
    </Modal>
  )
}
