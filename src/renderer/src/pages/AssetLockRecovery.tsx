import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API } from '@renderer/api'
import { AssetLockFundingKind, AssetLockInspection, AssetLockRecoveryDestination } from '@renderer/api/types'
import { useAuth } from '@renderer/contexts/AuthContext'
import { Button, Heading, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { davToDash } from '@renderer/utils/balance'
import { getErrorMessage } from '@renderer/utils/error'

export default function AssetLockRecoveryPage(): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const navigate = useNavigate()

  const [txid, setTxid] = useState('')
  const [inspection, setInspection] = useState<AssetLockInspection | null>(null)
  const [kind, setKind] = useState<AssetLockFundingKind | null>(null)
  const [to, setTo] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovered, setRecovered] = useState(false)

  const handleInspect = async (): Promise<void> => {
    if (walletId == null) return
    setPending(true)
    setError(null)
    setInspection(null)
    setRecovered(false)
    try {
      const result = await API.inspectAssetLock(walletId, txid)
      setInspection(result)
      setKind(result.allowedKinds[0] ?? null)
      setTo(result.recorded?.to ?? '')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  const handleRecover = async (): Promise<void> => {
    if (walletId == null || inspection == null || kind == null) return
    const destination: AssetLockRecoveryDestination = kind === AssetLockFundingKind.Identity
      ? { kind }
      : { kind, to }
    setPending(true)
    setError(null)
    try {
      await API.recoverAssetLock(walletId, inspection.txid, password, destination)
      setRecovered(true)
      setPassword('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setPending(false)
    }
  }

  const rows: [string, string][] = inspection == null ? [] : [
    ['Txid', inspection.txid],
    ['Credit address', inspection.address],
    ['Amount', `${davToDash(inspection.amountDuffs)} DASH`],
    ['Credit key', `${inspection.source} #${inspection.index} (${inspection.derivationPath})`],
    ['Recorded', inspection.recorded == null
      ? 'no'
      : `${inspection.recorded.status} / ${inspection.recorded.kind} -> ${inspection.recorded.to ?? '-'}`],
    ['Identity', inspection.identityId == null
      ? '-'
      : `${inspection.identityId} (${inspection.identityExists === true ? 'exists' : 'not on Platform'})`],
  ]

  return (
    <div className="w-full px-12 pb-12">
      <div className="dash-card-base rounded-3xl p-8 flex flex-col gap-4">
        <Heading as="h1" size="xl" weight="extrabold" color="brand-white">
          Asset lock recovery (test)
        </Heading>

        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Asset lock txid"
            value={txid}
            variant="outlined"
            colorScheme="primary"
            onChange={(e) => setTxid(e.target.value)}
            className="h-10 flex-1 rounded-[.75rem] bg-transparent!"
          />
          <Button
            onClick={handleInspect}
            disabled={walletId == null || pending || txid.trim() === ''}
            variant="solid"
            colorScheme="primary-light"
            size="sm"
            className="min-h-0! py-2! rounded-[.75rem]"
          >
            Inspect
          </Button>
        </div>

        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4">
            <Text size={14} opacity={50} className="w-32 shrink-0">{label}</Text>
            <Text size={14} className="break-all">{value}</Text>
          </div>
        ))}

        {inspection != null && kind != null && (
          <div className="flex flex-col gap-3">
            <SegmentedControl
              options={inspection.allowedKinds.map((value) => ({ value, label: value }))}
              value={kind}
              onChange={setKind}
            />
            {kind !== AssetLockFundingKind.Identity && (
              <Input
                type="text"
                placeholder={kind === AssetLockFundingKind.IdentityTopUp ? 'Identity id' : 'Destination address'}
                value={to}
                variant="outlined"
                colorScheme="primary"
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-[.75rem] bg-transparent!"
              />
            )}
            <div className="flex items-center gap-2">
              <Input
                type="password"
                placeholder="Wallet password"
                value={password}
                variant="outlined"
                colorScheme="primary"
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 flex-1 rounded-[.75rem] bg-transparent!"
              />
              <Button
                onClick={handleRecover}
                disabled={pending || password === '' || (kind !== AssetLockFundingKind.Identity && to.trim() === '')}
                variant="solid"
                colorScheme="primary-light"
                size="sm"
                className="min-h-0! py-2! rounded-[.75rem]"
              >
                Recover
              </Button>
            </div>
          </div>
        )}

        {recovered && (
          <div className="flex items-center gap-2">
            <Text size={14}>Recorded as an unfinished funding. Resume it from the Send page.</Text>
            <Button onClick={() => navigate('/send')} variant="outline" size="sm" className="min-h-0! py-2! rounded-[.75rem]">
              Open Send
            </Button>
          </div>
        )}

        {error != null && <Text size={14} color="red">{error}</Text>}
      </div>
    </div>
  )
}
