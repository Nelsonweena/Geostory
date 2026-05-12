import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc } from 'firebase/firestore'
import { create } from 'zustand'

import { getFirebaseConfigError, getFirebaseFirestore } from '@/frontend/services/firebase'
import { Place } from '@/shared/types/entityTypes'
import { MarkLocationInput, MarkedLocation } from '@/shared/types/markedLocation'

let unsubscribeFromMarkedLocations: (() => void) | undefined

const buildMarkedLocationId = () =>
  `marked-location-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getUserMarkedLocationsCollection = (userId: string) =>
  collection(getFirebaseFirestore(), 'users', userId, 'markedLocations')

const getUserMarkedLocationDoc = (userId: string, markedLocationId: string) =>
  doc(getFirebaseFirestore(), 'users', userId, 'markedLocations', markedLocationId)

const getMarkedLocationHeadline = (input: MarkLocationInput) =>
  input.headline || `Marked location (${input.latitude.toFixed(6)}, ${input.longitude.toFixed(6)})`

interface MarkedLocationsStoreValues {
  activeUserId?: string
  markedLocations: MarkedLocation[]
  isLoadingMarkedLocations: boolean
  markedLocationsError?: string
  setActiveUserId: (userId?: string) => void
  subscribeToUserMarkedLocations: (userId?: string) => void
  markLocation: (input: MarkLocationInput) => Promise<void>
  deleteMarkedLocation: (markedLocationId: MarkedLocation['id']) => Promise<void>
  clearMarkedLocations: () => Promise<void>
  togglePlaceMark: (place: Place) => Promise<void>
  isPlaceMarked: (placeId: Place['id']) => boolean
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

    set({ isLoadingMarkedLocations: true, markedLocationsError: undefined })

    unsubscribeFromMarkedLocations = onSnapshot(
      query(getUserMarkedLocationsCollection(userId)),
      snapshot => {
        const markedLocations = snapshot.docs
          .map(
            documentSnapshot =>
              ({
                id: documentSnapshot.id,
                ...documentSnapshot.data(),
              } as MarkedLocation),
          )
          .filter(
            location => Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
          )

        markedLocations.sort((first, second) => {
          const firstDate = first.markedAt || ''
          const secondDate = second.markedAt || ''
          return secondDate.localeCompare(firstDate)
        })

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

  markLocation: async input => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to mark locations.' })
      return
    }

    const markedLocationId = buildMarkedLocationId()

    const markedLocation: MarkedLocation = {
      id: markedLocationId,
      userId,
      latitude: input.latitude,
      longitude: input.longitude,
      headline: getMarkedLocationHeadline(input),
      country: input.country,
      region: input.region,
      markedAt: new Date().toISOString(),
    }

    await setDoc(getUserMarkedLocationDoc(userId, markedLocationId), markedLocation)
  },

  deleteMarkedLocation: async markedLocationId => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to delete marked locations.' })
      return
    }

    await deleteDoc(getUserMarkedLocationDoc(userId, markedLocationId))
  },

  togglePlaceMark: async place => {
    const userId = get().activeUserId

    if (!userId) {
      set({ markedLocationsError: 'Log in to mark places.' })
      return
    }

    const existingMarkedLocation = get().markedLocations.find(
      location => location.placeId === place.id && location.userId === userId,
    )

    if (existingMarkedLocation) {
      await deleteDoc(getUserMarkedLocationDoc(userId, existingMarkedLocation.id))
      return
    }

    const markedLocationId = buildMarkedLocationId()

    const markedLocation: MarkedLocation = {
      id: markedLocationId,
      userId,
      placeId: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
      headline: place.headline,
      category: place.category,
      population: place.population,
      markedAt: new Date().toISOString(),
    }

    await setDoc(getUserMarkedLocationDoc(userId, markedLocationId), markedLocation)
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
