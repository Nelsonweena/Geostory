import CategoryColorBg from '@/frontend/components/layout/CategoryColorBg'
import Nav from '@/frontend/components/layout/Nav'
import SettingsBox from '@/frontend/components/layout/SettingsBox'
import CategoryDisplay from '@/frontend/components/layout/TopBar/CategoryDisplay'
import { AppConfig, NavVariant } from '@/shared/constants/AppConfig'
import useMapStore from '@/store/useMapStore'

const TopBar = () => {
  const isMapGlLoaded = useMapStore(state => state.isMapGlLoaded)

  return isMapGlLoaded ? (
    <div
      className="absolute left-0 top-0 z-20 w-full shadow-md"
      style={{ height: AppConfig.ui.barHeight }}
    >
      <CategoryColorBg className="absolute inset-0" />

      <div className="relative flex h-full items-center justify-between px-4">
        <CategoryDisplay />

        <div className="flex h-full items-center gap-4">
          <Nav variant={NavVariant.TOPNAV} />
          <SettingsBox />
        </div>
      </div>
    </div>
  ) : null
}

export default TopBar
