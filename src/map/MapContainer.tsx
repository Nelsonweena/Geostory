import { throttle } from 'lodash'
import dynamic from 'next/dynamic'
import { useCallback, useMemo, useState } from 'react'
import type {
  ErrorEvent,
  MapLayerMouseEvent,
  ViewState,
  ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
import Map from 'react-map-gl/maplibre'

import SpaceBackground from '@/frontend/components/globe/SpaceBackground'
import useDetectScreen from '@/hooks/useDetectScreen'
import MarkedLocationsLayer from '@/src/map/Layers/MarkedLocationsLayer'
import MapContextProvider from '@/src/map/MapContextProvider'
import MapControls from '@/src/map/MapControls'
import useMapContext from '@/src/map/useMapContext'
import useMapStore from '@/store/useMapStore'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'

type MarkLocationMode = 'closed' | 'choose' | 'click' | 'coordinates'

/** error handle */
const onMapError = (evt: ErrorEvent) => {
  const { error } = evt
  throw new Error(`Map error: ${error.message}`)
}

const isValidLatitude = (value: number) => value >= -90 && value <= 90

const isValidLongitude = (value: number) => value >= -180 && value <= 180

// bundle splitting
const TopBar = dynamic(() => import('@/frontend/components/layout/TopBar'))

const MapInner = () => {
  const [markLocationMode, setMarkLocationMode] = useState<MarkLocationMode>('closed')
  const [latitudeInput, setLatitudeInput] = useState('')
  const [longitudeInput, setLongitudeInput] = useState('')
  const [coordinateError, setCoordinateError] = useState<string | undefined>()

  const setViewState = useMapStore(state => state.setViewState)
  const setThrottledViewState = useMapStore(state => state.setThrottledViewState)
  const isMapGlLoaded = useMapStore(state => state.isMapGlLoaded)
  const setIsMapGlLoaded = useMapStore(state => state.setIsMapGlLoaded)
  const markLocation = useMarkedLocationsStore(state => state.markLocation)
  const clearMarkedLocations = useMarkedLocationsStore(state => state.clearMarkedLocations)
  const markedLocationsCount = useMarkedLocationsStore(state => state.markedLocations.length)

  const { setMap } = useMapContext()
  const { viewportWidth, viewportHeight, viewportRef } = useDetectScreen()

  const throttledSetViewState = useMemo(
    () => throttle((state: ViewState) => setThrottledViewState(state), 50),
    [setThrottledViewState],
  )

  const forceGlobe = useCallback((e: any) => {
    const map = e.target

    requestAnimationFrame(() => {
      map.setProjection?.({ type: 'globe' })

      map.setFog?.({
        range: [-1, 2],
        color: 'rgba(0,0,0,0)',
        'high-color': '#020617',
        'space-color': 'rgba(0,0,0,0)',
        'horizon-blend': 0.08,
        'star-intensity': 0,
      })
    })
  }, [])

  const onLoad = useCallback(
    (e: any) => {
      forceGlobe(e)
      setIsMapGlLoaded(true)
    },
    [forceGlobe, setIsMapGlLoaded],
  )

  const onMapMove = useCallback(
    (evt: ViewStateChangeEvent) => {
      throttledSetViewState(evt.viewState)
      setViewState(evt.viewState)
    },
    [setViewState, throttledSetViewState],
  )

  const closeMarkLocationPanel = useCallback(() => {
    setMarkLocationMode('closed')
    setCoordinateError(undefined)
  }, [])

  const onMapClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      if (evt.originalEvent.defaultPrevented) return
      if (markLocationMode !== 'click') return

      markLocation({
        latitude: evt.lngLat.lat,
        longitude: evt.lngLat.lng,
      })

      closeMarkLocationPanel()
    },
    [closeMarkLocationPanel, markLocation, markLocationMode],
  )

  const handleOpenMarkLocationPanel = useCallback(() => {
    setMarkLocationMode(currentMode => (currentMode === 'closed' ? 'choose' : 'closed'))
    setCoordinateError(undefined)
  }, [])

  const handleSubmitCoordinates = useCallback(() => {
    const latitude = Number(latitudeInput)
    const longitude = Number(longitudeInput)

    if (!latitudeInput.trim() || !longitudeInput.trim()) {
      setCoordinateError('Enter both latitude and longitude.')
      return
    }

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setCoordinateError('Latitude and longitude must be valid numbers.')
      return
    }

    if (!isValidLatitude(latitude)) {
      setCoordinateError('Latitude must be between -90 and 90.')
      return
    }

    if (!isValidLongitude(longitude)) {
      setCoordinateError('Longitude must be between -180 and 180.')
      return
    }

    markLocation({
      latitude,
      longitude,
    })

    setLatitudeInput('')
    setLongitudeInput('')
    closeMarkLocationPanel()
  }, [closeMarkLocationPanel, latitudeInput, longitudeInput, markLocation])

  return (
    <div className="absolute inset-0 overflow-hidden bg-black space-bg" ref={viewportRef}>
      <SpaceBackground />

      <div className="relative z-10 h-full w-full">
        <Map
          initialViewState={{
            longitude: 0,
            latitude: 20,
            zoom: 1.1,
            pitch: 0,
            bearing: 0,
          }}
          ref={e => setMap && setMap(e || undefined)}
          onError={e => onMapError(e)}
          onLoad={onLoad}
          onStyleData={forceGlobe}
          onMove={onMapMove}
          onClick={onMapClick}
          style={{ width: viewportWidth, height: viewportHeight }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          projection={{ type: 'globe' } as any}
          renderWorldCopies={false}
          dragRotate={true}
        >
          <MarkedLocationsLayer />
          <MapControls />
          <TopBar />

          <div
            className="absolute bottom-4 left-4 z-20 w-72 rounded-md bg-white/90 px-3 py-3 text-sm text-dark shadow-md"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="w-full rounded bg-dark px-3 py-2 font-semibold text-white"
              type="button"
              onClick={handleOpenMarkLocationPanel}
            >
              Mark a location
            </button>

            {markLocationMode === 'choose' && (
              <div className="mt-3 flex flex-col gap-2">
                <button
                  className="rounded bg-darkLight px-3 py-2 text-white"
                  type="button"
                  onClick={() => setMarkLocationMode('click')}
                >
                  Click anywhere on the map
                </button>

                <button
                  className="rounded bg-darkLight px-3 py-2 text-white"
                  type="button"
                  onClick={() => {
                    setMarkLocationMode('coordinates')
                    setCoordinateError(undefined)
                  }}
                >
                  Use GPS coordinates
                </button>
              </div>
            )}

            {markLocationMode === 'click' && (
              <div className="mt-3 rounded bg-warning/20 p-2">
                <p className="m-0">Click anywhere on the map to mark that location.</p>

                <button
                  className="mt-2 rounded bg-dark px-2 py-1 text-white"
                  type="button"
                  onClick={closeMarkLocationPanel}
                >
                  Cancel
                </button>
              </div>
            )}

            {markLocationMode === 'coordinates' && (
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  Latitude
                  <input
                    className="rounded border border-darkLight px-2 py-1"
                    placeholder="Example: 52.520008"
                    type="number"
                    value={latitudeInput}
                    onChange={event => setLatitudeInput(event.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  Longitude
                  <input
                    className="rounded border border-darkLight px-2 py-1"
                    placeholder="Example: 13.404954"
                    type="number"
                    value={longitudeInput}
                    onChange={event => setLongitudeInput(event.target.value)}
                  />
                </label>

                {coordinateError && <p className="m-0 text-warning">{coordinateError}</p>}

                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded bg-dark px-3 py-2 text-white"
                    type="button"
                    onClick={handleSubmitCoordinates}
                  >
                    Mark location
                  </button>

                  <button
                    className="rounded bg-darkLight px-3 py-2 text-white"
                    type="button"
                    onClick={closeMarkLocationPanel}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              className="mt-3 w-full rounded bg-dark px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!markedLocationsCount}
              type="button"
              onClick={clearMarkedLocations}
            >
              Clear marks ({markedLocationsCount})
            </button>
          </div>
        </Map>
      </div>

      {!isMapGlLoaded && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black text-white">
          Loading Map...
        </div>
      )}
    </div>
  )
}

// context pass through
const MapContainer = () => (
  <MapContextProvider>
    <MapInner />
  </MapContextProvider>
)

export default MapContainer
