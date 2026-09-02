import { DashLogo } from 'dash-ui-kit/react'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { DASH_DESKTOP_VERSION } from '@renderer/constants/settingsPage'
import SettingsDetailHeader from './SettingsDetailHeader'
import SettingsSection from './SettingsSection'

export default function AboutSettings(): React.JSX.Element {
  return (
    <div className="w-full pb-12">
      <SettingsDetailHeader primary="About" secondary="Dash Desktop Wallet" />
      <div className="mt-8 px-12">
          <SettingsSection title="Application">
            <div className="flex items-center gap-5 px-5 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-dash-brand/10 dark:bg-dash-mint/10">
                <DashLogo containerSize={42} />
              </div>
              <div className="flex min-w-0 flex-col">
                <Text as="h2" size={20} weight="medium" color="brand">
                  Dash Desktop Wallet
                </Text>
                <Text as="p" reset size={12} weight="normal" color="brand" opacity={50} className="mt-1">
                  A cross-platform desktop wallet for the Dash network.
                </Text>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-dash-primary-dark-blue/10 px-5 py-4 dark:border-white/10">
              <Text size={14} weight="medium" color="brand">Version</Text>
              <Text size={14} weight="medium" color="brand" opacity={50}>{DASH_DESKTOP_VERSION}</Text>
            </div>
            <div className="flex items-center justify-between border-t border-dash-primary-dark-blue/10 px-5 py-4 dark:border-white/10">
              <Text size={14} weight="medium" color="brand">Network support</Text>
              <Text size={14} weight="medium" color="brand" opacity={50}>Mainnet and Testnet</Text>
            </div>
          </SettingsSection>
      </div>
    </div>
  )
}
