import { CATEGORY_ID } from '@/shared/constants/constants'
import { Place } from '@/shared/types/entityTypes'

export type MarkedLocation = {
  /** Unique id for this saved map mark. */
  id: string
  /** Existing map place id when the mark was created from a place popup. */
  placeId?: Place['id']
  /** Human-readable label for the mark. */
  headline: string
  latitude: number
  longitude: number
  /** Optional source metadata kept for the future memory flow. */
  category?: CATEGORY_ID
  population?: number
  markedAt: string
}

export type MarkLocationInput = {
  latitude: number
  longitude: number
  headline?: string
}
