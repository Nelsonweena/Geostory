import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MemoryPhoto } from '@/shared/types/memory'
import { getLocalMemoryPhotoUrl } from '@/store/useMemoriesStore'

type MemoryPhotoCarouselProps = {
  photos: MemoryPhoto[]
  title: string
  className?: string
}

type ResolvedMemoryImageProps = {
  photoUrl: string
  alt: string
}

const ResolvedMemoryImage = ({ photoUrl, alt }: ResolvedMemoryImageProps) => {
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
    return (
      <div className="flex h-full min-w-full items-center justify-center bg-light text-darkLight">
        <ImageIcon size={28} />
      </div>
    )
  }

  return (
    <img className="h-full min-w-full object-cover" src={resolvedUrl} alt={alt} draggable={false} />
  )
}

const MemoryPhotoCarousel = ({ photos, title, className = 'h-56' }: MemoryPhotoCarouselProps) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0)

  useEffect(() => {
    setActivePhotoIndex(0)
  }, [photos])

  if (!photos.length) return null

  const isFirstPhoto = activePhotoIndex === 0
  const isLastPhoto = activePhotoIndex === photos.length - 1

  const showPreviousPhoto = () => {
    if (isFirstPhoto) return

    setActivePhotoIndex(current => current - 1)
  }

  const showNextPhoto = () => {
    if (isLastPhoto) return

    setActivePhotoIndex(current => current + 1)
  }

  return (
    <div className={`relative overflow-hidden bg-dark ${className}`}>
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activePhotoIndex * 100}%)` }}
      >
        {photos.map(photo => (
          <ResolvedMemoryImage key={photo.id} photoUrl={photo.url} alt={photo.caption || title} />
        ))}
      </div>

      {photos.length > 1 && (
        <>
          {!isFirstPhoto && (
            <button
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-dark shadow-md transition hover:scale-105 hover:bg-white"
              type="button"
              onClick={showPreviousPhoto}
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {!isLastPhoto && (
            <button
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-dark shadow-md transition hover:scale-105 hover:bg-white"
              type="button"
              onClick={showNextPhoto}
              aria-label="Next photo"
            >
              <ChevronRight size={22} />
            </button>
          )}

          <div className="absolute bottom-3 right-3 rounded-full bg-dark/75 px-3 py-1 text-xs font-black text-white">
            {activePhotoIndex + 1} / {photos.length}
          </div>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                className={`h-2 rounded-full transition-all ${
                  index === activePhotoIndex ? 'w-5 bg-white' : 'w-2 bg-white/50'
                }`}
                type="button"
                onClick={() => setActivePhotoIndex(index)}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default MemoryPhotoCarousel
