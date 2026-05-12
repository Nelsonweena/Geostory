import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { create } from 'zustand'

import { getFirebaseConfigError, getFirebaseFirestore } from '@/frontend/services/firebase'
import { MarkedLocation } from '@/shared/types/markedLocation'
import { Memory, MemoryInput, MemoryPhoto } from '@/shared/types/memory'

type MemoryMap = Record<MarkedLocation['id'], Memory[]>

type FirestoreMemoryDocument = Omit<Memory, 'photos' | 'tags'> & {
  photosJson: string
  tagsJson: string
}

let unsubscribeFromMemories: (() => void) | undefined

const LOCAL_MEMORY_PHOTO_PREFIX = 'indexeddb-memory-photo:'
const MEMORY_PHOTO_DB_NAME = 'geostory-memory-photos'
const MEMORY_PHOTO_STORE_NAME = 'photos'

const buildMemoryId = () => `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const buildPhotoId = () => `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getUserMemoriesCollection = (userId: string) =>
  collection(getFirebaseFirestore(), 'users', userId, 'memories')

const getUserMemoryDoc = (userId: string, memoryId: string) =>
  doc(getFirebaseFirestore(), 'users', userId, 'memories', memoryId)

const openMemoryPhotoDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(MEMORY_PHOTO_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(MEMORY_PHOTO_STORE_NAME)) {
        db.createObjectStore(MEMORY_PHOTO_STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to open photo database.'))
  })

const savePhotoLocally = async (photoId: string, file: File): Promise<string> => {
  const db = await openMemoryPhotoDb()
  const localPhotoKey = `${LOCAL_MEMORY_PHOTO_PREFIX}${photoId}`

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEMORY_PHOTO_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(MEMORY_PHOTO_STORE_NAME)

    store.put(file, localPhotoKey)

    transaction.oncomplete = () => {
      db.close()
      resolve(localPhotoKey)
    }

    transaction.onerror = () => {
      db.close()
      reject(transaction.error || new Error('Unable to save photo locally.'))
    }

    transaction.onabort = () => {
      db.close()
      reject(transaction.error || new Error('Photo save was aborted.'))
    }
  })
}

export const getLocalMemoryPhotoUrl = async (photoUrl: string): Promise<string> => {
  if (!photoUrl.startsWith(LOCAL_MEMORY_PHOTO_PREFIX)) return photoUrl

  const db = await openMemoryPhotoDb()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEMORY_PHOTO_STORE_NAME, 'readonly')
    const store = transaction.objectStore(MEMORY_PHOTO_STORE_NAME)
    const request = store.get(photoUrl)

    request.onsuccess = () => {
      db.close()

      const blob = request.result as Blob | undefined

      if (!blob) {
        resolve('')
        return
      }

      resolve(URL.createObjectURL(blob))
    }

    request.onerror = () => {
      db.close()
      reject(request.error || new Error('Unable to load photo locally.'))
    }
  })
}

const uploadMemoryPhotos = async (files: File[]): Promise<MemoryPhoto[]> => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))

  return Promise.all(
    imageFiles.map(async file => {
      const photoId = buildPhotoId()
      const localPhotoKey = await savePhotoLocally(photoId, file)

      return {
        id: photoId,
        url: localPhotoKey,
        uploadedAt: new Date().toISOString(),
      }
    }),
  )
}

const normalizeTags = (tags: string[] = []): string[] => tags.map(tag => tag.trim()).filter(Boolean)

const normalizePhotos = (photos: MemoryPhoto[] = []): MemoryPhoto[] =>
  photos
    .filter(photo => typeof photo.url === 'string' && photo.url.trim())
    .map(photo => ({
      id: String(photo.id || buildPhotoId()),
      url: String(photo.url),
      uploadedAt: String(photo.uploadedAt || new Date().toISOString()),
      ...(photo.caption ? { caption: String(photo.caption) } : {}),
    }))

const normalizeMemoryInput = (input: MemoryInput): MemoryInput => ({
  title: input.title.trim(),
  description: input.description.trim(),
  ...(input.date?.trim() ? { date: input.date.trim() } : {}),
  ...(input.time?.trim() ? { time: input.time.trim() } : {}),
  ...(input.mood?.trim() ? { mood: input.mood.trim() } : {}),
  photos: normalizePhotos(input.photos || []),
  tags: normalizeTags(input.tags || []),
})

const toFirestoreMemoryDocument = (memory: Memory): FirestoreMemoryDocument => ({
  id: memory.id,
  userId: memory.userId,
  markedLocationId: memory.markedLocationId,
  title: memory.title,
  description: memory.description,
  ...(memory.date ? { date: memory.date } : {}),
  ...(memory.time ? { time: memory.time } : {}),
  ...(memory.mood ? { mood: memory.mood } : {}),
  photosJson: JSON.stringify(normalizePhotos(memory.photos)),
  tagsJson: JSON.stringify(normalizeTags(memory.tags)),
  createdAt: memory.createdAt,
  updatedAt: memory.updatedAt,
})

const fromFirestoreMemoryDocument = (
  id: string,
  data: Partial<FirestoreMemoryDocument>,
): Memory => {
  let photos: MemoryPhoto[] = []
  let tags: string[] = []

  try {
    photos = data.photosJson ? JSON.parse(data.photosJson) : []
  } catch {
    photos = []
  }

  try {
    tags = data.tagsJson ? JSON.parse(data.tagsJson) : []
  } catch {
    tags = []
  }

  return {
    id,
    userId: data.userId || '',
    markedLocationId: data.markedLocationId || '',
    title: data.title || '',
    description: data.description || '',
    date: data.date,
    time: data.time,
    mood: data.mood,
    photos: normalizePhotos(photos),
    tags: normalizeTags(tags),
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
  }
}

const getLocalDateAndTime = () => {
  const now = new Date()

  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join(':')

  return {
    date,
    time,
    iso: now.toISOString(),
  }
}

interface MemoriesStoreValues {
  activeUserId?: string
  memories: Memory[]
  memoriesByMarkedLocationId: MemoryMap
  selectedMarkedLocationId?: MarkedLocation['id']
  isLoadingMemories: boolean
  isUploadingMemoryPhotos: boolean
  memoriesError?: string
  setActiveUserId: (userId?: string) => void
  subscribeToUserMemories: (userId?: string) => void
  selectMarkedLocation: (markedLocationId?: MarkedLocation['id']) => void
  getMemoriesForMarkedLocation: (markedLocationId: MarkedLocation['id']) => Memory[]
  addMemory: (
    markedLocationId: MarkedLocation['id'],
    input: MemoryInput,
    photoFiles?: File[],
  ) => Promise<void>
  updateMemory: (memoryId: Memory['id'], input: MemoryInput, photoFiles?: File[]) => Promise<void>
  deleteMemory: (memoryId: Memory['id']) => Promise<void>
  clearMemoriesForMarkedLocation: (markedLocationId: MarkedLocation['id']) => Promise<void>
}

const groupMemoriesByLocation = (memories: Memory[]) =>
  memories.reduce<MemoryMap>((acc, memory) => {
    acc[memory.markedLocationId] = [...(acc[memory.markedLocationId] || []), memory]
    return acc
  }, {})

const sortMemories = (memories: Memory[]) =>
  [...memories].sort((first, second) => {
    const firstDate = `${first.date || first.createdAt} ${first.time || ''}`
    const secondDate = `${second.date || second.createdAt} ${second.time || ''}`
    return secondDate.localeCompare(firstDate)
  })

const setMemoriesState = (
  set: (partial: Partial<MemoriesStoreValues>) => void,
  memories: Memory[],
) => {
  const sortedMemories = sortMemories(memories)

  set({
    memories: sortedMemories,
    memoriesByMarkedLocationId: groupMemoriesByLocation(sortedMemories),
  })
}

const useMemoriesStore = create<MemoriesStoreValues>()((set, get) => ({
  activeUserId: undefined,
  memories: [],
  memoriesByMarkedLocationId: {},
  selectedMarkedLocationId: undefined,
  isLoadingMemories: false,
  isUploadingMemoryPhotos: false,
  memoriesError: undefined,

  setActiveUserId: userId => {
    set({ activeUserId: userId })
    get().subscribeToUserMemories(userId)
  },

  subscribeToUserMemories: userId => {
    unsubscribeFromMemories?.()
    unsubscribeFromMemories = undefined

    if (!userId) {
      set({
        memories: [],
        memoriesByMarkedLocationId: {},
        selectedMarkedLocationId: undefined,
        isLoadingMemories: false,
        isUploadingMemoryPhotos: false,
        memoriesError: undefined,
      })
      return
    }

    if (getFirebaseConfigError()) {
      set({
        memories: [],
        memoriesByMarkedLocationId: {},
        isLoadingMemories: false,
        isUploadingMemoryPhotos: false,
        memoriesError: 'Firebase is not configured.',
      })
      return
    }

    set({ isLoadingMemories: true, memoriesError: undefined })

    unsubscribeFromMemories = onSnapshot(
      query(getUserMemoriesCollection(userId)),
      snapshot => {
        const memories = snapshot.docs
          .map(documentSnapshot =>
            fromFirestoreMemoryDocument(
              documentSnapshot.id,
              documentSnapshot.data() as Partial<FirestoreMemoryDocument>,
            ),
          )
          .filter(memory => memory.markedLocationId)

        set({
          memories: sortMemories(memories),
          memoriesByMarkedLocationId: groupMemoriesByLocation(sortMemories(memories)),
          isLoadingMemories: false,
          memoriesError: undefined,
        })
      },
      error => {
        set({
          memories: [],
          memoriesByMarkedLocationId: {},
          isLoadingMemories: false,
          memoriesError: error.message || 'Unable to load memories.',
        })
      },
    )
  },

  selectMarkedLocation: markedLocationId => set({ selectedMarkedLocationId: markedLocationId }),

  getMemoriesForMarkedLocation: markedLocationId =>
    get().memoriesByMarkedLocationId[markedLocationId] || [],

  addMemory: async (markedLocationId, input, photoFiles = []) => {
    const userId = get().activeUserId

    if (!userId) {
      set({ memoriesError: 'Log in to add memories.' })
      return
    }

    const normalizedInput = normalizeMemoryInput(input)

    if (!normalizedInput.title || !normalizedInput.description) {
      set({ memoriesError: 'Add a title and description for this memory.' })
      return
    }

    const now = getLocalDateAndTime()
    const memoryId = buildMemoryId()

    set({ isUploadingMemoryPhotos: true, memoriesError: undefined })

    try {
      const uploadedPhotos = await uploadMemoryPhotos(photoFiles)

      const memory: Memory = {
        id: memoryId,
        userId,
        markedLocationId,
        title: normalizedInput.title,
        description: normalizedInput.description,
        date: normalizedInput.date || now.date,
        time: normalizedInput.time || now.time,
        mood: normalizedInput.mood,
        photos: normalizePhotos([...(normalizedInput.photos || []), ...uploadedPhotos]),
        tags: normalizeTags(normalizedInput.tags || []),
        createdAt: now.iso,
        updatedAt: now.iso,
      }

      setMemoriesState(set, [memory, ...get().memories])

      await setDoc(getUserMemoryDoc(userId, memoryId), toFirestoreMemoryDocument(memory))
    } catch (error) {
      const rollbackMemories = get().memories.filter(memory => memory.id !== memoryId)

      set({
        memories: sortMemories(rollbackMemories),
        memoriesByMarkedLocationId: groupMemoriesByLocation(sortMemories(rollbackMemories)),
        memoriesError: error instanceof Error ? error.message : 'Unable to save memory.',
      })
    } finally {
      set({ isUploadingMemoryPhotos: false })
    }
  },

  updateMemory: async (memoryId, input, photoFiles = []) => {
    const userId = get().activeUserId

    if (!userId) {
      set({ memoriesError: 'Log in to update memories.' })
      return
    }

    const existingMemory = get().memories.find(memory => memory.id === memoryId)

    if (!existingMemory) {
      set({ memoriesError: 'Memory not found.' })
      return
    }

    const normalizedInput = normalizeMemoryInput(input)

    set({ isUploadingMemoryPhotos: true, memoriesError: undefined })

    try {
      const uploadedPhotos = await uploadMemoryPhotos(photoFiles)
      const updatedAt = new Date().toISOString()

      const updatedMemory: Memory = {
        ...existingMemory,
        title: normalizedInput.title,
        description: normalizedInput.description,
        date: normalizedInput.date || existingMemory.date,
        time: normalizedInput.time || existingMemory.time,
        mood: normalizedInput.mood,
        photos: normalizePhotos([...(normalizedInput.photos || []), ...uploadedPhotos]),
        tags: normalizeTags(normalizedInput.tags || []),
        updatedAt,
      }

      const optimisticMemories = get().memories.map(memory =>
        memory.id === memoryId ? updatedMemory : memory,
      )

      setMemoriesState(set, optimisticMemories)

      const firestoreMemory = toFirestoreMemoryDocument(updatedMemory)

      await updateDoc(getUserMemoryDoc(userId, memoryId), {
        title: firestoreMemory.title,
        description: firestoreMemory.description,
        ...(firestoreMemory.date ? { date: firestoreMemory.date } : {}),
        ...(firestoreMemory.time ? { time: firestoreMemory.time } : {}),
        ...(firestoreMemory.mood ? { mood: firestoreMemory.mood } : {}),
        photosJson: firestoreMemory.photosJson,
        tagsJson: firestoreMemory.tagsJson,
        updatedAt: firestoreMemory.updatedAt,
      })
    } catch (error) {
      set({
        memoriesError: error instanceof Error ? error.message : 'Unable to update memory.',
      })
    } finally {
      set({ isUploadingMemoryPhotos: false })
    }
  },

  deleteMemory: async memoryId => {
    const userId = get().activeUserId

    if (!userId) {
      set({ memoriesError: 'Log in to delete memories.' })
      return
    }

    const existingMemories = get().memories
    const optimisticMemories = existingMemories.filter(memory => memory.id !== memoryId)

    setMemoriesState(set, optimisticMemories)

    try {
      await deleteDoc(getUserMemoryDoc(userId, memoryId))
    } catch (error) {
      setMemoriesState(set, existingMemories)
      set({
        memoriesError: error instanceof Error ? error.message : 'Unable to delete memory.',
      })
    }
  },

  clearMemoriesForMarkedLocation: async markedLocationId => {
    const userId = get().activeUserId

    if (!userId) {
      set({ memoriesError: 'Log in to clear memories.' })
      return
    }

    const existingMemories = get().memories
    const optimisticMemories = existingMemories.filter(
      memory => memory.markedLocationId !== markedLocationId,
    )

    setMemoriesState(set, optimisticMemories)

    try {
      const snapshot = await getDocs(getUserMemoriesCollection(userId))
      const matchingDocs = snapshot.docs.filter(
        documentSnapshot => documentSnapshot.data().markedLocationId === markedLocationId,
      )

      await Promise.all(matchingDocs.map(documentSnapshot => deleteDoc(documentSnapshot.ref)))
    } catch (error) {
      setMemoriesState(set, existingMemories)
      set({
        memoriesError:
          error instanceof Error ? error.message : 'Unable to clear memories for this location.',
      })
    }
  },
}))

export default useMemoriesStore
