import { useEffect, useState } from "react"
import { toast } from "../ui/Toast"
import { API } from "@renderer/api"
import { Input } from "../dash-ui-kit-extended"
import { useAuth } from "@renderer/contexts/AuthContext"
import { getErrorMessage } from "@renderer/utils/error"
import { ModalSize } from "@renderer/enums/ModalSize"
import { ModalActionTone } from "@renderer/enums/ModalActionTone"
import Modal from "@renderer/components/ui/Modal"
import ModalActions from "@renderer/components/ui/ModalActions"

const DELETE_CONFIRM_TEXT = 'Delete'

export default function DeleteWallet({isDeleteOpen, setIsDeleteOpen, walletToDelete, walletName, setWalletToDelete, refreshWallets }) {
  const [confirmText, setConfirmText] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const {lock} = useAuth()

  const hasInput = confirmText.trim().length > 0
  const isExactMatch = confirmText.toLowerCase().trim() === DELETE_CONFIRM_TEXT.toLowerCase()

  const showInputError = submitAttempted && hasInput && !isExactMatch

  const handleConfirmDelete = async () => {
    setSubmitAttempted(true)

    if (!isExactMatch) return
    if (!walletToDelete) return

    try {
      await API.deleteWallet(walletToDelete)
      refreshWallets()
      closeDeleteModal()
      lock()
      toast.success('Wallet deleted')
    } catch (e) {
      console.error(e)
      toast.error(`**Delete failed** ${getErrorMessage(e)}`)
    }
  }

  const closeDeleteModal = () => {
    setIsDeleteOpen(false)
    setWalletToDelete(null)
    setConfirmText('')
    setSubmitAttempted(false)
  }

  useEffect(() => {
    if (isDeleteOpen) {
      setConfirmText('')
      setSubmitAttempted(false)
    }
  }, [isDeleteOpen])

  return (
    <>
      <Modal
        open={isDeleteOpen}
        onClose={closeDeleteModal}
        title={"Delete wallet"}
        description={<>Without a recovery phrase backup, funds in <span className={"font-extrabold"}>{walletName ?? 'this wallet'}</span> are lost. Type <span className={"font-extrabold"}>{DELETE_CONFIRM_TEXT}</span> to confirm.</>}
        size={ModalSize.Md}
      >
        <div className={"mt-4.5"}>
          <Input
            id={"delete-wallet-confirmation"}
            type={"text"}
            placeholder={DELETE_CONFIRM_TEXT}
            value={confirmText}
            variant={"outlined"}
            onChange={(e) => setConfirmText(e.target.value)}
            className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
            colorScheme={showInputError  ? 'error' : 'primary'}
          />
        </div>
        <ModalActions
          tone={ModalActionTone.Danger}
          secondary={{ label: 'Cancel', onClick: closeDeleteModal }}
          primary={{ label: 'Delete', onClick: handleConfirmDelete, disabled: !hasInput }}
        />
      </Modal>
    </>
  )
}
