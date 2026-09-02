import CoreTab from './CoreTab'
import SettingsDetailHeader from '@renderer/components/pages/settings/SettingsDetailHeader'

export default function ConnectionSettings(): React.JSX.Element {
  return (
    <div className="w-full pb-12">
      <SettingsDetailHeader primary="P2P" secondary="Connection Settings" />

      <div className="mt-8 px-12">
        <CoreTab />
      </div>
    </div>
  )
}
