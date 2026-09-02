import { useFiat } from '@renderer/hooks/useFiat'
import { useThemePreference, setThemePreference } from '@renderer/hooks/useThemeController'
import { useZoomPreference, setZoomPreference } from '@renderer/hooks/useZoomController'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { CURRENCY_OPTIONS, THEME_OPTIONS, ZOOM_OPTIONS } from '@renderer/constants/settingsPage'
import SettingsDetailHeader from './SettingsDetailHeader'
import SettingsRow from './SettingsRow'
import SettingsSection from './SettingsSection'

export default function PreferencesSettings(): React.JSX.Element {
  const themePreference = useThemePreference()
  const zoomPreference = useZoomPreference()
  const { currency, setCurrency } = useFiat()

  return (
    <div className="w-full pb-12">
      <SettingsDetailHeader primary="Preferences" secondary="Settings" />
      <div className="mt-8 px-12">
        <div className="max-w-[42rem]">
          <SettingsSection title="Appearance">
            <SettingsRow
              title="Theme"
              description="Choose light, dark, or follow your system setting."
              control={(
                <SegmentedControl
                  options={THEME_OPTIONS}
                  value={themePreference}
                  onChange={setThemePreference}
                />
              )}
            />
            <SettingsRow
              title="Interface scale"
              description="Scale the whole interface, including fonts."
              control={(
                <SegmentedControl
                  options={ZOOM_OPTIONS}
                  value={zoomPreference}
                  onChange={setZoomPreference}
                />
              )}
            />
          </SettingsSection>

          <SettingsSection title="Regional">
            <SettingsRow
              title="Display currency"
              description="Currency used for fiat values across the wallet."
              control={(
                <SegmentedControl
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={setCurrency}
                />
              )}
            />
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
