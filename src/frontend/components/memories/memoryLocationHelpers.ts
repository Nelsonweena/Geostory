import { MarkedLocation } from '@/shared/types/markedLocation'

export type LocationDetails = {
  country: string
  region: string
}

const getHeadlineParts = (location?: MarkedLocation) =>
  location?.headline
    .split(',')
    .map(part => part.trim())
    .filter(Boolean) || []

export const getLocationCountry = (location?: MarkedLocation, details?: LocationDetails) => {
  if (details?.country) return details.country
  if (location?.country) return location.country

  const headlineParts = getHeadlineParts(location)

  return headlineParts.length > 1 ? headlineParts.at(-1) || '' : ''
}

export const getLocationRegion = (location?: MarkedLocation, details?: LocationDetails) => {
  if (details?.region) return details.region
  if (location?.region) return location.region

  const headlineParts = getHeadlineParts(location)

  if (headlineParts.length >= 3) return headlineParts.at(-2) || ''
  if (headlineParts.length === 2) return headlineParts.at(0) || ''

  return ''
}

export const getDisplayCountry = (location?: MarkedLocation, details?: LocationDetails) =>
  getLocationCountry(location, details) || 'Unknown country'

export const getDisplayRegion = (location?: MarkedLocation, details?: LocationDetails) =>
  getLocationRegion(location, details) || 'Unknown region'
