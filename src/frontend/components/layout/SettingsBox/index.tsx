import { Settings } from 'lucide-react'
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react'

import CategoryColorBg from '@/frontend/components/layout/CategoryColorBg'
import usePlaces from '@/hooks/usePlaces'
import useMapActions from '@/map/useMapActions'
import { AppConfig } from '@/shared/constants/AppConfig'
import useMapStore from '@/store/useMapStore'
import useSettingsStore from '@/store/useSettingsStore'

const SettingsBox = () => {
  const selectedCategory = useMapStore(state => state.selectedCategory)
  const clusterRadius = useMapStore(state => state.clusterRadius)
  const markersCount = useSettingsStore(state => state.markersCount)
  const markerSize = useSettingsStore(state => state.markerSize)
  const setMarkerSize = useSettingsStore(state => state.setMarkerSize)
  const setClusterRadius = useMapStore(state => state.setClusterRadius)
  const markerJSXRendering = useSettingsStore(state => state.markerJSXRendering)
  const setMarkerJSXRendering = useSettingsStore(state => state.setMarkerJSXRendering)
  const setMarkersCount = useSettingsStore(state => state.setMarkersCount)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const { rawPlaces, getCatPlaces, allPlacesBounds } = usePlaces()
  const { handleMapMove } = useMapActions()

  const currentMaxCounting = useMemo(
    () => (!selectedCategory ? rawPlaces.length : getCatPlaces(selectedCategory.id).length),
    [getCatPlaces, rawPlaces.length, selectedCategory],
  )

  const handleLegacyJSXRendering = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!allPlacesBounds) return

      if (!e.target.checked) {
        setMarkerJSXRendering(false)
        return
      }

      handleMapMove({
        latitude: allPlacesBounds.latitude,
        longitude: allPlacesBounds.longitude,
        zoom: allPlacesBounds.zoom,
        duration: 300,
        fly: false,
        moveEndOnceCallback: () => setMarkerJSXRendering(true),
      })
    },
    [allPlacesBounds, handleMapMove, setMarkerJSXRendering],
  )

  useEffect(() => {
    if (markersCount > currentMaxCounting) {
      setMarkersCount(currentMaxCounting)
    }
  }, [currentMaxCounting, markersCount, setMarkersCount])

  return (
    <div className="relative h-full">
      <button
        className="flex h-full items-center justify-center text-dark"
        type="button"
        aria-label="Open map settings"
        aria-expanded={isSettingsOpen}
        onClick={() => setIsSettingsOpen(isOpen => !isOpen)}
      >
        <Settings size={AppConfig.ui.barIconSize} />
      </button>

      {isSettingsOpen && (
        <div className="absolute right-0 top-full mt-3 w-80 rounded-md p-3 shadow-md">
          <CategoryColorBg className="z-10 rounded-md" />

          <div className={`relative z-20 ${selectedCategory ? 'text-white' : 'text-dark'}`}>
            <p className="text-lg">
              <span className="font-bold">Marker Data: </span>
              {markersCount} / {currentMaxCounting} items
            </p>

            <input
              type="range"
              min={5}
              onChange={e => setMarkersCount(parseFloat(e.target.value))}
              max={currentMaxCounting}
              value={markersCount}
              step={1}
              className="w-full"
            />

            <p className="text-lg">
              <span className="font-bold">Marker Size: </span>
              {`${markerSize}px`}
            </p>

            <input
              type="range"
              min={AppConfig.ui.mapIconSizeSmall}
              onChange={e => {
                const newMarkerSize = parseFloat(e.target.value)

                setMarkerSize(newMarkerSize)

                if (newMarkerSize > clusterRadius) {
                  setClusterRadius(newMarkerSize)
                }
              }}
              max={AppConfig.ui.mapIconSizeBig}
              value={markerSize}
              step={1}
              className="w-full"
            />

            <p className="text-lg">
              <span className="font-bold">Cluster Radius: </span>
              {`${clusterRadius}px`}
            </p>

            <input
              type="range"
              min={markerSize}
              onChange={e => setClusterRadius(parseFloat(e.target.value))}
              max={200}
              value={clusterRadius}
              step={1}
              className="w-full"
            />

            <p className="text-lg">
              <span className="font-bold">
                Marker Rendering: {markerJSXRendering ? 'JSX ⚠️' : 'Web GL'}
              </span>
            </p>

            <label className="flex items-start gap-3" htmlFor="markerJSXRendering">
              <input
                className="mt-1"
                id="markerJSXRendering"
                type="checkbox"
                checked={markerJSXRendering}
                onChange={e => handleLegacyJSXRendering(e)}
              />

              <span>
                <b>Enable.</b> - Experimental - If enabled, markers and clusters are rendered in
                React. Performance may vary depending on your device. If you experience performance
                issues, use a higher cluster radius and lower marker count.
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsBox
