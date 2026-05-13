import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'

import { theme } from '@/root/tailwind.config'
import { MarkedLocation } from '@/shared/types/markedLocation'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'

export const MARKED_LOCATIONS_SOURCE_ID = 'marked-locations-source'
export const MARKED_LOCATION_HALO_LAYER_ID = 'marked-location-halo'
export const MARKED_LOCATION_DOT_LAYER_ID = 'marked-location-dot'

type MarkedLocationsLayerProps = {
  visibleMarkedLocationIds?: Set<MarkedLocation['id']>
  isVisualMode?: boolean
}

const MarkedLocationsLayer = ({
  visibleMarkedLocationIds,
  isVisualMode = false,
}: MarkedLocationsLayerProps) => {
  const activeUserId = useMarkedLocationsStore(state => state.activeUserId)
  const allMarkedLocations = useMarkedLocationsStore(state => state.markedLocations)

  const markedLocations = useMemo(
    () =>
      activeUserId
        ? allMarkedLocations.filter(location => {
            const belongsToActiveUser = location.userId === activeUserId
            const isVisibleInTimeline =
              !visibleMarkedLocationIds || visibleMarkedLocationIds.has(location.id)

            return belongsToActiveUser && isVisibleInTimeline
          })
        : [],
    [activeUserId, allMarkedLocations, visibleMarkedLocationIds],
  )

  const markedLocationsData = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: 'FeatureCollection',
      features: markedLocations.map(location => ({
        type: 'Feature',
        properties: {
          id: location.id,
          headline: location.headline,
        },
        geometry: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
      })),
    }),
    [markedLocations],
  )

  return (
    <Source id={MARKED_LOCATIONS_SOURCE_ID} type="geojson" data={markedLocationsData}>
      <Layer
        id={MARKED_LOCATION_HALO_LAYER_ID}
        type="circle"
        source={MARKED_LOCATIONS_SOURCE_ID}
        paint={{
          'circle-color': isVisualMode ? '#fbbf24' : theme.colors.white,
          'circle-radius': isVisualMode ? 17 : 12,
          'circle-opacity': isVisualMode ? 0.55 : 0.75,
          'circle-blur': isVisualMode ? 0.35 : 0,
        }}
      />

      <Layer
        id={MARKED_LOCATION_DOT_LAYER_ID}
        type="circle"
        source={MARKED_LOCATIONS_SOURCE_ID}
        paint={{
          'circle-color': theme.colors.dark,
          'circle-radius': isVisualMode ? 8 : 7,
          'circle-stroke-color': isVisualMode ? '#fff7ed' : theme.colors.warning,
          'circle-stroke-width': isVisualMode ? 4 : 3,
        }}
      />
    </Source>
  )
}

export default MarkedLocationsLayer
