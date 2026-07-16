import { useEffect, useState } from "react"
import { toast } from "../ui/Toast"
import { API } from "@renderer/api"
import { createPortal } from "react-dom"
import { Button, CrossIcon, Input, Text } from "../dash-ui-kit-enxtended"
import { renderBoldText } from "@renderer/utils/renderBoldText"
import { useTheme } from "dash-ui-kit/react"

const DELETE_CONFIRM_TEXT = 'Delete'

export default function DeleteWallet({isDeleteOpen, setIsDeleteOpen, walletToDelete, setWalletToDelete, refreshWallets, selectedWallet }) {
  const [confirmText, setConfirmText] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const {theme} = useTheme()

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
      if (selectedWallet === walletToDelete) {
        // TODO: fallback selected wallet logic
      }
      closeDeleteModal()
      toast.error('Wallet deleted')
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete wallet')
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
      {isDeleteOpen && createPortal(
        <div className={"fixed inset-0 z-99 bg-black/64 flex items-center justify-center"}>
          <div className={"w-full max-w-97.5 rounded-3xl bg-white dark:bg-white/12 p-6 dark:backdrop-blur-[2rem]"}>
            <div className={"flex items-center justify-between"}>
              <Text size={24} weight={"extrabold"} color={"brand"}>
                Delete Wallet
              </Text>
              <button
                className={"dash-text-default hover:opacity-60 cursor-pointer"}
                onClick={closeDeleteModal}
              >
                <CrossIcon size={16} color={"currentColor"} className={"dash-text-default"} />
              </button>
            </div>
            <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-2"}>
            {renderBoldText(`Enter the word **${DELETE_CONFIRM_TEXT}** to confirm the action`)}
            </Text>
            <div className={"mt-4.5"}>
              <Input
                id={"delete-wallet-confirmation"}
                type={"text"}
                placeholder={"Enter Confirmation..."}
                value={confirmText}
                variant={"outlined"}
                onChange={(e) => setConfirmText(e.target.value)}
                className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                colorScheme={showInputError  ? 'error' : 'primary'}
              />
            </div>
            <div className={"mt-4.5 flex gap-2"}>
              <Button
                type={"button"}
                onClick={closeDeleteModal}
                variant={"solid"}
                colorScheme={theme === 'light' ? 'lightBlue-mint' : 'gray'}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                Cancel
              </Button>
              <Button
                type={"button"}
                onClick={handleConfirmDelete}
                disabled={!hasInput}
                variant={"solid"}
                colorScheme={"red-strong"}
                size={"md"}
                className={"flex-1 rounded-[.9375rem]"}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
