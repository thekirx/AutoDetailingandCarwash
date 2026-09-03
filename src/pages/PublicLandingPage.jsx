import { useEffect, useState } from 'react'

import BdHero from '../components/public/bredesign/BdHero'
import { BdBranches, BdEvents } from '../components/public/bredesign/BdEventsBranches'
import {
  BdBook,
  BdOrigin,
  BdPhotos,
  BdServices,
  BdWhySections,
} from '../components/public/bredesign/BdSections'
import useReveal from '../components/public/bredesign/useReveal'
import { usePublicBranches, branchCityName } from '../lib/branches'
import { loadHomepageContent } from '../lib/homepageContent'
import { supabase } from '../lib/supabase'

const INITIAL_CONTENT = {
  post: { status: 'loading', item: null, error: null },
  event: { status: 'loading', item: null, error: null },
}

export default function PublicLandingPage() {
  /* Visible = active plus coming soon. The branches section deliberately shows
     a branch that has not opened yet, badged as such, so a customer in that city
     knows it is coming rather than concluding we are not there. */
  const { branches: visibleBranches } = usePublicBranches({ mode: 'visible' })
  const [content, setContent] = useState(INITIAL_CONTENT)
  const locationLine = visibleBranches.length
    ? visibleBranches.map((branch) => branchCityName(branch)).join(' / ')
    : 'Dasmariñas / Bacoor / Batangas'

  useEffect(() => {
    let active = true
    loadHomepageContent(supabase)
      .then((nextContent) => {
        if (active) setContent(nextContent)
      })
      .catch((error) => {
        if (!active) return
        setContent({
          post: { status: 'error', item: null, error },
          event: { status: 'error', item: null, error },
        })
      })
    return () => { active = false }
  }, [])

  useReveal()

  return (
    <>
      <BdHero locationLine={locationLine} />
      <BdOrigin />
      <BdServices />
      <BdWhySections />
      <BdPhotos />
      <BdEvents state={content.event} />
      <BdBranches branches={visibleBranches} />
      <BdBook />
    </>
  )
}
