import { CATEGORY_ID } from '@/shared/constants/constants'
import { Place } from '@/shared/types/entityTypes'

export type MarkedLocation = {
  id: string
  userId: string
  placeId?: Place['id']
  headline: string
  country?: string
  region?: string
  latitude: number
  longitude: number
  category?: CATEGORY_ID
  population?: number
  markedAt: string
}

export type MarkLocationInput = {
  latitude: number
  longitude: number
  headline?: string
  country?: string
  region?: string
}
