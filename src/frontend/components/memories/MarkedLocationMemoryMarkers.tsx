import { useEffect, useState } from 'react'
import { Marker } from 'react-map-gl/maplibre'

import { MarkedLocation } from '@/shared/types/markedLocation'
import useMemoriesStore, { getLocalMemoryPhotoUrl } from '@/store/useMemoriesStore'

type MarkedLocationMemoryMarkersProps = {
  markedLocations: MarkedLocation[]
  visibleMarkedLocationIds?: Set<MarkedLocation['id']>
  isVisualMode?: boolean
  onSelectMarkedLocation: (markedLocationId: MarkedLocation['id']) => void
}

type MarkerMemoryImageProps = {
  photoUrl: string
}

const MarkerMemoryImage = ({ photoUrl }: MarkerMemoryImageProps) => {
  const [resolvedUrl, setResolvedUrl] = useState('')

  useEffect(() => {
    let objectUrlToRevoke = ''
    let isMounted = true

    getLocalMemoryPhotoUrl(photoUrl)
      .then(url => {
        if (!isMounted) return

        objectUrlToRevoke = url.startsWith('blob:') ? url : ''
        setResolvedUrl(url)
      })
      .catch(() => {
        if (isMounted) setResolvedUrl('')
      })

    return () => {
      isMounted = false

      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke)
      }
    }
  }, [photoUrl])

  if (!resolvedUrl) {
    return <div className="h-10 w-10 rounded-xl border border-white bg-light first:ml-0 -ml-2" />
  }

  return (
    <img
      className="h-10 w-10 rounded-xl border border-white object-cover first:ml-0 -ml-2"
      src={resolvedUrl}
      alt="Marked location memory"
    />
  )
}

const MarkedLocationMemoryMarkers = ({
  markedLocations,
  visibleMarkedLocationIds,
  isVisualMode = false,
  onSelectMarkedLocation,
}: MarkedLocationMemoryMarkersProps) => {
  const memoriesByMarkedLocationId = useMemoriesStore(state => state.memoriesByMarkedLocationId)

  return (
    <>
      {markedLocations.map(location => {
        if (visibleMarkedLocationIds && !visibleMarkedLocationIds.has(location.id)) return null

        const memories = memoriesByMarkedLocationId[location.id] || []
        const photos = memories.flatMap(memory => memory.photos).slice(0, 3)

        if (!photos.length) return null

        return (
          <Marker
            key={location.id}
            longitude={location.longitude}
            latitude={location.latitude}
            anchor="bottom"
            offset={[0, -16]}
          >
            <button
              className={`group flex -translate-y-2 items-center rounded-2xl bg-white p-1 shadow-xl ring-2 transition hover:scale-105 ${
                isVisualMode
                  ? 'animate-[pulse_1.7s_ease-in-out_infinite] ring-white shadow-warning/40'
                  : 'ring-warning'
              }`}
              type="button"
              onClick={event => {
                event.stopPropagation()
                onSelectMarkedLocation(location.id)
              }}
              aria-label={`Open memories for ${location.headline}`}
            >
              {photos.map(photo => (
                <MarkerMemoryImage key={photo.id} photoUrl={photo.url} />
              ))}
            </button>
          </Marker>
        )
      })}
    </>
  )
}

export default MarkedLocationMemoryMarkers
