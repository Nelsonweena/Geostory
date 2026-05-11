import { User, onAuthStateChanged } from 'firebase/auth'
import { throttle } from 'lodash'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ErrorEvent,
  MapLayerMouseEvent,
  ViewState,
  ViewStateChangeEvent,
} from 'react-map-gl/maplibre'
import Map from 'react-map-gl/maplibre'

import SpaceBackground from '@/frontend/components/globe/SpaceBackground'
import { getFirebaseAuth, getFirebaseConfigError } from '@/frontend/services/firebase'
import useDetectScreen from '@/hooks/useDetectScreen'
import MarkedLocationsLayer from '@/src/map/Layers/MarkedLocationsLayer'
import MapContextProvider from '@/src/map/MapContextProvider'
import MapControls from '@/src/map/MapControls'
import useMapContext from '@/src/map/useMapContext'
import useMapStore from '@/store/useMapStore'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'

type MarkLocationMode = 'closed' | 'choose' | 'click' | 'search'

type LocationSearchResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

/** error handle */
const onMapError = (evt: ErrorEvent) => {
  const { error } = evt
  throw new Error(`Map error: ${error.message}`)
}

// bundle splitting
const TopBar = dynamic(() => import('@/frontend/components/layout/TopBar'))

const MapInner = () => {
  const [markLocationMode, setMarkLocationMode] = useState<MarkLocationMode>('closed')
  const [locationSearchInput, setLocationSearchInput] = useState('')
  const [locationSearchResults, setLocationSearchResults] = useState<LocationSearchResult[]>([])
  const [locationSearchError, setLocationSearchError] = useState<string | undefined>()
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [currentLocationError, setCurrentLocationError] = useState<string | undefined>()
  const [isFindingCurrentLocation, setIsFindingCurrentLocation] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const setViewState = useMapStore(state => state.setViewState)
  const setThrottledViewState = useMapStore(state => state.setThrottledViewState)
  const isMapGlLoaded = useMapStore(state => state.isMapGlLoaded)
  const setIsMapGlLoaded = useMapStore(state => state.setIsMapGlLoaded)

  const markLocation = useMarkedLocationsStore(state => state.markLocation)
  const clearMarkedLocations = useMarkedLocationsStore(state => state.clearMarkedLocations)
  const setActiveUserId = useMarkedLocationsStore(state => state.setActiveUserId)
  const activeUserId = useMarkedLocationsStore(state => state.activeUserId)
  const allMarkedLocations = useMarkedLocationsStore(state => state.markedLocations)
  const markedLocationsError = useMarkedLocationsStore(state => state.markedLocationsError)
  const isLoadingMarkedLocations = useMarkedLocationsStore(state => state.isLoadingMarkedLocations)

  const markedLocationsCount = useMemo(
    () =>
      activeUserId
        ? allMarkedLocations.filter(location => location.userId === activeUserId).length
        : 0,
    [activeUserId, allMarkedLocations],
  )

  const { setMap, map } = useMapContext()
  const { viewportWidth, viewportHeight, viewportRef } = useDetectScreen()

  useEffect(() => {
    if (getFirebaseConfigError()) {
      setCurrentUser(null)
      setActiveUserId(undefined)
      return undefined
    }

    const auth = getFirebaseAuth()

    return onAuthStateChanged(auth, user => {
      setCurrentUser(user)
      setActiveUserId(user?.uid)
    })
  }, [setActiveUserId])

  const throttledSetViewState = useMemo(
    () => throttle((state: ViewState) => setThrottledViewState(state), 50),
    [setThrottledViewState],
  )

  const forceGlobe = useCallback((e: any) => {
    const mapInstance = e.target

    requestAnimationFrame(() => {
      mapInstance.setProjection?.({ type: 'globe' })

      mapInstance.setFog?.({
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

  const flyToMarkedLocation = useCallback(
    (latitude: number, longitude: number) => {
      map?.flyTo({
        center: [longitude, latitude],
        zoom: Math.max(map.getZoom(), 8),
        duration: 800,
      })
    },
    [map],
  )

  const closeMarkLocationPanel = useCallback(() => {
    setMarkLocationMode('closed')
    setLocationSearchError(undefined)
    setCurrentLocationError(undefined)
  }, [])

  const resetLocationSearch = useCallback(() => {
    setLocationSearchResults([])
    setLocationSearchError(undefined)
    setIsSearchingLocation(false)
  }, [])

  const requireLoggedInUser = useCallback(() => {
    if (activeUserId) return true

    setCurrentLocationError('Log in to mark locations.')
    setLocationSearchError('Log in to mark locations.')
    return false
  }, [activeUserId])

  const onMapClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      if (evt.originalEvent.defaultPrevented) return
      if (markLocationMode !== 'click') return
      if (!requireLoggedInUser()) return

      void markLocation({
        latitude: evt.lngLat.lat,
        longitude: evt.lngLat.lng,
      })

      closeMarkLocationPanel()
    },
    [closeMarkLocationPanel, markLocation, markLocationMode, requireLoggedInUser],
  )

  const handleOpenMarkLocationPanel = useCallback(() => {
    setMarkLocationMode(currentMode => (currentMode === 'closed' ? 'choose' : 'closed'))
    setLocationSearchError(undefined)
    setCurrentLocationError(undefined)
  }, [])

  const handleUseCurrentLocation = useCallback(() => {
    setCurrentLocationError(undefined)

    if (!requireLoggedInUser()) return

    if (!navigator.geolocation) {
      setCurrentLocationError('Current location is not supported by this browser.')
      return
    }

    setIsFindingCurrentLocation(true)

    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords

        void markLocation({
          latitude,
          longitude,
          headline: 'Current location',
        })

        flyToMarkedLocation(latitude, longitude)
        setIsFindingCurrentLocation(false)
        closeMarkLocationPanel()
      },
      error => {
        setCurrentLocationError(error.message || 'Unable to get your current location.')
        setIsFindingCurrentLocation(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }, [closeMarkLocationPanel, flyToMarkedLocation, markLocation, requireLoggedInUser])

  const handleSearchLocation = useCallback(async () => {
    const query = locationSearchInput.trim()

    if (!requireLoggedInUser()) return

    if (!query) {
      setLocationSearchError('Enter a location to search for.')
      return
    }

    setIsSearchingLocation(true)
    setLocationSearchError(undefined)
    setLocationSearchResults([])

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query,
        )}&limit=5`,
      )

      if (!response.ok) {
        throw new Error('Location search failed.')
      }

      const results = (await response.json()) as LocationSearchResult[]

      if (!results.length) {
        setLocationSearchError('No locations found.')
        return
      }

      setLocationSearchResults(results)
    } catch {
      setLocationSearchError('Unable to search for that location right now.')
    } finally {
      setIsSearchingLocation(false)
    }
  }, [locationSearchInput, requireLoggedInUser])

  const handleMarkSearchResult = useCallback(
    (result: LocationSearchResult) => {
      if (!requireLoggedInUser()) return

      const latitude = Number(result.lat)
      const longitude = Number(result.lon)

      void markLocation({
        latitude,
        longitude,
        headline: result.display_name,
      })

      flyToMarkedLocation(latitude, longitude)
      setLocationSearchInput('')
      resetLocationSearch()
      closeMarkLocationPanel()
    },
    [
      closeMarkLocationPanel,
      flyToMarkedLocation,
      markLocation,
      requireLoggedInUser,
      resetLocationSearch,
    ],
  )

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
            className="absolute bottom-4 left-4 z-20 w-80 rounded-md bg-white/90 px-3 py-3 text-sm text-dark shadow-md"
            onClick={event => event.stopPropagation()}
          >
            <button
              className="w-full rounded bg-dark px-3 py-2 font-semibold text-white"
              type="button"
              onClick={handleOpenMarkLocationPanel}
            >
              Mark a location
            </button>

            {!currentUser && markLocationMode !== 'closed' && (
              <p className="m-0 mt-3 rounded bg-warning/20 p-2">
                Log in to save marked locations to your account.
              </p>
            )}

            {markedLocationsError && (
              <p className="m-0 mt-3 rounded bg-warning/20 p-2">{markedLocationsError}</p>
            )}

            {markLocationMode === 'choose' && (
              <div className="mt-3 flex flex-col gap-2">
                <button
                  className="rounded bg-darkLight px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!activeUserId}
                  onClick={() => setMarkLocationMode('click')}
                >
                  Click anywhere on the map
                </button>

                <button
                  className="rounded bg-darkLight px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!activeUserId || isFindingCurrentLocation}
                  onClick={handleUseCurrentLocation}
                >
                  {isFindingCurrentLocation
                    ? 'Finding current location...'
                    : 'Use current location'}
                </button>

                <button
                  className="rounded bg-darkLight px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!activeUserId}
                  onClick={() => {
                    setMarkLocationMode('search')
                    setCurrentLocationError(undefined)
                    resetLocationSearch()
                  }}
                >
                  Search for a location
                </button>

                {currentLocationError && <p className="m-0 text-warning">{currentLocationError}</p>}
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

            {markLocationMode === 'search' && (
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1">
                  Search location
                  <input
                    className="rounded border border-darkLight px-2 py-1"
                    placeholder="Example: Tokyo, Japan"
                    type="text"
                    value={locationSearchInput}
                    onChange={event => setLocationSearchInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleSearchLocation()
                      }
                    }}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded bg-dark px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={isSearchingLocation}
                    onClick={() => void handleSearchLocation()}
                  >
                    {isSearchingLocation ? 'Searching...' : 'Search'}
                  </button>

                  <button
                    className="rounded bg-darkLight px-3 py-2 text-white"
                    type="button"
                    onClick={closeMarkLocationPanel}
                  >
                    Cancel
                  </button>
                </div>

                {locationSearchError && <p className="m-0 text-warning">{locationSearchError}</p>}

                {!!locationSearchResults.length && (
                  <div className="mt-1 max-h-52 overflow-y-auto rounded border border-darkLight bg-white">
                    {locationSearchResults.map(result => (
                      <button
                        key={result.place_id}
                        className="block w-full border-b border-darkLight px-2 py-2 text-left text-dark last:border-b-0 hover:bg-mapBg"
                        type="button"
                        onClick={() => handleMarkSearchResult(result)}
                      >
                        {result.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              className="mt-3 w-full rounded bg-dark px-2 py-1 text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!markedLocationsCount || isLoadingMarkedLocations}
              type="button"
              onClick={() => void clearMarkedLocations()}
            >
              {isLoadingMarkedLocations
                ? 'Loading marks...'
                : `Clear my marks (${markedLocationsCount})`}
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
