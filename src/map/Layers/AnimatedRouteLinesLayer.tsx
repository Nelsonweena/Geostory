import { useEffect, useMemo, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'

import { MarkedLocation } from '@/shared/types/markedLocation'
import { Memory } from '@/shared/types/memory'

export const ANIMATED_ROUTE_SOURCE_ID = 'animated-route-lines-source'
export const ANIMATED_ROUTE_GLOW_LAYER_ID = 'animated-route-lines-glow'
export const ANIMATED_ROUTE_LINE_LAYER_ID = 'animated-route-lines-line'
export const ANIMATED_ROUTE_HEAD_LAYER_ID = 'animated-route-lines-head'

type MemoryWithLocation = {
  memory: Memory
  location: MarkedLocation
  dateMs: number
}

type AnimatedRouteLinesLayerProps = {
  memories: Memory[]
  markedLocations: MarkedLocation[]
  isEnabled: boolean
  shouldRepeat: boolean
}

const getMemoryDateMs = (memory: Memory) => {
  const rawDate = memory.date || memory.createdAt
  const rawTime = memory.time || '00:00'
  const date = new Date(`${rawDate}T${rawTime}`)

  if (!Number.isNaN(date.getTime())) return date.getTime()

  const fallbackDate = new Date(rawDate)
  return Number.isNaN(fallbackDate.getTime()) ? 0 : fallbackDate.getTime()
}

const interpolateCoordinates = (
  start: [number, number],
  end: [number, number],
  progress: number,
): [number, number] => [
  start[0] + (end[0] - start[0]) * progress,
  start[1] + (end[1] - start[1]) * progress,
]

const buildAnimatedSegment = (start: [number, number], end: [number, number], progress: number) => {
  const steps = 48
  const safeProgress = Math.max(0, Math.min(progress, 1))
  const visibleSteps = Math.max(1, Math.ceil(steps * safeProgress))

  return Array.from({ length: visibleSteps + 1 }, (_, index) => {
    const stepProgress = Math.min(index / steps, safeProgress)
    return interpolateCoordinates(start, end, stepProgress)
  })
}

const AnimatedRouteLinesLayer = ({
  memories,
  markedLocations,
  isEnabled,
  shouldRepeat,
}: AnimatedRouteLinesLayerProps) => {
  const [animationProgress, setAnimationProgress] = useState(0)

  const locationsById = useMemo(
    () =>
      markedLocations.reduce<Record<string, MarkedLocation>>((acc, location) => {
        acc[location.id] = location
        return acc
      }, {}),
    [markedLocations],
  )

  const orderedMemories = useMemo<MemoryWithLocation[]>(
    () =>
      memories
        .map(memory => {
          const location = locationsById[memory.markedLocationId]
          if (!location) return undefined

          return {
            memory,
            location,
            dateMs: getMemoryDateMs(memory),
          }
        })
        .filter((item): item is MemoryWithLocation => Boolean(item))
        .sort((first, second) => first.dateMs - second.dateMs),
    [locationsById, memories],
  )

  useEffect(() => {
    if (!isEnabled || orderedMemories.length < 2) {
      setAnimationProgress(0)
      return undefined
    }

    let frameId = 0
    let startedAt = performance.now()
    const duration = Math.max(13000, orderedMemories.length * 3200)

    const tick = (now: number) => {
      const elapsed = now - startedAt
      const rawProgress = Math.min(elapsed / duration, 1)
      const nextProgress = 1 - Math.pow(1 - rawProgress, 3)

      setAnimationProgress(nextProgress)

      if (nextProgress < 1) {
        frameId = requestAnimationFrame(tick)
        return
      }

      if (shouldRepeat) {
        startedAt = now + 700
        setAnimationProgress(0)
        frameId = requestAnimationFrame(tick)
      }
    }

    setAnimationProgress(0)
    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [isEnabled, orderedMemories.length, shouldRepeat])

  const routeData = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point>>(() => {
    if (!isEnabled || orderedMemories.length < 2) {
      return {
        type: 'FeatureCollection',
        features: [],
      }
    }

    const segmentCount = orderedMemories.length - 1
    const totalSegmentProgress = animationProgress * segmentCount

    const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = []
    const headFeatures: GeoJSON.Feature<GeoJSON.Point>[] = []

    for (let index = 0; index < segmentCount; index += 1) {
      const segmentProgress = Math.max(0, Math.min(totalSegmentProgress - index, 1))

      if (segmentProgress <= 0) continue

      const startLocation = orderedMemories[index].location
      const endLocation = orderedMemories[index + 1].location
      const start: [number, number] = [startLocation.longitude, startLocation.latitude]
      const end: [number, number] = [endLocation.longitude, endLocation.latitude]
      const coordinates = buildAnimatedSegment(start, end, segmentProgress)
      const headCoordinate = coordinates[coordinates.length - 1]

      lineFeatures.push({
        type: 'Feature',
        properties: {
          id: `route-${index}`,
        },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      })

      headFeatures.push({
        type: 'Feature',
        properties: {
          id: `route-head-${index}`,
        },
        geometry: {
          type: 'Point',
          coordinates: headCoordinate,
        },
      })
    }

    return {
      type: 'FeatureCollection',
      features: [...lineFeatures, ...headFeatures],
    }
  }, [animationProgress, isEnabled, orderedMemories])

  if (!isEnabled) return null

  return (
    <Source id={ANIMATED_ROUTE_SOURCE_ID} type="geojson" data={routeData}>
      <Layer
        id={ANIMATED_ROUTE_GLOW_LAYER_ID}
        type="line"
        source={ANIMATED_ROUTE_SOURCE_ID}
        filter={['==', ['geometry-type'], 'LineString']}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': '#fbbf24',
          'line-width': 11,
          'line-blur': 8,
          'line-opacity': 0.45,
        }}
      />

      <Layer
        id={ANIMATED_ROUTE_LINE_LAYER_ID}
        type="line"
        source={ANIMATED_ROUTE_SOURCE_ID}
        filter={['==', ['geometry-type'], 'LineString']}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': '#facc15',
          'line-width': 3.5,
          'line-opacity': 0.96,
        }}
      />

      <Layer
        id={ANIMATED_ROUTE_HEAD_LAYER_ID}
        type="circle"
        source={ANIMATED_ROUTE_SOURCE_ID}
        filter={['==', ['geometry-type'], 'Point']}
        paint={{
          'circle-color': '#facc15',
          'circle-radius': 6,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        }}
      />
    </Source>
  )
}

export default AnimatedRouteLinesLayer
