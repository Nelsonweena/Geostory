import { Memory } from '@/shared/types/memory'

export const mockMemories: Memory[] = [
  {
    id: 'singapore-2024',
    userId: 'demo-user',
    markedLocationId: 'demo-singapore',
    title: 'Singapore Memory',
    description: 'A meaningful place from my journey.',
    date: '2024-01-01',
    mood: 'home',
    photos: [],
    tags: ['home', 'memory'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'tokyo-2024',
    userId: 'demo-user',
    markedLocationId: 'demo-tokyo',
    title: 'Tokyo Night',
    description: 'First night exploring Tokyo.',
    date: '2024-06-12',
    mood: 'adventure',
    photos: [],
    tags: ['travel', 'adventure'],
    createdAt: '2024-06-12T00:00:00.000Z',
    updatedAt: '2024-06-12T00:00:00.000Z',
  },
]
