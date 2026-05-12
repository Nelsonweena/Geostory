import { useCallback } from 'react'
import { spacing } from 'tailwindcss/defaultTheme'

import { theme } from '@/root/tailwind.config'

const useAppTheme = () => {
  const color = useCallback((key: keyof typeof theme.colors) => theme.colors[key], [])

  const space = useCallback((t: number) => {
    const number = `${t}` as keyof typeof spacing
    return spacing[number]
  }, [])

  return { space, color }
}

export default useAppTheme
