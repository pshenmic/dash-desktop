import { useAssetSelector } from "@renderer/hooks/useAssetSelector";
import { useMemo, useState } from "react";
import { selectAssetData, TransferPageType } from "@renderer/constants";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance, refreshBalance } from "@renderer/hooks/useWalletBalance";
import { refreshTransactions } from "@renderer/hooks/useWalletTransactions";
import { davToDash, dashToDuffs } from "@renderer/utils/balance";
import { isValidDashAddress } from "@renderer/utils/address";
import Header from "./Header";
import AssetSelectorModal from "@renderer/components/modal/AssetSelectorModal";
import SendConfirmModal from "@renderer/components/modal/SendConfirmModal";
import AmountInput from "./AmountInput";
import RecipientInput from "./RecipientInput";
import AmountSummary from "./AmountSummary";

export default function TransferPage({pageData}: {pageData: TransferPageType}): React.JSX.Element {
  const { selectedAsset, assets, showModal, closeModal, selectAsset, openModal } = useAssetSelector()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const assetSelector = selectAssetData

  const { status } = useAuth()
  const { fallbackActive: syncIncomplete } = useConnectionModeContext()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const { format: formatFiat, rateReady } = useFiat()

  const { balance } = useWalletBalance(walletId ?? undefined)
  const balanceDuffs = balance.dash.amount
  const [confirmOpen, setConfirmOpen] = useState(false)

  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])

  const handleMax = (): void => {
    setAmount(davToDash(balanceDuffs))
  }

  const addressValid = isValidDashAddress(recipient, network ?? undefined)
  const recipientValid = recipient.trim().length === 0 || addressValid
  const amountPositive = amountDuffs > 0n
  const amountWithinBalance = amountDuffs <= balanceDuffs
  const canProceed = addressValid && amountPositive && amountWithinBalance

  const amountFiat = rateReady && amountPositive ? formatFiat(amountDuffs) : undefined

  return (
    <>
    <div className={`relative flex flex-col pb-12 ${showModal ? 'hidden' : ''}`}>
      <div>
        <Header selectedAsset={selectedAsset} openModal={openModal} data={pageData.header}/>
        <div className={"flex w-full justify-center flex-1"} >
          <div className={"flex flex-col w-115 mt-18.25 pb-18.25"}>
            <AmountInput
              value={amount}
              onChange={setAmount}
              onMax={handleMax}
              balanceLabel={`${pageData.header.balance}: ${davToDash(balanceDuffs)} Dash`}
              fiatPreview={amountFiat}
              overBalance={amountPositive && !amountWithinBalance}
            />
            <RecipientInput
              value={recipient}
              onChange={setRecipient}
              data={pageData.recipient}
            />
            {!recipientValid && (
              <span className={"mt-2 text-[.75rem] text-dash-red"}>
                Enter a valid Dash {network ?? ''} address.
              </span>
            )}
          </div>
        </div>
      </div>
      <AmountSummary
        data={pageData.amountSummary}
        amountDuffs={amountDuffs}
        amountFiat={amountFiat}
        canProceed={canProceed}
        blocked={syncIncomplete}
        onSubmit={() => setConfirmOpen(true)}
      />
    </div>
    <AssetSelectorModal
        isOpen={showModal}
        onClose={closeModal}
        assets={assets}
        selectedAssetId={selectedAsset?.id}
        onSelectAsset={selectAsset}
        data={assetSelector}
        balances={{ dash: davToDash(balanceDuffs) }}
      />
    <SendConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        walletId={walletId}
        network={network}
        toAddress={recipient.trim()}
        amountDuffs={amountDuffs}
        amountFiat={amountFiat}
        onSuccess={() => {
          setRecipient('')
          setAmount('')
          if (walletId) {
            refreshBalance(walletId)
            refreshTransactions(walletId)
          }
        }}
      />
    </>
  )
}
