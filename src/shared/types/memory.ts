import { MarkedLocation } from '@/shared/types/markedLocation'

export type MemoryPhoto = {
  id: string
  url: string
  caption?: string
  uploadedAt: string
}

export type Memory = {
  id: string
  userId: string
  markedLocationId: MarkedLocation['id']
  title: string
  description: string
  date?: string
  time?: string
  mood?: string
  photos: MemoryPhoto[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type MemoryInput = {
  title: string
  description: string
  date?: string
  time?: string
  mood?: string
  photos?: MemoryPhoto[]
  tags?: string[]
}
