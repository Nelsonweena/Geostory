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
import MarkedLocationMemoryMarkers from '@/frontend/components/memories/MarkedLocationMemoryMarkers'
import MemoryFeed from '@/frontend/components/memories/MemoryFeed'
import MemoryPanel from '@/frontend/components/memories/MemoryPanel'
import VisualModePanel, {
  VisualModeTimelineItem,
} from '@/frontend/components/visual/VisualModePanel'
import { getFirebaseAuth, getFirebaseConfigError } from '@/frontend/services/firebase'
import useDetectScreen from '@/hooks/useDetectScreen'
import { Memory } from '@/shared/types/memory'
import AnimatedRouteLinesLayer from '@/src/map/Layers/AnimatedRouteLinesLayer'
import MarkedLocationsLayer, {
  MARKED_LOCATION_DOT_LAYER_ID,
  MARKED_LOCATION_HALO_LAYER_ID,
} from '@/src/map/Layers/MarkedLocationsLayer'
import MapContextProvider from '@/src/map/MapContextProvider'
import MapControls from '@/src/map/MapControls'
import useMapContext from '@/src/map/useMapContext'
import useMapStore from '@/store/useMapStore'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'
import useMemoriesStore from '@/store/useMemoriesStore'

type MarkLocationMode = 'closed' | 'choose' | 'click' | 'search'

type LocationSearchResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    country?: string
    state?: string
    province?: string
    region?: string
    county?: string
    city?: string
    town?: string
    village?: string
  }
}

const getMemoryDate = (memory: Memory) => {
  const rawDate = memory.date || memory.createdAt
  const rawTime = memory.time || '00:00'
  const date = new Date(`${rawDate}T${rawTime}`)

  if (!Number.isNaN(date.getTime())) return date

  const fallbackDate = new Date(rawDate)
  return Number.isNaN(fallbackDate.getTime()) ? new Date(0) : fallbackDate
}

const getTimelineKey = (memory: Memory) => {
  const date = getMemoryDate(memory)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

const getTimelineLabel = (timelineKey: string) => {
  const [year, month] = timelineKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

const onMapError = (evt: ErrorEvent) => {
  const { error } = evt
  throw new Error(`Map error: ${error.message}`)
}

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

  const [isMemoryFeedOpen, setIsMemoryFeedOpen] = useState(false)
  const [isMemoryFeedVisible, setIsMemoryFeedVisible] = useState(false)

  const [isVisualMode, setIsVisualMode] = useState(false)
  const [selectedTimelineKey, setSelectedTimelineKey] = useState('')
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false)
  const [isRouteRepeating, setIsRouteRepeating] = useState(false)

  const [aiTripStory, setAiTripStory] = useState('')
  const [aiTripStoryError, setAiTripStoryError] = useState<string | undefined>()
  const [isGeneratingTripStory, setIsGeneratingTripStory] = useState(false)

  const setViewState = useMapStore(state => state.setViewState)
  const setThrottledViewState = useMapStore(state => state.setThrottledViewState)
  const isMapGlLoaded = useMapStore(state => state.isMapGlLoaded)
  const setIsMapGlLoaded = useMapStore(state => state.setIsMapGlLoaded)

  const markLocation = useMarkedLocationsStore(state => state.markLocation)
  const setActiveUserId = useMarkedLocationsStore(state => state.setActiveUserId)
  const activeUserId = useMarkedLocationsStore(state => state.activeUserId)
  const allMarkedLocations = useMarkedLocationsStore(state => state.markedLocations)
  const markedLocationsError = useMarkedLocationsStore(state => state.markedLocationsError)

  const setMemoriesActiveUserId = useMemoriesStore(state => state.setActiveUserId)
  const selectedMarkedLocationId = useMemoriesStore(state => state.selectedMarkedLocationId)
  const selectMarkedLocation = useMemoriesStore(state => state.selectMarkedLocation)
  const memories = useMemoriesStore(state => state.memories)

  const activeMarkedLocations = useMemo(
    () =>
      activeUserId ? allMarkedLocations.filter(location => location.userId === activeUserId) : [],
    [activeUserId, allMarkedLocations],
  )

  const selectedMarkedLocation = useMemo(
    () => activeMarkedLocations.find(location => location.id === selectedMarkedLocationId),
    [activeMarkedLocations, selectedMarkedLocationId],
  )

  const timelineItems = useMemo<VisualModeTimelineItem[]>(() => {
    const activeMarkedLocationIds = new Set(activeMarkedLocations.map(location => location.id))

    const countsByKey = memories.reduce<Record<string, number>>((acc, memory) => {
      if (!activeMarkedLocationIds.has(memory.markedLocationId)) return acc

      const key = getTimelineKey(memory)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return Object.entries(countsByKey)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, count]) => ({
        key,
        label: getTimelineLabel(key),
        count,
      }))
  }, [activeMarkedLocations, memories])

  const visibleTimelineMemories = useMemo(() => {
    if (!isVisualMode || !selectedTimelineKey) return memories

    return memories.filter(memory => getTimelineKey(memory) <= selectedTimelineKey)
  }, [isVisualMode, memories, selectedTimelineKey])

  const visibleMarkedLocationIds = useMemo(() => {
    if (!isVisualMode) return undefined

    return new Set(visibleTimelineMemories.map(memory => memory.markedLocationId))
  }, [isVisualMode, visibleTimelineMemories])

  const { setMap, map } = useMapContext()
  const { viewportWidth, viewportHeight, viewportRef } = useDetectScreen()

  useEffect(() => {
    if (getFirebaseConfigError()) {
      setCurrentUser(null)
      setActiveUserId(undefined)
      setMemoriesActiveUserId(undefined)
      return undefined
    }

    const auth = getFirebaseAuth()

    return onAuthStateChanged(auth, user => {
      setCurrentUser(user)
      setActiveUserId(user?.uid)
      setMemoriesActiveUserId(user?.uid)
    })
  }, [setActiveUserId, setMemoriesActiveUserId])

  useEffect(() => {
    if (!timelineItems.length) {
      setSelectedTimelineKey('')
      setIsTimelinePlaying(false)
      return
    }

    setSelectedTimelineKey(current => current || timelineItems[0].key)
  }, [timelineItems])

  useEffect(() => {
    if (!isTimelinePlaying || !isVisualMode || !timelineItems.length) return undefined

    const interval = window.setInterval(() => {
      setSelectedTimelineKey(currentKey => {
        const currentIndex = timelineItems.findIndex(item => item.key === currentKey)
        const nextIndex = currentIndex + 1

        if (nextIndex >= timelineItems.length) {
          setIsTimelinePlaying(false)
          return currentKey
        }

        return timelineItems[nextIndex].key
      })
    }, 1400)

    return () => window.clearInterval(interval)
  }, [isTimelinePlaying, isVisualMode, timelineItems])

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

  const openMemoryFeed = useCallback(() => {
    selectMarkedLocation(undefined)
    setIsMemoryFeedVisible(true)

    requestAnimationFrame(() => {
      setIsMemoryFeedOpen(true)
    })
  }, [selectMarkedLocation])

  const closeMemoryFeed = useCallback(() => {
    setIsMemoryFeedOpen(false)

    window.setTimeout(() => {
      setIsMemoryFeedVisible(false)
    }, 300)
  }, [])

  const toggleMemoryFeed = useCallback(() => {
    if (isMemoryFeedVisible) {
      closeMemoryFeed()
      return
    }

    openMemoryFeed()
  }, [closeMemoryFeed, isMemoryFeedVisible, openMemoryFeed])

  const handleSelectMarkedLocation = useCallback(
    (markedLocationId: string) => {
      closeMemoryFeed()

      window.setTimeout(
        () => {
          selectMarkedLocation(markedLocationId)
        },
        isMemoryFeedVisible ? 300 : 0,
      )
    },
    [closeMemoryFeed, isMemoryFeedVisible, selectMarkedLocation],
  )

  const handleViewMemoryOnGlobe = useCallback(
    (markedLocationId: string) => {
      const location = activeMarkedLocations.find(item => item.id === markedLocationId)

      if (!location) return

      selectMarkedLocation(undefined)
      flyToMarkedLocation(location.latitude, location.longitude)
      closeMemoryFeed()
    },
    [activeMarkedLocations, closeMemoryFeed, flyToMarkedLocation, selectMarkedLocation],
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

  const handleToggleVisualMode = useCallback(() => {
    setIsVisualMode(current => {
      const nextValue = !current

      if (nextValue) {
        closeMemoryFeed()
        selectMarkedLocation(undefined)

        // Close Mark a location when Visual Mode opens
        setMarkLocationMode('closed')
        setLocationSearchError(undefined)
        setCurrentLocationError(undefined)
        resetLocationSearch()

        setSelectedTimelineKey(timelineItems[0]?.key || '')
      } else {
        setIsTimelinePlaying(false)
        setIsRouteRepeating(false)
        setAiTripStory('')
        setAiTripStoryError(undefined)
      }

      return nextValue
    })
  }, [closeMemoryFeed, resetLocationSearch, selectMarkedLocation, timelineItems])

  const handleRestartTimeline = useCallback(() => {
    setSelectedTimelineKey(timelineItems[0]?.key || '')
    setIsTimelinePlaying(Boolean(timelineItems.length))
  }, [timelineItems])

  const handleGenerateTripStory = useCallback(async () => {
    const activeMarkedLocationIds = new Set(activeMarkedLocations.map(location => location.id))

    const tripMemories = memories
      .filter(memory => activeMarkedLocationIds.has(memory.markedLocationId))
      .sort((firstMemory, secondMemory) => {
        return getMemoryDate(firstMemory).getTime() - getMemoryDate(secondMemory).getTime()
      })

    if (!tripMemories.length) {
      setAiTripStoryError('Add memories before generating a trip story.')
      return
    }

    setIsGeneratingTripStory(true)
    setAiTripStoryError(undefined)

    try {
      const response = await fetch('/api/ai/trip-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memories: tripMemories,
          locations: activeMarkedLocations,
        }),
      })

      const responseText = await response.text()

      let data: {
        story?: string
        error?: string
      } = {}

      try {
        data = JSON.parse(responseText)
      } catch {
        throw new Error(responseText || 'The trip story API did not return valid JSON.')
      }

      if (!response.ok || !data.story) {
        throw new Error(data.error || 'Unable to generate a trip story.')
      }

      setAiTripStory(data.story)
    } catch (error) {
      setAiTripStoryError(
        error instanceof Error ? error.message : 'Unable to generate a trip story.',
      )
    } finally {
      setIsGeneratingTripStory(false)
    }
  }, [activeMarkedLocations, memories])

  const onMapClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      if (evt.originalEvent.defaultPrevented) return

      const markedLocationFeature = evt.features?.find(feature => {
        const layerId = feature.layer?.id
        return layerId === MARKED_LOCATION_DOT_LAYER_ID || layerId === MARKED_LOCATION_HALO_LAYER_ID
      })

      const markedLocationId = markedLocationFeature?.properties?.id as string | undefined

      if (markedLocationId) {
        closeMemoryFeed()
        selectMarkedLocation(markedLocationId)
        return
      }

      if (markLocationMode !== 'click') return
      if (!requireLoggedInUser()) return

      markLocation({
        latitude: evt.lngLat.lat,
        longitude: evt.lngLat.lng,
      }).catch(() => undefined)

      closeMarkLocationPanel()
    },
    [
      closeMarkLocationPanel,
      closeMemoryFeed,
      markLocation,
      markLocationMode,
      requireLoggedInUser,
      selectMarkedLocation,
    ],
  )

  const handleOpenMarkLocationPanel = useCallback(() => {
    closeMemoryFeed()
    selectMarkedLocation(undefined)

    // Close Visual Mode when Mark a location opens
    setIsVisualMode(false)
    setIsTimelinePlaying(false)
    setIsRouteRepeating(false)
    setAiTripStory('')
    setAiTripStoryError(undefined)

    setMarkLocationMode(currentMode => (currentMode === 'closed' ? 'choose' : 'closed'))
    setLocationSearchError(undefined)
    setCurrentLocationError(undefined)
  }, [closeMemoryFeed, selectMarkedLocation])

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

        markLocation({
          latitude,
          longitude,
          headline: 'Current location',
        }).catch(() => undefined)

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
    const searchQuery = locationSearchInput.trim()

    if (!requireLoggedInUser()) return

    if (!searchQuery) {
      setLocationSearchError('Enter a location to search for.')
      return
    }

    setIsSearchingLocation(true)
    setLocationSearchError(undefined)
    setLocationSearchResults([])

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          searchQuery,
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
      setLocationSearchError(
        'Location search is currently unavailable. Try again in a moment, or click directly on the map to choose a location.',
      )
    } finally {
      setIsSearchingLocation(false)
    }
  }, [locationSearchInput, requireLoggedInUser])

  const handleMarkSearchResult = useCallback(
    (result: LocationSearchResult) => {
      if (!requireLoggedInUser()) return

      const latitude = Number(result.lat)
      const longitude = Number(result.lon)

      const region =
        result.address?.state ||
        result.address?.province ||
        result.address?.region ||
        result.address?.county ||
        result.address?.city ||
        result.address?.town ||
        result.address?.village

      markLocation({
        latitude,
        longitude,
        headline: result.display_name,
        country: result.address?.country,
        region,
      }).catch(() => undefined)

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

  const markLocationPanelClassName = `absolute bottom-4 left-4 z-20 max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md bg-white/95 px-6 py-5 text-base text-dark shadow-md ${
    markLocationMode === 'search' || isVisualMode ? 'w-[42rem]' : 'w-[34rem]'
  }`

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
          interactiveLayerIds={[MARKED_LOCATION_DOT_LAYER_ID, MARKED_LOCATION_HALO_LAYER_ID]}
          style={{ width: viewportWidth, height: viewportHeight }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          projection={{ type: 'globe' } as any}
          renderWorldCopies={false}
          dragRotate
        >
          <AnimatedRouteLinesLayer
            memories={visibleTimelineMemories}
            markedLocations={activeMarkedLocations}
            isEnabled={isVisualMode}
            shouldRepeat={isRouteRepeating}
          />

          <MarkedLocationsLayer
            visibleMarkedLocationIds={visibleMarkedLocationIds}
            isVisualMode={isVisualMode}
          />

          <MarkedLocationMemoryMarkers
            markedLocations={activeMarkedLocations}
            visibleMarkedLocationIds={visibleMarkedLocationIds}
            isVisualMode={isVisualMode}
            onSelectMarkedLocation={handleSelectMarkedLocation}
          />

          <MemoryPanel
            markedLocation={selectedMarkedLocation}
            onClose={() => selectMarkedLocation(undefined)}
          />

          {isMemoryFeedVisible && (
            <MemoryFeed
              isOpen={isMemoryFeedOpen}
              markedLocations={activeMarkedLocations}
              onClose={closeMemoryFeed}
              onViewOnGlobe={handleViewMemoryOnGlobe}
            />
          )}

          <MapControls />

          <TopBar isMemoryFeedOpen={isMemoryFeedVisible} onOpenMemoryFeed={toggleMemoryFeed} />

          <div className={markLocationPanelClassName}>
            <VisualModePanel
              isVisualMode={isVisualMode}
              onToggleVisualMode={handleToggleVisualMode}
              timelineItems={timelineItems}
              selectedTimelineKey={selectedTimelineKey}
              onSelectTimelineKey={setSelectedTimelineKey}
              isPlaying={isTimelinePlaying}
              isRepeating={isRouteRepeating}
              onTogglePlay={() => setIsTimelinePlaying(current => !current)}
              onRestart={handleRestartTimeline}
              onToggleRepeat={() => setIsRouteRepeating(current => !current)}
              onGenerateTripStory={handleGenerateTripStory}
              aiTripStory={aiTripStory}
              aiTripStoryError={aiTripStoryError}
              isGeneratingTripStory={isGeneratingTripStory}
              visibleCount={isVisualMode ? visibleTimelineMemories.length : memories.length}
              totalCount={memories.length}
            />

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
                <label className="flex flex-col gap-1" htmlFor="location-search-input">
                  Search location
                  <input
                    id="location-search-input"
                    className="rounded border border-darkLight px-3 py-2 text-base"
                    placeholder="Example: Tokyo, Japan"
                    type="text"
                    value={locationSearchInput}
                    onChange={event => setLocationSearchInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleSearchLocation().catch(() => undefined)
                      }
                    }}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded bg-dark px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={isSearchingLocation}
                    onClick={() => {
                      handleSearchLocation().catch(() => undefined)
                    }}
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
                  <div className="mt-2 max-h-[50vh] min-h-[50vh] overflow-y-auto rounded border border-darkLight bg-white">
                    {locationSearchResults.map(result => (
                      <button
                        key={result.place_id}
                        className="block w-full border-b border-darkLight px-3 py-3 text-left text-base leading-snug text-dark last:border-b-0 hover:bg-mapBg"
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

const MapContainer = () => (
  <MapContextProvider>
    <MapInner />
  </MapContextProvider>
)

export default MapContainer
