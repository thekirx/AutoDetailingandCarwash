import { BRANCH_MAP_LISTINGS, branchDirections, branchPhone, MAIN_LINE } from './homeBranches.js'
import { branchDistanceKm } from './branchGeo.js'

const PRODUCTION_ORIGIN = 'https://www.hakumautocare.com'

export const BRAND_POSITIONING =
  'Hakum Auto Care is one of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines.'

export const QUICK_CITY_ORIGINS = [
  { id: 'bacoor', label: 'Bacoor', lat: 14.4453, lng: 120.9617, targetSlug: 'bacoor' },
  { id: 'imus', label: 'Imus', lat: 14.4296, lng: 120.9367, targetSlug: 'imus' },
  { id: 'cavite', label: 'Cavite / Dasmariñas', lat: 14.3294, lng: 120.9367, targetSlug: 'cavite' },
  { id: 'batangas', label: 'Batangas City', lat: 13.7565, lng: 121.0583, targetSlug: 'batangas' },
]

export const LOCAL_BRANCH_PAGES = [
  {
    slug: 'bacoor',
    branchSlug: 'bacoor',
    isOpen: true,
    cityName: 'Bacoor, Cavite',
    shortName: 'Bacoor',
    eyebrow: 'Flagship Studio · Bacoor, Cavite',
    h1: 'Car Wash, Auto Detailing & PPF in Bacoor, Cavite.',
    seoTitle: 'Best Car Wash, Auto Detailing, Ceramic Coating & PPF in Bacoor, Cavite',
    seoDescription:
      'Hakum Auto Care Bacoor (RFC Molino II, Molino Blvd) delivers swirling-free pH-neutral car wash, interior detailing, paint correction, Kisho ceramic coating, ClearPro PPF, and nano ceramic tint.',
    heroSummary:
      'Located at RFC Molino II along Molino Boulevard, Hakum Auto Care Bacoor is our flagship Cavite studio — trusted for pH-neutral two-bucket car washes, multi-stage paint correction, Kisho 9H ceramic coating, ClearPro TPU PPF, and live digital queue tracking.',
    landmarkAddress: 'RFC Molino II, Molino Boulevard, Bacoor, Cavite',
    phone: BRANCH_PHONES_SAFE('bacoor'),
    corridors: ['Molino', 'Bacoor', 'Zapote', 'Las Piñas', 'Alabang', 'Daang Hari', 'Vermosa', 'Imus'],
    highlights: [
      'Two-bucket pH-neutral contact wash with grit guards and dedicated paint/wheel microfiber mitts.',
      'Enclosed, lighting-calibrated detailing and curing bay built for Kisho 9H ceramic coating and ClearPro PPF.',
      'Live online queue counter before you leave home plus instant WhatsApp/SMS/push ready alerts.',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-bacoor',
    qa: [
      {
        q: 'Where is Hakum Auto Care Bacoor located?',
        a: 'Hakum Auto Care Bacoor operates at RFC Molino II along Molino Boulevard, Bacoor, Cavite — with direct parking, live queue visibility on hakumautocare.com/queue/bacoor, and direct access from Daang Hari and Aguinaldo Highway.',
      },
      {
        q: 'Can I walk in or book Ceramic Coating and PPF in Bacoor?',
        a: 'Yes. Routine pH-neutral car wash and express interior cleanups support live queue walk-ins, while multi-stage paint correction, Kisho Ceramic Coating, ClearPro PPF, and Nano Ceramic Window Tint can be reserved online at hakumautocare.com/book.',
      },
    ],
  },
  {
    slug: 'batangas',
    branchSlug: 'batangas',
    isOpen: true,
    cityName: 'Batangas City',
    shortName: 'Batangas City',
    eyebrow: 'Southern Luzon Flagship · Batangas City',
    h1: 'Trusted Car Wash, Auto Detailing & Ceramic Coating in Batangas City.',
    seoTitle: 'Best Car Wash, Auto Detailing, Ceramic Coating & PPF in Batangas City',
    seoDescription:
      'Hakum Auto Care Batangas City (National Highway, Brgy. Alangilan) brings Philippine flagship car wash, deep interior detailing, paint correction, ceramic coating, and PPF near STAR Tollway.',
    heroSummary:
      'Positioned along the National Highway in Brgy. Alangilan, Hakum Auto Care Batangas City serves Batangas motorists with the exact same studio standards, detailing chemistry, and live queue transparency as our Cavite flagship.',
    landmarkAddress: 'National Highway, Brgy. Alangilan, Batangas City, Batangas',
    phone: BRANCH_PHONES_SAFE('batangas'),
    corridors: ['Brgy. Alangilan', 'Batangas City Proper', 'Pallocan', 'Balagtas', 'Lipa City', 'Bauan', 'STAR Tollway'],
    highlights: [
      'Convenient National Highway Alangilan stop for Batangas City, Lipa, Bauan, and San Pascual drivers.',
      'UV-resistant ceramic coating and hydrophobic rain protection tailored for provincial highways and coastal humidity.',
      'Real-time queue status and service progress tracking directly in your customer portal or SMS alerts.',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-batangas-city',
    qa: [
      {
        q: 'Where in Batangas City is Hakum Auto Care?',
        a: 'Our Batangas City studio is along the National Highway in Barangay Alangilan, easily reachable from Balagtas exit, STAR Tollway, and Pallocan.',
      },
      {
        q: 'How do I check waiting cars in Hakum Batangas before visiting?',
        a: 'Open the live Batangas queue page at hakumautocare.com/queue/batangas or tap "Book slot" to reserve a bay.',
      },
    ],
  },
  {
    slug: 'imus',
    branchSlug: 'bacoor',
    isOpen: false,
    cityName: 'Imus, Cavite',
    shortName: 'Imus',
    eyebrow: 'Imus Expansion + Nearby Bacoor Flagship',
    h1: 'Car Wash & Auto Detailing Near Imus, Cavite.',
    seoTitle: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Near Imus, Cavite',
    seoDescription:
      'Searching for a trusted car wash, detailing, or ceramic coating studio near Imus, Cavite? Imus drivers are minutes away from Hakum Auto Care Bacoor while our dedicated Imus location prepares to open.',
    heroSummary:
      'Imus is part of Hakum Auto Care’s Cavite growth roadmap alongside Dasmariñas. Today, Imus vehicle owners from Bucandala, Buhay na Tubig, Tanzang Luma, and Vermosa reach our Bacoor flagship at RFC Molino II in minutes via Aguinaldo Highway or Daang Hari.',
    landmarkAddress: 'Upcoming Imus, Cavite Studio · Nearest open bays: RFC Molino II, Bacoor',
    phone: MAIN_LINE,
    corridors: ['Imus Proper', 'Buhay na Tubig', 'Bucandala', 'Tanzang Luma', 'Aguinaldo Highway', 'Vermosa', 'Open Canal'],
    highlights: [
      'Only a short drive from Imus via Buhay na Tubig / Daang Hari / Molino Boulevard to our open Bacoor studio.',
      'Full suite of pH-neutral car wash, deep interior sanitization, Kisho ceramic coating, and ClearPro PPF.',
      'Dedicated Imus branch in development — reserve online at Bacoor today with live queue visibility.',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-imus',
    qa: [
      {
        q: 'Does Hakum Auto Care serve Imus, Cavite right now?',
        a: 'Yes. While a dedicated Imus branch is under development, Imus customers are minutes from our open Bacoor flagship at RFC Molino II via Buhay na Tubig or Daang Hari — check live queue wait times online before heading over.',
      },
      {
        q: 'Can I book Ceramic Coating or PPF near Imus without waiting in line?',
        a: 'Yes — select the Bacoor branch at hakumautocare.com/book to lock in a dedicated detailing bay for your vehicle.',
      },
    ],
  },
  {
    slug: 'cavite',
    branchSlug: 'bacoor',
    isOpen: true,
    cityName: 'Cavite',
    shortName: 'Cavite',
    eyebrow: 'Provincial Hub · Cavite',
    h1: 'Fastest-Growing Car Wash, Detailing & Paint Protection in Cavite.',
    seoTitle: 'Best Auto Detailing, Ceramic Coating, PPF & Car Wash in Cavite',
    seoDescription:
      'Hakum Auto Care is Cavite’s trusted automotive detailing, ClearPro PPF, ceramic coating, and pH-neutral car wash studio — open in Bacoor (Molino) with Imus and Dasmariñas expanding.',
    heroSummary:
      'Across Cavite — from Bacoor and Molino to Imus, Vermosa, and Dasmariñas — Hakum Auto Care delivers studio-calibrated paint correction, ClearPro TPU PPF, Kisho 9H ceramic coating, and swirl-free daily washes backed by a live queue system.',
    landmarkAddress: 'Bacoor Flagship (RFC Molino II) + Imus & Dasmariñas Expansion',
    phone: BRANCH_PHONES_SAFE('bacoor'),
    corridors: ['Bacoor', 'Molino', 'Imus', 'Dasmariñas', 'Vermosa', 'Kawit', 'General Trias', 'CALAX / MCX'],
    highlights: [
      'Open Cavite flagship at RFC Molino II, Bacoor — serving northern and central Cavite daily.',
      'Upcoming Dasmariñas and Imus sites under active rollout as one of the fastest-growing Philippine detailing brands.',
      'Swirl-safe chemistry, iron decontamination, gloss enhancement, ClearPro PPF, and nano ceramic tint under one roof.',
    ],
    relatedGuideSlug: 'best-auto-detailing-ceramic-coating-ppf-cavite',
    qa: [
      {
        q: 'Which Hakum Auto Care branch is closest if I am anywhere in Cavite?',
        a: 'Our open Cavite flagship is Hakum Auto Care Bacoor (RFC Molino II, Molino Blvd), serving Bacoor, Imus, Molino, Dasmariñas, Kawit, and Las Piñas/Alabang commuters while Imus and Dasmariñas branches roll out.',
      },
      {
        q: 'Why choose a detailing studio instead of an ordinary roadside car wash in Cavite?',
        a: 'Hakum uses two-bucket grit-guard pH-neutral washing, clean microfiber per zone, enclosed coating bays, and trained detailers so daily washes preserve gloss instead of adding swirl marks.',
      },
    ],
  },
]

function BRANCH_PHONES_SAFE(slug) {
  return branchPhone(slug) || MAIN_LINE
}

export function findLocalBranchPage(citySlug) {
  const clean = String(citySlug || '').trim().toLowerCase()
  return LOCAL_BRANCH_PAGES.find((page) => page.slug === clean) || null
}

/** Rank open branches by distance from coords or city origin. */
export function rankOpenBranchesForOrigin(originCoords, branches = []) {
  const openBranches = (branches || []).filter((b) => !b.coming_soon && b.is_active !== false)
  const effective = openBranches.length
    ? openBranches
    : [
        { slug: 'bacoor', name: 'Bacoor', address: 'RFC Molino', latitude: BRANCH_MAP_LISTINGS.bacoor.lat, longitude: BRANCH_MAP_LISTINGS.bacoor.lng },
        { slug: 'batangas', name: 'Batangas', address: 'PNP Batangas', latitude: BRANCH_MAP_LISTINGS.batangas.lat, longitude: BRANCH_MAP_LISTINGS.batangas.lng },
      ]

  return effective
    .map((branch) => {
      const listing = BRANCH_MAP_LISTINGS[branch.slug]
      const enriched = {
        ...branch,
        latitude: Number.isFinite(Number(branch.latitude)) ? Number(branch.latitude) : listing?.lat,
        longitude: Number.isFinite(Number(branch.longitude)) ? Number(branch.longitude) : listing?.lng,
      }
      const distanceKm = originCoords ? branchDistanceKm(originCoords, enriched) : null
      return {
        branch: enriched,
        distanceKm,
        directions: branchDirections(enriched),
        phone: branchPhone(branch.slug) || MAIN_LINE,
      }
    })
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })
}

export function buildBranchCityJsonLd(cityPage, { hours = [], origin = PRODUCTION_ORIGIN } = {}) {
  if (!cityPage) return null
  const base = String(origin || PRODUCTION_ORIGIN).replace(/\/$/, '')
  const mapInfo = BRANCH_MAP_LISTINGS[cityPage.branchSlug]
  const pageUrl = `${base}/branches/${cityPage.slug}`
  const hasMap = mapInfo?.cid ? `https://www.google.com/maps?cid=${mapInfo.cid}` : undefined

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AutomotiveBusiness',
        additionalType: 'https://schema.org/AutoWash',
        '@id': `${pageUrl}#studio`,
        name: `Hakum Auto Care — ${cityPage.cityName}`,
        description: cityPage.seoDescription,
        url: pageUrl,
        telephone: cityPage.phone?.href?.replace(/^tel:/, '') || '+639156296096',
        image: `${base}/og-image.png`,
        areaServed: cityPage.corridors,
        address: {
          '@type': 'PostalAddress',
          addressLocality: cityPage.shortName,
          addressRegion: cityPage.slug === 'batangas' ? 'Batangas' : 'Cavite',
          addressCountry: 'PH',
          streetAddress: cityPage.landmarkAddress,
        },
        ...(hasMap ? { hasMap } : {}),
        ...(mapInfo?.lat != null && mapInfo?.lng != null
          ? { geo: { '@type': 'GeoCoordinates', latitude: mapInfo.lat, longitude: mapInfo.lng } }
          : {}),
        ...(Array.isArray(hours) && hours.length ? { openingHoursSpecification: hours } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Branches', item: `${base}/branches` },
          { '@type': 'ListItem', position: 3, name: cityPage.cityName, item: pageUrl },
        ],
      },
    ],
  }
}
