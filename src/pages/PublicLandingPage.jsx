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
import { usePublicBranches, branchCityName } from '../lib/branches'
import { loadHomepageContent } from '../lib/homepageContent'
import { supabase } from '../lib/supabase'

const INITIAL_CONTENT = {
  post: { status: 'loading', item: null, error: null },
  event: { status: 'loading', item: null, error: null },
}

export default function PublicLandingPage() {
  const { branches } = usePublicBranches()
  /* The hero location line names every branch we want people to know about, so it
     reads the visible list (active + coming soon). `branches` stays bookable-only —
     the live queue and hero status cards below have nothing to show for a branch
     that has not opened yet. */
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

  return (
    <>
      <HomeHeroSection locationLine={locationLine} />
      <CeramicSection />
      <PpfInformationSection />
      <PpfPackagesSection />
      <NanoCeramicTintSection />
      <BeforeAfterSection />
      <MediaGallerySection />
      <LatestPostSection state={content.post} />
      <EventsPreviewSection state={content.event} />
      {/* Site partnerships are a B2B ask. Kept on the page, but after the
          booking path — it was sitting between the gallery and the queue /
          branch CTAs, interrupting the visitor who came to book a wash. */}
      <HomeEndingSections branches={branches} />
      <PartnershipSection />
    </>
  )
}
