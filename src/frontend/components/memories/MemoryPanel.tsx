import { MapPinOff, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import MemoryPhotoCarousel from '@/frontend/components/memories/MemoryPhotoCarousel'
import { MarkedLocation } from '@/shared/types/markedLocation'
import { Memory, MemoryPhoto } from '@/shared/types/memory'
import useMarkedLocationsStore from '@/store/useMarkedLocationsStore'
import useMemoriesStore, { getLocalMemoryPhotoUrl } from '@/store/useMemoriesStore'

type MemoryPanelProps = {
  markedLocation?: MarkedLocation
  onClose: () => void
}

type MemoryFormState = {
  title: string
  date: string
  time: string
  mood: string
  description: string
  tags: string
  existingPhotos: MemoryPhoto[]
}

type MemoryImageProps = {
  photoUrl: string
  alt: string
  className: string
}

type LocationHeaderDetails = {
  country: string
  region: string
}

const emptyForm: MemoryFormState = {
  title: '',
  date: '',
  time: '',
  mood: '',
  description: '',
  tags: '',
  existingPhotos: [],
}

const getMemoryFormState = (memory?: Memory): MemoryFormState => {
  if (!memory) return emptyForm

  return {
    title: memory.title,
    date: memory.date || '',
    time: memory.time || '',
    mood: memory.mood || '',
    description: memory.description,
    tags: memory.tags.join(', '),
    existingPhotos: memory.photos || [],
  }
}

const buildTags = (tags: string): string[] =>
  tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

const formatMemoryDateTime = (memory: Memory) => {
  const date = memory.date || memory.createdAt?.slice(0, 10)
  const time = memory.time || memory.createdAt?.slice(11, 16)

  return [date, time, memory.mood].filter(Boolean).join(' • ') || 'Memory'
}

const getLocationHeaderDetails = async (
  latitude: number,
  longitude: number,
): Promise<LocationHeaderDetails> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
  )

  if (!response.ok) {
    throw new Error('Unable to load location details.')
  }

  const data = await response.json()
  const address = data.address || {}

  const country = address.country || 'Unknown country'

  const region =
    address.city ||
    address.town ||
    address.village ||
    address.county ||
    address.state ||
    address.region ||
    address.province ||
    address.municipality ||
    'Unknown region'

  return {
    country,
    region,
  }
}

const MemoryImage = ({ photoUrl, alt, className }: MemoryImageProps) => {
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
    return <div className={`${className} flex items-center justify-center bg-light text-xs`} />
  }

  return <img className={className} src={resolvedUrl} alt={alt} />
}

const MemoryPanel = ({ markedLocation, onClose }: MemoryPanelProps) => {
  const activeUserId = useMemoriesStore(state => state.activeUserId)

  /**
   * Important:
   * Subscribe directly to memoriesByMarkedLocationId.
   * This makes add/update/delete render instantly.
   */
  const memoriesByMarkedLocationId = useMemoriesStore(state => state.memoriesByMarkedLocationId)

  const addMemory = useMemoriesStore(state => state.addMemory)
  const updateMemory = useMemoriesStore(state => state.updateMemory)
  const deleteMemory = useMemoriesStore(state => state.deleteMemory)
  const clearMemoriesForMarkedLocation = useMemoriesStore(
    state => state.clearMemoriesForMarkedLocation,
  )
  const isLoadingMemories = useMemoriesStore(state => state.isLoadingMemories)
  const isUploadingMemoryPhotos = useMemoriesStore(state => state.isUploadingMemoryPhotos)
  const memoriesError = useMemoriesStore(state => state.memoriesError)

  const deleteMarkedLocation = useMarkedLocationsStore(state => state.deleteMarkedLocation)
  const markedLocationsError = useMarkedLocationsStore(state => state.markedLocationsError)

  const [editingMemoryId, setEditingMemoryId] = useState<Memory['id'] | undefined>()
  const [form, setForm] = useState<MemoryFormState>(emptyForm)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isDeletingLocation, setIsDeletingLocation] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [locationHeaderDetails, setLocationHeaderDetails] = useState<LocationHeaderDetails>({
    country: 'Loading location...',
    region: '',
  })

  const memories = useMemo(
    () => (markedLocation ? memoriesByMarkedLocationId[markedLocation.id] || [] : []),
    [markedLocation, memoriesByMarkedLocationId],
  )

  const editingMemory = useMemo(
    () => memories.find(memory => memory.id === editingMemoryId),
    [editingMemoryId, memories],
  )

  const selectedPhotoPreviews = useMemo(
    () =>
      photoFiles.map(file => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [photoFiles],
  )

  useEffect(
    () => () => {
      selectedPhotoPreviews.forEach(photo => {
        URL.revokeObjectURL(photo.url)
      })
    },
    [selectedPhotoPreviews],
  )

  useEffect(() => {
    setEditingMemoryId(undefined)
    setForm(emptyForm)
    setPhotoFiles([])
    setIsFormOpen(false)
  }, [markedLocation?.id])

  useEffect(() => {
    if (!markedLocation) return undefined

    let isMounted = true

    setLocationHeaderDetails({
      country: 'Loading location...',
      region: '',
    })

    getLocationHeaderDetails(markedLocation.latitude, markedLocation.longitude)
      .then(details => {
        if (isMounted) {
          setLocationHeaderDetails(details)
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocationHeaderDetails({
            country: markedLocation.headline,
            region: `${markedLocation.latitude.toFixed(4)}, ${markedLocation.longitude.toFixed(4)}`,
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [markedLocation])

  if (!markedLocation) return null

  const startNewMemory = () => {
    setEditingMemoryId(undefined)
    setForm(emptyForm)
    setPhotoFiles([])
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setEditingMemoryId(undefined)
    setForm(emptyForm)
    setPhotoFiles([])
    setIsFormOpen(false)
  }

  const startEditingMemory = (memory: Memory) => {
    setEditingMemoryId(memory.id)
    setForm(getMemoryFormState(memory))
    setPhotoFiles([])
    setIsFormOpen(true)
  }

  const removeExistingPhoto = (photoId: string) => {
    setForm(current => ({
      ...current,
      existingPhotos: current.existingPhotos.filter(photo => photo.id !== photoId),
    }))
  }

  const removeSelectedPhoto = (photoIndex: number) => {
    setPhotoFiles(current => current.filter((_, index) => index !== photoIndex))
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const payload = {
        title: form.title,
        description: form.description,
        date: form.date,
        time: form.time,
        mood: form.mood,
        photos: form.existingPhotos,
        tags: buildTags(form.tags),
      }

      if (editingMemory) {
        await updateMemory(editingMemory.id, payload, photoFiles)
      } else {
        await addMemory(markedLocation.id, payload, photoFiles)
      }

      setForm(emptyForm)
      setPhotoFiles([])
      setEditingMemoryId(undefined)
      setIsFormOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteMemory = async (memory: Memory) => {
    const confirmed = window.confirm(
      `Delete "${memory.title}"? This memory will be permanently removed.`,
    )

    if (!confirmed) return

    await deleteMemory(memory.id)
  }

  const handleDeleteMarkedLocation = async () => {
    const confirmed = window.confirm(
      'Delete this marked location? This will also delete all memories attached to it.',
    )

    if (!confirmed) return

    setIsDeletingLocation(true)

    try {
      await clearMemoriesForMarkedLocation(markedLocation.id)
      await deleteMarkedLocation(markedLocation.id)
      onClose()
    } finally {
      setIsDeletingLocation(false)
    }
  }

  const saveButtonText = (() => {
    if (isSaving || isUploadingMemoryPhotos) return 'Saving...'
    if (editingMemory) return 'Save changes'
    return 'Save memory'
  })()

  return (
    <aside className="absolute right-4 top-24 z-30 flex max-h-[calc(100vh-8rem)] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white text-dark shadow-2xl">
      <div className="flex items-start justify-between border-b border-light p-4">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-darkLight">
            Location memory
          </p>

          <h2 className="m-0 mt-1 text-2xl font-black leading-tight">
            {locationHeaderDetails.country}
          </h2>

          <p className="m-0 mt-1 text-sm font-semibold text-darkLight">
            {locationHeaderDetails.region}
          </p>
        </div>

        <button className="rounded-full p-2 hover:bg-light" type="button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="overflow-y-auto p-4">
        {!activeUserId && (
          <p className="m-0 mb-4 rounded-xl bg-warning/20 p-3 text-sm">
            Log in to save memories to Firestore.
          </p>
        )}

        {(memoriesError || markedLocationsError) && (
          <p className="m-0 mb-4 rounded-xl bg-warning/20 p-3 text-sm">
            {memoriesError || markedLocationsError}
          </p>
        )}

        {!isFormOpen && (
          <button
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-darkLight bg-white p-4 text-sm font-black text-dark transition hover:bg-mapBg"
            type="button"
            onClick={startNewMemory}
          >
            Add new memory
            <Plus size={16} />
          </button>
        )}

        {isFormOpen && (
          <div className="rounded-2xl border border-light bg-mapBg p-3">
            {(editingMemoryId || form.title || form.description || photoFiles.length > 0) && (
              <div className="mb-3 flex justify-end gap-3">
                <button
                  className="text-sm font-bold text-darkLight"
                  type="button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  className="text-sm font-bold text-darkLight"
                  type="button"
                  onClick={startNewMemory}
                >
                  New
                </button>
              </div>
            )}

            <input
              className="mb-2 w-full rounded-xl border border-light bg-white px-3 py-2 text-lg font-bold outline-none focus:border-dark"
              placeholder="Memory title"
              value={form.title}
              onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
            />

            <div className="mb-2 grid grid-cols-3 gap-2">
              <input
                className="rounded-xl border border-light bg-white px-3 py-2 outline-none focus:border-dark"
                type="date"
                value={form.date}
                onChange={event => setForm(current => ({ ...current, date: event.target.value }))}
              />

              <input
                className="rounded-xl border border-light bg-white px-3 py-2 outline-none focus:border-dark"
                type="time"
                value={form.time}
                onChange={event => setForm(current => ({ ...current, time: event.target.value }))}
              />

              <input
                className="rounded-xl border border-light bg-white px-3 py-2 outline-none focus:border-dark"
                placeholder="Mood / theme"
                value={form.mood}
                onChange={event => setForm(current => ({ ...current, mood: event.target.value }))}
              />
            </div>

            <textarea
              className="min-h-[180px] w-full resize-y rounded-xl border border-light bg-white px-3 py-2 leading-relaxed outline-none focus:border-dark"
              placeholder="Document the full memory: what happened, who was there, why it matters..."
              value={form.description}
              onChange={event =>
                setForm(current => ({ ...current, description: event.target.value }))
              }
            />

            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-darkLight bg-white p-4 text-center">
              <Upload size={24} />

              <span className="mt-2 text-sm font-bold">Upload photos on this device</span>
              <span className="text-xs text-darkLight">PNG, JPG, WEBP, or GIF</span>

              <input
                className="hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={event => {
                  const files = Array.from(event.target.files || [])
                  setPhotoFiles(current => [...current, ...files])
                  event.target.value = ''
                }}
              />
            </label>

            {(form.existingPhotos.length > 0 || selectedPhotoPreviews.length > 0) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {form.existingPhotos.map(photo => (
                  <div key={photo.id} className="relative overflow-hidden rounded-xl">
                    <MemoryImage
                      className="h-24 w-full object-cover"
                      photoUrl={photo.url}
                      alt="Saved memory"
                    />

                    <button
                      className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-xs font-black"
                      type="button"
                      onClick={() => removeExistingPhoto(photo.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {selectedPhotoPreviews.map((photo, index) => (
                  <div key={photo.url} className="relative overflow-hidden rounded-xl">
                    <img className="h-24 w-full object-cover" src={photo.url} alt={photo.name} />

                    <span className="absolute bottom-1 left-1 rounded bg-white/90 px-2 py-1 text-[10px] font-bold">
                      New
                    </span>

                    <button
                      className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-1 text-xs font-black"
                      type="button"
                      onClick={() => removeSelectedPhoto(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              className="mt-3 w-full rounded-xl border border-light bg-white px-3 py-2 outline-none focus:border-dark"
              placeholder="Tags, separated by commas"
              value={form.tags}
              onChange={event => setForm(current => ({ ...current, tags: event.target.value }))}
            />

            <button
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-dark px-3 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={
                !activeUserId ||
                isSaving ||
                isUploadingMemoryPhotos ||
                !form.title.trim() ||
                !form.description.trim()
              }
              onClick={() => {
                handleSave().catch(() => undefined)
              }}
            >
              <Save size={18} />
              {saveButtonText}
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <h3 className="m-0 text-lg font-black">Memory feed</h3>

          <span className="rounded-full bg-light px-3 py-1 text-xs font-bold text-darkLight">
            {isLoadingMemories ? 'Loading' : `${memories.length} saved`}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-4">
          {!memories.length && !isLoadingMemories && (
            <div className="rounded-2xl border border-dashed border-gray p-4 text-center text-sm text-darkLight">
              No memories yet. Click “Add new memory +” to document this location.
            </div>
          )}

          {memories.map(memory => (
            <article
              key={memory.id}
              className="overflow-hidden rounded-2xl border border-light bg-white shadow-sm"
            >
              <MemoryPhotoCarousel photos={memory.photos} title={memory.title} />

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="m-0 text-xl font-black">{memory.title}</h4>

                    <p className="m-0 mt-1 text-xs font-bold uppercase tracking-[0.16em] text-darkLight">
                      {formatMemoryDateTime(memory)}
                    </p>
                  </div>

                  <button
                    className="rounded-full p-2 text-error hover:bg-light"
                    type="button"
                    onClick={() => {
                      handleDeleteMemory(memory).catch(() => undefined)
                    }}
                    aria-label="Delete memory"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <p className="whitespace-pre-wrap text-base leading-relaxed">
                  {memory.description}
                </p>

                {!!memory.tags.length && (
                  <div className="flex flex-wrap gap-2">
                    {memory.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-mapBg px-3 py-1 text-xs font-bold">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  className="mt-4 rounded-xl bg-darkLight px-3 py-2 text-sm font-bold text-white"
                  type="button"
                  onClick={() => startEditingMemory(memory)}
                >
                  Edit this memory
                </button>
              </div>
            </article>
          ))}
        </div>

        {memories.length === 0 && (
          <div className="mt-5 rounded-2xl border border-light bg-mapBg p-3">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-error px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!activeUserId || isDeletingLocation}
              onClick={() => {
                handleDeleteMarkedLocation().catch(() => undefined)
              }}
            >
              <MapPinOff size={16} />
              {isDeletingLocation ? 'Deleting location...' : 'Delete this marked location'}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

export default MemoryPanel
