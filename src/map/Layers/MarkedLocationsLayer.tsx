import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'

import { theme } from '@/root/tailwind.config'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'

export const MARKED_LOCATIONS_SOURCE_ID = 'marked-locations-source'
export const MARKED_LOCATION_HALO_LAYER_ID = 'marked-location-halo'
export const MARKED_LOCATION_DOT_LAYER_ID = 'marked-location-dot'

const MarkedLocationsLayer = () => {
  const activeUserId = useMarkedLocationsStore(state => state.activeUserId)
  const allMarkedLocations = useMarkedLocationsStore(state => state.markedLocations)

  const markedLocations = useMemo(
    () =>
      activeUserId ? allMarkedLocations.filter(location => location.userId === activeUserId) : [],
    [activeUserId, allMarkedLocations],
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
          'circle-color': theme.colors.white,
          'circle-radius': 12,
          'circle-opacity': 0.75,
        }}
      />

      <Layer
        id={MARKED_LOCATION_DOT_LAYER_ID}
        type="circle"
        source={MARKED_LOCATIONS_SOURCE_ID}
        paint={{
          'circle-color': theme.colors.dark,
          'circle-radius': 7,
          'circle-stroke-color': theme.colors.warning,
          'circle-stroke-width': 3,
        }}
      />
    </Source>
  )
}

export default MarkedLocationsLayer
