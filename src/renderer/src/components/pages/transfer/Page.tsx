import { useAssetSelector } from "@renderer/hooks/useAssetSelector";
import { useEffect, useMemo, useState } from "react";
import { selectAssetData, TransferPageType } from "@renderer/constants";
import { API } from "@renderer/api";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { davToDash, dashToDuffs } from "@renderer/utils/balance";
import { isValidDashAddress } from "@renderer/utils/address";
import { WalletBalanceDto } from "@renderer/api/types";
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
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const { format: formatFiat, rateReady } = useFiat()

  const [balanceDuffs, setBalanceDuffs] = useState<bigint>(0n)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadBalance = (): (() => void) => {
    if (!walletId) {
      setBalanceDuffs(0n)
      return () => {}
    }
    let cancelled = false
    API.getWalletBalance(walletId)
      .then((data) => {
        if (cancelled) return
        const balance = data as WalletBalanceDto
        setBalanceDuffs(BigInt(balance?.dash?.amount ?? 0n))
      })
      .catch((e) => console.error('getWalletBalance failed', e))
    return () => { cancelled = true }
  }

  useEffect(loadBalance, [walletId])

  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])

  const handleMax = (): void => {
    setAmount(davToDash(balanceDuffs))
  }

  const recipientValid = recipient.trim().length === 0 || isValidDashAddress(recipient, network ?? undefined)
  const amountPositive = amountDuffs > 0n
  const amountWithinBalance = amountDuffs <= balanceDuffs
  const canProceed =
    recipient.trim().length > 0 &&
    isValidDashAddress(recipient, network ?? undefined) &&
    amountPositive &&
    amountWithinBalance

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
          loadBalance()
        }}
      />
    </>
  )
}
