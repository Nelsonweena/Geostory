import { CalendarDays, ImageIcon, MapPin, Search, SlidersHorizontal, Tag, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import MemoryPhotoCarousel from '@/frontend/components/memories/MemoryPhotoCarousel'
import {
  LocationDetails,
  getDisplayCountry,
  getDisplayRegion,
  getLocationCountry,
} from '@/frontend/components/memories/memoryLocationHelpers'
import { MarkedLocation } from '@/shared/types/markedLocation'
import { Memory } from '@/shared/types/memory'
import useMemoriesStore from '@/store/useMemoriesStore'

type MemoryFeedProps = {
  isOpen: boolean
  markedLocations: MarkedLocation[]
  onClose: () => void
  onViewOnGlobe: (markedLocationId: MarkedLocation['id']) => void
}

type MemoryFeedFilters = {
  search: string
  country: string
  tag: string
  mood: string
  date: string
}

type ReverseGeocodeResult = {
  address?: {
    country?: string
    state?: string
    province?: string
    region?: string
    county?: string
    city?: string
    town?: string
    village?: string
  }
}

const emptyFilters: MemoryFeedFilters = {
  search: '',
  country: '',
  tag: '',
  mood: '',
  date: '',
}

const normalize = (value?: string | number) =>
  String(value || '')
    .toLowerCase()
    .trim()

const formatMemoryDate = (memory: Memory) => {
  const date = memory.date || memory.createdAt?.slice(0, 10)
  const time = memory.time || memory.createdAt?.slice(11, 16)

  return [date, time].filter(Boolean).join(' • ') || 'Undated memory'
}

const getMemoryDateValue = (memory: Memory) => memory.date || memory.createdAt?.slice(0, 10) || ''

const memoryMatchesFilters = (
  memory: Memory,
  location: MarkedLocation | undefined,
  locationDetails: LocationDetails | undefined,
  filters: MemoryFeedFilters,
) => {
  const memoryDate = getMemoryDateValue(memory)
  const country = getLocationCountry(location, locationDetails)
  const region = getDisplayRegion(location, locationDetails)

  const searchableText = [
    memory.title,
    memory.description,
    memory.mood,
    memoryDate,
    location?.headline,
    country,
    region,
    ...memory.tags,
  ]
    .map(normalize)
    .join(' ')

  const search = normalize(filters.search)
  const countryFilter = normalize(filters.country)
  const tag = normalize(filters.tag)
  const mood = normalize(filters.mood)
  const date = normalize(filters.date)

  const matchesSearch = !search || searchableText.includes(search)
  const matchesCountry = !countryFilter || normalize(country).includes(countryFilter)
  const matchesTag = !tag || memory.tags.some(memoryTag => normalize(memoryTag).includes(tag))
  const matchesMood = !mood || normalize(memory.mood).includes(mood)
  const matchesDate = !date || normalize(memoryDate) === date

  return matchesSearch && matchesCountry && matchesTag && matchesMood && matchesDate
}

const MemoryFeed = ({ isOpen, markedLocations, onClose, onViewOnGlobe }: MemoryFeedProps) => {
  const memories = useMemoriesStore(state => state.memories)
  const isLoadingMemories = useMemoriesStore(state => state.isLoadingMemories)

  const [filters, setFilters] = useState<MemoryFeedFilters>(emptyFilters)
  const [areFiltersOpen, setAreFiltersOpen] = useState(false)
  const [locationDetailsById, setLocationDetailsById] = useState<Record<string, LocationDetails>>(
    {},
  )

  const locationsById = useMemo(
    () =>
      markedLocations.reduce<Record<string, MarkedLocation>>((acc, location) => {
        acc[location.id] = location
        return acc
      }, {}),
    [markedLocations],
  )

  useEffect(() => {
    const locationsNeedingDetails = markedLocations.filter(location => {
      const existingDetails = locationDetailsById[location.id]

      return (
        !existingDetails &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude)
      )
    })

    if (!locationsNeedingDetails.length) return

    let isCancelled = false

    const loadLocationDetails = async () => {
      const results = await Promise.all(
        locationsNeedingDetails.map(async location => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${location.latitude}&lon=${location.longitude}`,
            )

            const data = (await response.json()) as ReverseGeocodeResult

            const region =
              data.address?.state ||
              data.address?.province ||
              data.address?.region ||
              data.address?.county ||
              data.address?.city ||
              data.address?.town ||
              data.address?.village ||
              ''

            return {
              id: location.id,
              details: {
                country: data.address?.country || '',
                region,
              },
            }
          } catch {
            return {
              id: location.id,
              details: {
                country: '',
                region: '',
              },
            }
          }
        }),
      )

      if (isCancelled) return

      setLocationDetailsById(current => {
        const next = { ...current }

        results.forEach(result => {
          next[result.id] = result.details
        })

        return next
      })
    }

    loadLocationDetails()

    return () => {
      isCancelled = true
    }
  }, [locationDetailsById, markedLocations])

  const filteredMemories = useMemo(
    () =>
      memories.filter(memory => {
        const location = locationsById[memory.markedLocationId]
        const locationDetails = location ? locationDetailsById[location.id] : undefined

        return memoryMatchesFilters(memory, location, locationDetails, filters)
      }),
    [filters, locationDetailsById, locationsById, memories],
  )

  const groupedMemories = useMemo(
    () =>
      filteredMemories.reduce<Record<string, Memory[]>>((groups, memory) => {
        const key = memory.markedLocationId

        if (!groups[key]) {
          groups[key] = []
        }

        groups[key].push(memory)

        return groups
      }, {}),
    [filteredMemories],
  )

  const hasActiveFilters = Object.values(filters).some(Boolean)

  const updateFilter = (key: keyof MemoryFeedFilters, value: string) => {
    setFilters(current => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <aside
      className={`absolute right-4 top-24 z-30 flex max-h-[calc(100vh-8rem)] w-[500px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-[#D6DEE8] bg-white text-dark shadow-2xl transition-all duration-300 ease-out ${
        isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      }`}
    >
      <div className="flex items-start justify-between border-b border-[#D6DEE8] p-4">
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-darkLight">
            All memories
          </p>

          <h2 className="m-0 mt-1 text-2xl font-black leading-tight">Memory Feed</h2>

          <p className="m-0 mt-1 text-sm font-semibold text-darkLight">
            Search and filter every saved memory.
          </p>
        </div>

        <button className="rounded-full p-2 hover:bg-light" type="button" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="border-b border-[#D6DEE8] bg-white p-4">
        <div className="flex gap-2">
          <label className="relative flex-1" htmlFor="memory-feed-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-darkLight" size={18} />

            <input
              id="memory-feed-search"
              className="w-full rounded-2xl border border-light bg-mapBg py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-dark"
              placeholder="Search title, description, place, tag, mood, or date"
              type="text"
              value={filters.search}
              onChange={event => updateFilter('search', event.target.value)}
            />
          </label>

          <button
            className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
              areFiltersOpen || hasActiveFilters
                ? 'bg-dark text-white'
                : 'bg-mapBg text-dark hover:bg-light'
            }`}
            type="button"
            onClick={() => setAreFiltersOpen(current => !current)}
          >
            <SlidersHorizontal size={18} />
            Filters
          </button>
        </div>

        {areFiltersOpen && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-darkLight">
              Country
              <input
                className="rounded-xl border border-light bg-mapBg px-3 py-2 text-sm font-semibold normal-case tracking-normal text-dark outline-none focus:border-dark"
                placeholder="china"
                type="text"
                value={filters.country}
                onChange={event => updateFilter('country', event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-darkLight">
              Tag
              <input
                className="rounded-xl border border-light bg-mapBg px-3 py-2 text-sm font-semibold normal-case tracking-normal text-dark outline-none focus:border-dark"
                placeholder="food"
                type="text"
                value={filters.tag}
                onChange={event => updateFilter('tag', event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-darkLight">
              Mood
              <input
                className="rounded-xl border border-light bg-mapBg px-3 py-2 text-sm font-semibold normal-case tracking-normal text-dark outline-none focus:border-dark"
                placeholder="happy"
                type="text"
                value={filters.mood}
                onChange={event => updateFilter('mood', event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.14em] text-darkLight">
              Date
              <input
                className="rounded-xl border border-light bg-mapBg px-3 py-2 text-sm font-semibold normal-case tracking-normal text-dark outline-none focus:border-dark"
                type="date"
                value={filters.date}
                onChange={event => updateFilter('date', event.target.value)}
              />
            </label>

            {hasActiveFilters && (
              <button
                className="col-span-2 rounded-xl bg-light px-3 py-2 text-sm font-black text-dark transition hover:bg-gray/30"
                type="button"
                onClick={() => setFilters(emptyFilters)}
              >
                Clear search and filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-y-auto bg-mapBg p-4">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#D6DEE8] bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-black text-dark">
            {isLoadingMemories
              ? 'Loading memories...'
              : `${filteredMemories.length} of ${memories.length} memories`}
          </span>

          <span className="text-xs font-bold uppercase tracking-[0.16em] text-darkLight">
            Grouped by location
          </span>
        </div>

        {!filteredMemories.length && !isLoadingMemories && (
          <div className="rounded-2xl border border-dashed border-[#C7D2E0] bg-white p-6 text-center text-sm text-darkLight">
            {memories.length
              ? 'No memories match your search or filters.'
              : 'No memories yet. Mark a location on the globe, then add your first memory.'}
          </div>
        )}

        <div className="flex flex-col gap-6">
          {Object.entries(groupedMemories).map(([markedLocationId, locationMemories]) => {
            const location = locationsById[markedLocationId]
            const locationDetails = location ? locationDetailsById[location.id] : undefined
            const canViewOnGlobe = Boolean(location)

            return (
              <section
                key={markedLocationId}
                className="overflow-hidden rounded-3xl border border-[#CBD5E1] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
              >
                <div className="border-b border-[#D6DEE8] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 text-darkLight" size={16} />

                      <div>
                        <p className="m-0 text-sm font-black text-dark">
                          {getDisplayCountry(location, locationDetails)}
                        </p>

                        <p className="m-0 mt-0.5 text-xs font-bold uppercase tracking-[0.14em] text-darkLight">
                          {getDisplayRegion(location, locationDetails)}
                        </p>

                        <p className="m-0 mt-1 text-xs font-semibold text-darkLight">
                          {locationMemories.length}{' '}
                          {locationMemories.length === 1 ? 'memory' : 'memories'}
                        </p>
                      </div>
                    </div>

                    <button
                      className="rounded-2xl bg-dark px-4 py-2 text-xs font-black text-white transition hover:bg-darkLight disabled:cursor-not-allowed disabled:opacity-50"
                      type="button"
                      disabled={!canViewOnGlobe}
                      onClick={() => onViewOnGlobe(markedLocationId)}
                    >
                      View on globe
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-5 bg-[#F7F9FC] p-3">
                  {locationMemories.map(memory => (
                    <article
                      key={memory.id}
                      className="overflow-hidden rounded-3xl border border-[#D6DEE8] bg-white shadow-[0_4px_12px_rgba(15,23,42,0.05)]"
                    >
                      {memory.photos.length ? (
                        <MemoryPhotoCarousel
                          photos={memory.photos}
                          title={memory.title}
                          className="h-72"
                        />
                      ) : (
                        <div className="flex h-72 w-full items-center justify-center bg-light text-darkLight">
                          <ImageIcon size={36} />
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="m-0 text-xl font-black leading-tight">{memory.title}</h3>

                            <p className="m-0 mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-darkLight">
                              <CalendarDays size={14} />
                              {formatMemoryDate(memory)}
                            </p>
                          </div>

                          {memory.mood && (
                            <span className="rounded-full bg-warning/20 px-3 py-1 text-xs font-black text-dark">
                              {memory.mood}
                            </span>
                          )}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-dark">
                          {memory.description}
                        </p>

                        {!!memory.tags.length && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {memory.tags.map(tag => (
                              <span
                                key={tag}
                                className="flex items-center gap-1 rounded-full bg-mapBg px-3 py-1 text-xs font-bold"
                              >
                                <Tag size={12} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default MemoryFeed
