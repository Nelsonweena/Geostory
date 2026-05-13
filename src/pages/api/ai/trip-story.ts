import { GoogleGenAI } from '@google/genai'
import type { NextApiRequest, NextApiResponse } from 'next'

import { MarkedLocation } from '@/shared/types/markedLocation'
import { Memory } from '@/shared/types/memory'

type TripStoryRequestBody = {
  memories?: Memory[]
  locations?: MarkedLocation[]
}

type TripStoryResponse = {
  story?: string
  error?: string
}

type SimplifiedMemory = {
  date: string
  time?: string
  title?: string
  description?: string
  mood?: string
  tags: string[]
  photoCount: number
  photoCaptions: string[]
  location: {
    name: string
    rawLocationName?: string
    country?: string
    region?: string
    latitude: number
    longitude: number
  }
}

type SimplifiedMemoryWithDateMs = SimplifiedMemory & {
  dateMs: number
}

const getMemoryDateMs = (memory: Memory) => {
  const rawDate = memory.date || memory.createdAt
  const rawTime = memory.time || '00:00'
  const date = new Date(`${rawDate}T${rawTime}`)

  if (!Number.isNaN(date.getTime())) return date.getTime()

  const fallbackDate = new Date(rawDate)
  return Number.isNaN(fallbackDate.getTime()) ? 0 : fallbackDate.getTime()
}

const buildSimplifiedMemories = (
  memories: Memory[],
  locations: MarkedLocation[],
): SimplifiedMemory[] => {
  const locationsById = locations.reduce<Record<string, MarkedLocation>>((acc, location) => {
    acc[location.id] = location
    return acc
  }, {})

  const simplifiedMemories: SimplifiedMemoryWithDateMs[] = []

  memories.forEach(memory => {
    const location = locationsById[memory.markedLocationId]

    if (!location) return

    simplifiedMemories.push({
      dateMs: getMemoryDateMs(memory),
      date: memory.date || memory.createdAt,
      time: memory.time,
      title: memory.title,
      description: memory.description,
      mood: memory.mood,
      tags: memory.tags || [],
      photoCount: memory.photos?.length || 0,
      photoCaptions: memory.photos?.map(photo => photo.caption).filter(Boolean) as string[],
      location: {
        name: location.country || location.region || location.headline,
        rawLocationName: location.headline,
        country: location.country,
        region: location.region,
        latitude: location.latitude,
        longitude: location.longitude,
      },
    })
  })

  return simplifiedMemories
    .sort((first, second) => first.dateMs - second.dateMs)
    .map(({ dateMs, ...memory }) => memory)
    .slice(0, 80)
}

const handler = async (req: NextApiRequest, res: NextApiResponse<TripStoryResponse>) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' })
    return
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY in .env.local.' })
    return
  }

  const { memories = [], locations = [] } = req.body as TripStoryRequestBody

  if (!memories.length || !locations.length) {
    res.status(400).json({ error: 'Add memories and locations before generating a trip story.' })
    return
  }

  const simplifiedMemories = buildSimplifiedMemories(memories, locations)

  if (!simplifiedMemories.length) {
    res.status(400).json({ error: 'No memories could be matched to visible locations.' })
    return
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    })

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_TRIP_STORY_MODEL || 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                'You are writing a cinematic travel story for a memory globe app.',
                'The user wants the story to feel like a beautiful visual route summary, not a database report.',
                '',
                'Use the provided chronological memories and locations as your source.',
                'You may lightly infer the country or region from coordinates when the location name is generic, but do not pretend certainty about specific landmarks unless they are provided.',
                'Do not mention raw coordinates in the final answer.',
                'Do not say "Marked location".',
                'Do not write like a database report.',
                'Do not mention tags unless they naturally help the story.',
                'Do not mention photo counts unless it sounds natural.',
                '',
                'IMPORTANT OUTPUT FORMAT:',
                'Return the story as plain text using this exact section format:',
                '',
                ':::country',
                'HEADER: COUNTRY OR PLACE NAME IN UPPERCASE',
                'BODY: 2 to 4 warm, cinematic sentences about this part of the journey.',
                ':::',
                '',
                'Repeat that block for each major country/place in the journey.',
                '',
                'After all country sections, add one final block:',
                '',
                ':::closing',
                'BODY: One short reflective closing sentence.',
                ':::',
                '',
                'Do not use Markdown headings.',
                'Do not use bullet points.',
                'Do not wrap the response in JSON.',
                'Do not add text outside these blocks.',
                '',
                'Writing style:',
                'Use phrases like "your journey began", "from there", "then the route carried you", and "the story continued".',
                'Add a little imagination and atmosphere, but keep it believable and connected to the memory titles, descriptions, captions, dates, and locations.',
                '',
                'Example:',
                ':::country',
                'HEADER: ALGERIA',
                'BODY: Your journey began beneath the wide North African sky, where the first memory set the route in motion. This opening stop feels quiet and full of possibility, like the first page of a much larger story.',
                ':::',
                '',
                ':::country',
                'HEADER: MONGOLIA',
                'BODY: From there, the route stretched eastward into open landscapes and distant horizons. The memory here gives this stop a sense of movement, distance, and discovery.',
                ':::',
                '',
                ':::closing',
                'BODY: Together, these places turn your map into a living story of motion, memory, and discovery.',
                ':::',
                '',
                'Now create the user’s trip story from these chronological memories:',
                JSON.stringify(simplifiedMemories, null, 2),
              ].join('\n'),
            },
          ],
        },
      ],
    })

    const story = response.text?.trim()

    if (!story) {
      res.status(500).json({ error: 'Gemini did not return a trip story.' })
      return
    }

    res.status(200).json({ story })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate a trip story.'
    res.status(500).json({ error: message })
  }
}

export default handler
