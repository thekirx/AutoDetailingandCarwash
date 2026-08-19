import { useEffect, useState } from 'react'

import BeforeAfterSection from '../components/public/home/BeforeAfterSection'
import EventsPreviewSection from '../components/public/home/EventsPreviewSection'
import HomeEndingSections from '../components/public/home/HomeEndingSections'
import HomeHeroSection from '../components/public/home/HomeHeroSection'
import {
  CeramicSection,
  MediaGallerySection,
  NanoCeramicTintSection,
  PpfInformationSection,
} from '../components/public/home/HomeServiceSections'
import LatestPostSection from '../components/public/home/LatestPostSection'
import PartnershipSection from '../components/public/home/PartnershipSection'
import PpfPackagesSection from '../components/public/home/PpfPackagesSection'
import { usePublicBranches } from '../lib/branches'
import { loadHomepageContent } from '../lib/homepageContent'
import { supabase } from '../lib/supabase'

const INITIAL_CONTENT = {
  post: { status: 'loading', item: null, error: null },
  event: { status: 'loading', item: null, error: null },
}

export default function PublicLandingPage() {
  const { branches } = usePublicBranches()
  const [content, setContent] = useState(INITIAL_CONTENT)
  const locationLine = branches.length
    ? branches.map((branch) => branch.name.replace('Hakum Auto Care ', '')).join(' / ')
    : 'Bacoor / Batangas'

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

  return (
    <>
      <HomeHeroSection locationLine={locationLine} branches={branches} />
      <CeramicSection />
      <PpfInformationSection />
      <PpfPackagesSection />
      <NanoCeramicTintSection />
      <BeforeAfterSection />
      <MediaGallerySection />
      <LatestPostSection state={content.post} />
      <EventsPreviewSection state={content.event} />
      <PartnershipSection />
      <HomeEndingSections branches={branches} />
    </>
  )
}
