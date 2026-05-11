import { create } from 'zustand'
import { StateStorage, createJSONStorage, persist } from 'zustand/middleware'

import { Place } from '@/shared/types/entityTypes'
import { MarkLocationInput, MarkedLocation } from '@/shared/types/markedLocation'

const storage: StateStorage = {
  getItem: name => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(name, value)
  },
  removeItem: name => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

const buildMarkId = (latitude: number, longitude: number) =>
  `${latitude.toFixed(6)}-${longitude.toFixed(6)}-${Date.now()}`

const formatCoordinate = (value: number) => value.toFixed(6)

const toMarkedLocation = ({
  latitude,
  longitude,
  headline,
}: MarkLocationInput): MarkedLocation => ({
  id: buildMarkId(latitude, longitude),
  headline:
    headline || `Marked location (${formatCoordinate(latitude)}, ${formatCoordinate(longitude)})`,
  latitude,
  longitude,
  markedAt: new Date().toISOString(),
})

const toMarkedPlace = (place: Place): MarkedLocation => ({
  id: `place-${place.id}`,
  placeId: place.id,
  headline: place.headline,
  latitude: place.latitude,
  longitude: place.longitude,
  category: place.category,
  population: place.population,
  markedAt: new Date().toISOString(),
})

interface MarkedLocationsStoreValues {
  markedLocations: MarkedLocation[]
  markLocation: (location: MarkLocationInput) => void
  markPlace: (place: Place) => void
  unmarkLocation: (markId: MarkedLocation['id']) => void
  togglePlaceMark: (place: Place) => void
  isPlaceMarked: (placeId: Place['id']) => boolean
  clearMarkedLocations: () => void
}

const useMarkedLocationsStore = create<MarkedLocationsStoreValues>()(
  persist(
    (set, get) => ({
      markedLocations: [],

      markLocation: location =>
        set(state => ({
          markedLocations: [...state.markedLocations, toMarkedLocation(location)],
        })),

      markPlace: place =>
        set(state => {
          if (state.markedLocations.some(location => location.placeId === place.id)) {
            return state
          }

          return {
            markedLocations: [...state.markedLocations, toMarkedPlace(place)],
          }
        }),

      unmarkLocation: markId =>
        set(state => ({
          markedLocations: state.markedLocations.filter(location => location.id !== markId),
        })),

      togglePlaceMark: place => {
        const markedPlace = get().markedLocations.find(location => location.placeId === place.id)

        if (markedPlace) {
          get().unmarkLocation(markedPlace.id)
          return
        }

        get().markPlace(place)
      },

      isPlaceMarked: placeId =>
        get().markedLocations.some(location => location.placeId === placeId),

      clearMarkedLocations: () => set({ markedLocations: [] }),
    }),
    {
      name: 'geostory-marked-locations',
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          return { markedLocations: [] }
        }

        return persistedState as MarkedLocationsStoreValues
      },
      storage: createJSONStorage(() => storage),
    },
  ),
)

export default useMarkedLocationsStore
