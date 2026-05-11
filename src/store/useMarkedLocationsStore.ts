import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc } from 'firebase/firestore'
import { create } from 'zustand'

import { getFirebaseConfigError, getFirebaseFirestore } from '@/frontend/services/firebase'
import { Place } from '@/shared/types/entityTypes'
import { MarkLocationInput, MarkedLocation } from '@/shared/types/markedLocation'

let unsubscribeFromMarkedLocations: (() => void) | undefined

const buildMarkId = (latitude: number, longitude: number) =>
  `${latitude.toFixed(6)}-${longitude.toFixed(6)}-${Date.now()}`

const formatCoordinate = (value: number) => value.toFixed(6)

const getUserMarkedLocationsCollection = (userId: string) =>
  collection(getFirebaseFirestore(), 'users', userId, 'markedLocations')

const getUserMarkedLocationDoc = (userId: string, markId: string) =>
  doc(getFirebaseFirestore(), 'users', userId, 'markedLocations', markId)

const toMarkedLocation = (
  userId: string,
  { latitude, longitude, headline }: MarkLocationInput,
): MarkedLocation => ({
  id: buildMarkId(latitude, longitude),
  userId,
  headline:
    headline || `Marked location (${formatCoordinate(latitude)}, ${formatCoordinate(longitude)})`,
  latitude,
  longitude,
  markedAt: new Date().toISOString(),
})

const toMarkedPlace = (userId: string, place: Place): MarkedLocation => ({
  id: `place-${place.id}`,
  userId,
  placeId: place.id,
  headline: place.headline,
  latitude: place.latitude,
  longitude: place.longitude,
  category: place.category,
  population: place.population,
  markedAt: new Date().toISOString(),
})

interface MarkedLocationsStoreValues {
  activeUserId?: string
  markedLocations: MarkedLocation[]
  isLoadingMarkedLocations: boolean
  markedLocationsError?: string
  setActiveUserId: (userId?: string) => void
  subscribeToUserMarkedLocations: (userId?: string) => void
  markLocation: (location: MarkLocationInput) => Promise<void>
  markPlace: (place: Place) => Promise<void>
  unmarkLocation: (markId: MarkedLocation['id']) => Promise<void>
  togglePlaceMark: (place: Place) => Promise<void>
  isPlaceMarked: (placeId: Place['id']) => boolean
  clearMarkedLocations: () => Promise<void>
}

const useMarkedLocationsStore = create<MarkedLocationsStoreValues>()((set, get) => ({
  activeUserId: undefined,
  markedLocations: [],
  isLoadingMarkedLocations: false,
  markedLocationsError: undefined,

  setActiveUserId: userId => {
    set({ activeUserId: userId })
    get().subscribeToUserMarkedLocations(userId)
  },

  subscribeToUserMarkedLocations: userId => {
    unsubscribeFromMarkedLocations?.()
    unsubscribeFromMarkedLocations = undefined

    if (!userId) {
      set({
        markedLocations: [],
        isLoadingMarkedLocations: false,
        markedLocationsError: undefined,
      })
      return
    }

    if (getFirebaseConfigError()) {
      set({
        markedLocations: [],
        isLoadingMarkedLocations: false,
        markedLocationsError: 'Firebase is not configured.',
      })
      return
    }

    set({
      isLoadingMarkedLocations: true,
      markedLocationsError: undefined,
    })

    const markedLocationsQuery = query(getUserMarkedLocationsCollection(userId))

    unsubscribeFromMarkedLocations = onSnapshot(
      markedLocationsQuery,
      snapshot => {
        const markedLocations = snapshot.docs.map(documentSnapshot => ({
          id: documentSnapshot.id,
          ...documentSnapshot.data(),
        })) as MarkedLocation[]

        set({
          markedLocations,
          isLoadingMarkedLocations: false,
          markedLocationsError: undefined,
        })
      },
      error => {
        set({
          markedLocations: [],
          isLoadingMarkedLocations: false,
          markedLocationsError: error.message || 'Unable to load marked locations.',
        })
      },
    )
  },

  markLocation: async location => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to mark locations.' })
      return
    }

    const markedLocation = toMarkedLocation(userId, location)

    await setDoc(getUserMarkedLocationDoc(userId, markedLocation.id), markedLocation)
  },

  markPlace: async place => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to mark locations.' })
      return
    }

    const placeAlreadyMarkedByUser = get().markedLocations.some(
      location => location.userId === userId && location.placeId === place.id,
    )

    if (placeAlreadyMarkedByUser) return

    const markedPlace = toMarkedPlace(userId, place)

    await setDoc(getUserMarkedLocationDoc(userId, markedPlace.id), markedPlace)
  },

  unmarkLocation: async markId => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to update marked locations.' })
      return
    }

    await deleteDoc(getUserMarkedLocationDoc(userId, markId))
  },

  togglePlaceMark: async place => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to mark locations.' })
      return
    }

    const markedPlace = get().markedLocations.find(
      location => location.userId === userId && location.placeId === place.id,
    )

    if (markedPlace) {
      await get().unmarkLocation(markedPlace.id)
      return
    }

    await get().markPlace(place)
  },

  isPlaceMarked: placeId => {
    const userId = get().activeUserId

    if (!userId) return false

    return get().markedLocations.some(
      location => location.userId === userId && location.placeId === placeId,
    )
  },

  clearMarkedLocations: async () => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to clear marked locations.' })
      return
    }

    const snapshot = await getDocs(getUserMarkedLocationsCollection(userId))

    await Promise.all(snapshot.docs.map(documentSnapshot => deleteDoc(documentSnapshot.ref)))
  },
}))

export default useMarkedLocationsStore
