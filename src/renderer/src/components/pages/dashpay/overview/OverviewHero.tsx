import { ExternalLinkIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { IdenticonIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import CopyButton from '@renderer/components/ui/CopyButton'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { ADDRESS_ROW_EXPLORER_LABEL, ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import {
  OVERVIEW_COPY,
  OVERVIEW_EXPLORER_BUTTON_CLASS,
  OVERVIEW_FIAT_PILL_CLASS,
  OVERVIEW_HERO_ACTIONS_CLASS,
  OVERVIEW_HERO_ART,
  OVERVIEW_HERO_CLASS,
  OVERVIEW_HERO_CONTENT_CLASS,
} from '@renderer/constants/dashPayOverview'
import { HERO_GLOW, HERO_GRID_BACKDROP_DARK, HERO_GRID_BACKDROP_LIGHT } from '@renderer/constants/heroBackdrop'
import { useAuth } from '@renderer/contexts/AuthContext'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { useBalanceVisibility } from '@renderer/hooks/useBalanceVisibility'
import { useFiat } from '@renderer/hooks/useFiat'
import type {
  IdentityHeroContentProps,
  OnboardingHeroContentProps,
  OverviewHeroArtProps,
  OverviewHeroProps,
} from '@renderer/types/DashPayOverview'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { creditsToDuffs } from '@renderer/utils/balance'
import { identityUrl, openExternal } from '@renderer/utils/explorer'
import { identityName } from '@renderer/utils/identifierFormat'

function HeroArt({ identity, orbit }: OverviewHeroArtProps): React.JSX.Element {
  return (
    <div aria-hidden={'true'} className={OVERVIEW_HERO_ART.frame}>
      <div className={OVERVIEW_HERO_ART.ring} />
      <div className={OVERVIEW_HERO_ART.tile}>
        <span className={OVERVIEW_HERO_ART.tileInner}>
          {identity == null
            ? <IdenticonIcon size={28} color={'currentColor'} className={'dash-text-default opacity-30'} />
            : <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Xl} />}
        </span>
      </div>
      {OVERVIEW_HERO_ART.positions.map((position, index) => {
        const identifier = orbit[index]
        return (
          <span
            key={position}
            className={`${OVERVIEW_HERO_ART.chip} ${position} ${identifier == null ? OVERVIEW_HERO_ART.chipEmpty : ''}`}
          >
            {identifier != null && <IdentityAvatar identifier={identifier} size={IdentityAvatarSize.Xs} />}
          </span>
        )
      })}
    </div>
  )
}

function IdentityContent({ identity }: IdentityHeroContentProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { isBalanceVisible } = useBalanceVisibility()
  const { format: formatFiat, rateReady, currency } = useFiat()
  const name = identityName(identity)
  const extraNames = Math.max(0, identity.aliasesList.length - 1)
  const balance = identity.balance.amount

  return (
    <>
      <div className={'flex min-w-0 items-center gap-3'}>
        <IdentityAvatar identifier={identity.identifier} size={IdentityAvatarSize.Lg} />
        {name != null && (
          <div className={'flex min-w-0 items-center gap-2'}>
            <Text reset size={24} weight={'extrabold'} color={'brand'} className={'min-w-0 truncate leading-[120%] tracking-[-0.02em]'}>
              {name}
            </Text>
            {extraNames > 0 && <CustomBadge variant={'muted'} text={`+${extraNames}`} className={'shrink-0'} />}
          </div>
        )}
      </div>
      <div className={'flex min-w-0 items-center gap-[.3125rem]'}>
        <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{identity.identifier}</HighlightedIdentifier>
        <CopyButton text={identity.identifier} className={'shrink-0'} />
        {network != null && (
          <button
            type={'button'}
            onClick={() => openExternal(identityUrl(identity.identifier, network))}
            title={ADDRESS_ROW_EXPLORER_LABEL}
            aria-label={ADDRESS_ROW_EXPLORER_LABEL}
            className={OVERVIEW_EXPLORER_BUTTON_CLASS}
          >
            <ExternalLinkIcon size={10} color={'currentColor'} className={'dash-text-default opacity-50'} />
          </button>
        )}
      </div>
      <div className={'flex flex-col gap-1'}>
        <Text reset size={12} weight={'medium'} color={'brand'} opacity={50}>{OVERVIEW_COPY.identityBalance}</Text>
        <div className={'flex flex-wrap items-center gap-2.5'}>
          <Text reset size={20} weight={'extrabold'} color={'blue-mint'} className={`leading-[120%] ${balance === 0n ? 'text-dash-orange!' : ''}`}>
            <SensitiveValue hidden={!isBalanceVisible} size={'card'} tone={'accent'}>
              <CreditsAmount credits={balance} compact showFiat={false} unitClassName={'text-sm font-medium'} />
            </SensitiveValue>
          </Text>
          {rateReady && isBalanceVisible && balance > 0n && (
            <span className={OVERVIEW_FIAT_PILL_CLASS}>
              <Text reset size={12} weight={'medium'} color={'blue-mint'} className={'whitespace-nowrap'}>
                {formatApproxFiat(formatFiat(creditsToDuffs(balance)), currency)}
              </Text>
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function OnboardingContent({ body }: OnboardingHeroContentProps): React.JSX.Element {
  return (
    <>
      <Text reset size={10} weight={'extrabold'} color={'blue-mint'} className={'uppercase tracking-[.12em]'}>
        {OVERVIEW_COPY.onboardingEyebrow}
      </Text>
      <Text as={'h2'} reset size={32} weight={'medium'} color={'brand'} className={'max-w-[17rem] leading-[115%] tracking-[-0.03em]'}>
        {OVERVIEW_COPY.onboardingTitle}
      </Text>
      <Text as={'p'} reset size={12} weight={'medium'} color={'brand'} opacity={50} className={'max-w-[17rem] leading-[150%]'}>
        {body}
      </Text>
    </>
  )
}

export default function OverviewHero({ identity, ready, orbit, body, actions }: OverviewHeroProps): React.JSX.Element {
  return (
    <section className={OVERVIEW_HERO_CLASS}>
      <div className={HERO_GRID_BACKDROP_LIGHT} />
      <div className={HERO_GRID_BACKDROP_DARK} />
      <div className={HERO_GLOW} />
      <HeroArt identity={identity} orbit={orbit} />
      <div className={OVERVIEW_HERO_CONTENT_CLASS}>
        {ready && identity != null ? (
          <>
            <Text reset size={10} weight={'extrabold'} color={'blue-mint'} className={'uppercase tracking-[.12em]'}>
              {OVERVIEW_COPY.actingAs}
            </Text>
            <IdentityContent identity={identity} />
          </>
        ) : <OnboardingContent body={body} />}
      </div>
      <div className={OVERVIEW_HERO_ACTIONS_CLASS}>{actions}</div>
    </section>
  )
}
