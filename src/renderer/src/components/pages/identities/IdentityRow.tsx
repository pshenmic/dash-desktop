import { ArrowIcon, ExternalLinkIcon, HighlightedIdentifier, KeyIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-extended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { ADDRESS_ROW_FIAT_CLASS, ADDRESS_ROW_ICON_BUTTON_CLASS, ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import {
  IDENTITY_ROW_ACTIONS_CLASS,
  IDENTITY_ROW_CLASS,
  IDENTITY_ROW_CONTENT_CLASS,
  IDENTITY_ROW_COPY,
  IDENTITY_ROW_TRAILING_CLASS,
} from '@renderer/constants/identities'
import { ROW_OPEN_OVERLAY_CLASS } from '@renderer/constants/listToolbar'
import { useAuth } from '@renderer/contexts/AuthContext'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useFiat } from '@renderer/hooks/useFiat'
import type { ContextMenuItem } from '@renderer/types/ContextMenu'
import type { IdentityRowProps } from '@renderer/types/Identities'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { creditsToDuffs } from '@renderer/utils/balance'
import { copyWithToast } from '@renderer/utils/clipboard'
import { identityUrl, openExternal } from '@renderer/utils/explorer'
import { identityLabel, identityName } from '@renderer/utils/identifierFormat'
import { identityKeysCountLabel } from '@renderer/utils/identityKeySetup'

export default function IdentityRow({ identity, onOpen }: IdentityRowProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { isBalanceVisible } = useBalanceVisibility()
  const { format: formatFiat, rateReady } = useFiat()
  const name = identityName(identity)
  const extraNames = Math.max(0, identity.aliasesList.length - 1)
  const keysLabel = identityKeysCountLabel(identity.keys.length)
  const balance = identity.balance.amount
  const explorerUrl = network == null ? null : identityUrl(identity.identifier, network)

  const items: ContextMenuItem[] = [
    { id: 'keys', label: IDENTITY_ROW_COPY.manageKeys, icon: <KeyIcon size={10} color={'currentColor'} />, onSelect: () => onOpen(identity.identifier) },
    { id: 'copy', label: IDENTITY_ROW_COPY.copyId, icon: <CopyIcon2 size={10} color={'currentColor'} />, onSelect: () => copyWithToast(identity.identifier) },
  ]
  if (explorerUrl != null) {
    items.push({ id: 'explorer', label: IDENTITY_ROW_COPY.explorer, icon: <ExternalLinkIcon size={10} color={'currentColor'} />, onSelect: () => openExternal(explorerUrl) })
  }

  const identifierLine = (
    <span className={'flex min-w-0 items-center gap-[.3125rem]'}>
      <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{identity.identifier}</HighlightedIdentifier>
      <span className={IDENTITY_ROW_ACTIONS_CLASS}>
        <CopyButton text={identity.identifier} className={'shrink-0'} />
        {explorerUrl != null && (
          <button
            type={'button'}
            onClick={() => openExternal(explorerUrl)}
            title={IDENTITY_ROW_COPY.explorer}
            aria-label={IDENTITY_ROW_COPY.explorer}
            className={ADDRESS_ROW_ICON_BUTTON_CLASS}
          >
            <ExternalLinkIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
          </button>
        )}
      </span>
    </span>
  )
  const keysCaption = <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'whitespace-nowrap'}>{keysLabel}</Text>

  return (
    <ContextMenu title={IDENTITY_ROW_COPY.menuTitle} items={items}>
      <li className={IDENTITY_ROW_CLASS}>
        <button
          type={'button'}
          onClick={() => onOpen(identity.identifier)}
          aria-label={`${IDENTITY_ROW_COPY.open} ${identityLabel(identity)}`}
          className={ROW_OPEN_OVERLAY_CLASS}
        />
        <span className={'pointer-events-none flex'}>
          <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Sm} />
        </span>
        <div className={IDENTITY_ROW_CONTENT_CLASS}>
          {name != null ? (
            <>
              <div className={'flex min-w-0 items-center gap-1.5'}>
                <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{name}</Text>
                {extraNames > 0 && <CustomBadge variant={'muted'} text={`+${extraNames}`} className={'shrink-0'} />}
              </div>
              <div className={'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5'}>
                {identifierLine}
                {keysCaption}
              </div>
            </>
          ) : (
            <>
              {identifierLine}
              {keysCaption}
            </>
          )}
        </div>
        <div className={IDENTITY_ROW_TRAILING_CLASS}>
          <SensitiveValue hidden={!isBalanceVisible} size={'card'}>
            <Text size={14} weight={'medium'} color={'brand'}>
              <CreditsAmount credits={balance} compact showFiat={false} align={'end'} amountClassName={'font-bold'} />
            </Text>
            {rateReady && <span className={ADDRESS_ROW_FIAT_CLASS}>{formatApproxFiat(formatFiat(creditsToDuffs(balance)))}</span>}
          </SensitiveValue>
          <ArrowIcon size={9} color={'currentColor'} className={'rotate-180 opacity-40 dash-text-default'} />
        </div>
      </li>
    </ContextMenu>
  )
}
