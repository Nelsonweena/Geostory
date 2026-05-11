import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'

import { theme } from '@/root/tailwind.config'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'

const MARKED_LOCATIONS_SOURCE_ID = 'marked-locations-source'

const MarkedLocationsLayer = () => {
  const markedLocations = useMarkedLocationsStore(state => state.markedLocations)

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
        id="marked-location-halo"
        type="circle"
        source={MARKED_LOCATIONS_SOURCE_ID}
        paint={{
          'circle-color': theme.colors.white,
          'circle-radius': 12,
          'circle-opacity': 0.75,
        }}
      />
      <Layer
        id="marked-location-dot"
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
