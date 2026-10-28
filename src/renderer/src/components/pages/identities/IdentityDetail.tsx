import { useNavigate } from 'react-router-dom'
import { AddIcon, Button, CreditsIcon, ExternalLinkIcon, HighlightedIdentifier, IdenticonIcon, KeyIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import TransactionDetailToken from '@renderer/components/pages/transactions/TransactionDetailToken'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { ADDRESS_ROW_ICON_BUTTON_CLASS } from '@renderer/constants/addressRow'
import {
  IDENTITIES_ROUTES,
  IDENTITY_DETAIL_COPY,
  IDENTITY_DETAIL_ROOT_CLASS,
  IDENTITY_DETAIL_SKELETON_ROWS,
  IDENTITY_TOKEN_ICON_CLASS,
} from '@renderer/constants/identities'
import { IDENTITY_KEYS_COPY } from '@renderer/constants/identityKeys'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { TRANSACTION_DETAIL_CARD_CLASS, TRANSACTION_DETAIL_IDENTIFIER_CLASS } from '@renderer/constants/transactionsPage'
import { useAuth } from '@renderer/contexts/AuthContext'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useFiat } from '@renderer/hooks/useFiat'
import { refreshIdentities, useIdentities } from '@renderer/hooks/useIdentities'
import type { IdentityDetailProps } from '@renderer/types/Identities'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { creditsToDuffs } from '@renderer/utils/balance'
import { identityUrl, openExternal } from '@renderer/utils/explorer'
import { identityName } from '@renderer/utils/identifierFormat'
import { activeKeysCount, identityAddKeysHref } from '@renderer/utils/identities'
import { identityKeysCountLabel } from '@renderer/utils/identityKeySetup'
import IdentityKeysSection from './keys/IdentityKeysSection'

export default function IdentityDetail({ walletId, identifier }: IdentityDetailProps): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const network = status?.network ?? null
  const { isBalanceVisible } = useBalanceVisibility()
  const { format: formatFiat, rateReady, currency } = useFiat()
  const { identities, loading, err } = useIdentities(walletId)
  const identity = identities.find(entry => entry.identifier === identifier)
  const back = (): void => {
    navigate(IDENTITIES_ROUTES.root)
  }

  if (identity == null) {
    let body: React.JSX.Element
    if (loading) {
      body = <ListSkeleton rows={IDENTITY_DETAIL_SKELETON_ROWS} rowClassName={'h-12 rounded-[.875rem]'} />
    } else if (err != null) {
      body = <NoResults tone={NoResultsTone.Error} noResults={IDENTITY_DETAIL_COPY.loadFailed} action={<RetryButton onRetry={() => refreshIdentities(walletId)} />} />
    } else {
      body = (
        <NoResults
          noResults={IDENTITY_DETAIL_COPY.missing}
          action={<Button type={'button'} size={'compact'} colorScheme={'primary'} onClick={back}>{IDENTITY_DETAIL_COPY.backToIdentities}</Button>}
        />
      )
    }
    return (
      <div className={IDENTITY_DETAIL_ROOT_CLASS}>
        <PageHeader title={IDENTITY_DETAIL_COPY.title} onBack={back} backLabel={PAGE_HEADERS.identity.back} />
        {body}
      </div>
    )
  }

  const name = identityName(identity)
  const extraNames = Math.max(0, identity.usernames.length - 1)
  const balance = identity.balance.amount

  return (
    <div className={IDENTITY_DETAIL_ROOT_CLASS}>
      <PageHeader
        title={<span className={'[overflow-wrap:anywhere]'}>{name ?? IDENTITY_DETAIL_COPY.title}</span>}
        titleAddon={extraNames > 0 && <CustomBadge variant={'muted'} text={`+${extraNames}`} className={'shrink-0'} />}
        subtitle={PAGE_HEADERS.identity.subtitle}
        onBack={back}
        backLabel={PAGE_HEADERS.identity.back}
        actions={
          <Button type={'button'} size={'compact'} colorScheme={'primary'} className={'h-8! gap-2'} onClick={() => navigate(identityAddKeysHref(identity.identifier))}>
            <AddIcon size={12} color={'currentColor'} />
            {IDENTITY_KEYS_COPY.addKeys}
          </Button>
        }
      />

      <div className={'flex flex-col gap-4'}>
        <div className={TRANSACTION_DETAIL_CARD_CLASS}>
          <div className={'flex min-w-0 items-center gap-3'}>
            <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Md} />
            <div className={'flex min-w-0 flex-1 flex-col gap-1'}>
              {name != null && <Text reset size={16} weight={'bold'} color={'brand'} className={'min-w-0 truncate'}>{name}</Text>}
              <div className={'flex min-w-0 items-center gap-[.3125rem]'}>
                <HighlightedIdentifier className={TRANSACTION_DETAIL_IDENTIFIER_CLASS}>{identity.identifier}</HighlightedIdentifier>
                <CopyButton text={identity.identifier} className={'shrink-0'} />
                {network != null && (
                  <button
                    type={'button'}
                    onClick={() => openExternal(identityUrl(identity.identifier, network))}
                    title={IDENTITY_DETAIL_COPY.explorer}
                    aria-label={IDENTITY_DETAIL_COPY.explorer}
                    className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                  >
                    <ExternalLinkIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className={'grid grid-cols-1 lg:grid-cols-3 gap-3'}>
            <TransactionDetailToken
              icon={<CreditsIcon size={12} color={'currentColor'} className={IDENTITY_TOKEN_ICON_CLASS} />}
              label={IDENTITY_DETAIL_COPY.balance}
              value={
                <SensitiveValue hidden={!isBalanceVisible} size={'card'} tone={'accent'}>
                  <Text size={14} weight={'extrabold'} color={'brand'}>
                    <CreditsAmount credits={balance} compact showFiat={false} align={'end'} />
                  </Text>
                </SensitiveValue>
              }
              subValue={rateReady && isBalanceVisible && formatApproxFiat(formatFiat(creditsToDuffs(balance)), currency)}
            />
            <TransactionDetailToken
              icon={<IdenticonIcon size={12} color={'currentColor'} className={IDENTITY_TOKEN_ICON_CLASS} />}
              label={IDENTITY_DETAIL_COPY.usernames}
              value={<Text size={14} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>{identity.usernames.length}</Text>}
            />
            <TransactionDetailToken
              icon={<KeyIcon size={12} color={'currentColor'} className={IDENTITY_TOKEN_ICON_CLASS} />}
              label={IDENTITY_DETAIL_COPY.keys}
              value={<Text size={14} weight={'extrabold'} color={'brand'}>{identityKeysCountLabel(identity.keys.length)}</Text>}
              subValue={`${activeKeysCount(identity.keys)} ${IDENTITY_DETAIL_COPY.active}`}
            />
          </div>
        </div>

        <IdentityKeysSection walletId={walletId} identity={identity} />
      </div>
    </div>
  )
}
