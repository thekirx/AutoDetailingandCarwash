import { useRef } from 'react'

export function usePinnedCarStory() {
  const storyRef = useRef(null)

  return { storyRef }
}
