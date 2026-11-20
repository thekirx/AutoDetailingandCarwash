import { BRANCH_MAP_LISTINGS, branchDirections, branchPhone, MAIN_LINE } from './homeBranches.js'
import { branchDistanceKm } from './branchGeo.js'

const PRODUCTION_ORIGIN = 'https://www.hakumautocare.com'

export const BRAND_POSITIONING =
  'Hakum Auto Care is one of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines.'

export const QUICK_CITY_ORIGINS = [
  { id: 'bacoor', label: 'Bacoor', lat: 14.4453, lng: 120.9617, targetSlug: 'bacoor' },
  { id: 'imus', label: 'Imus', lat: 14.4296, lng: 120.9367, targetSlug: 'imus' },
  { id: 'dasmarinas', label: 'Dasmariñas', lat: 14.3294, lng: 120.9367, targetSlug: 'dasmarinas' },
  { id: 'cavite', label: 'Cavite', lat: 14.38, lng: 120.94, targetSlug: 'cavite' },
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
  {
    slug: 'dasmarinas',
    branchSlug: 'bacoor',
    isOpen: false,
    cityName: 'Dasmariñas, Cavite',
    shortName: 'Dasmariñas',
    eyebrow: 'Dasmariñas Expansion + Nearby Bacoor Flagship',
    h1: 'Car Wash, Ceramic Coating & PPF Near Dasmariñas, Cavite.',
    seoTitle: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Near Dasmariñas, Cavite',
    seoDescription:
      'Looking for a trusted car wash, ceramic coating, or ClearPro PPF studio near Dasmariñas, Cavite? Reach Hakum Auto Care Bacoor via Aguinaldo Highway or Daang Hari while our Dasmariñas branch prepares to launch.',
    heroSummary:
      'Dasmariñas is part of Hakum Auto Care’s Cavite expansion alongside Imus. Today, vehicle owners from Pala-Pala, Salitran, Salawag, Paliparan, and DLSU-D drive minutes north via Daang Hari or Aguinaldo Highway to our open Bacoor flagship at RFC Molino II.',
    landmarkAddress: 'Upcoming Dasmariñas, Cavite Studio · Nearest open bays: RFC Molino II, Bacoor',
    phone: MAIN_LINE,
    corridors: ['Pala-Pala', 'Salitran', 'Salawag', 'Paliparan', 'Aguinaldo Highway', 'Governor’s Drive', 'CALAX', 'Daang Hari'],
    highlights: [
      'Direct Daang Hari & Molino-Paliparan access from Salawag, Salitran, and Pala-Pala to our open Bacoor bays.',
      'Full pH-neutral car wash, interior deep cleaning, Kisho 9H ceramic coating, ClearPro PPF, and ceramic tint.',
      'Dedicated Dasmariñas studio in expansion rollout — book Bacoor online today with live queue visibility.',
    ],
    relatedGuideSlug: 'best-car-wash-detailing-dasmarinas',
    qa: [
      {
        q: 'Where is the closest Hakum Auto Care studio from Dasmariñas, Cavite?',
        a: 'Our open Cavite flagship at RFC Molino II along Molino Boulevard, Bacoor is a straight drive via Salawag–Molino Road, Daang Hari, or Aguinaldo Highway. Check live bay queue counts at hakumautocare.com/queue/bacoor before heading out.',
      },
      {
        q: 'Can Dasmariñas owners book Ceramic Coating or ClearPro PPF online?',
        a: 'Yes. Select our Bacoor studio on hakumautocare.com/book to reserve enclosed curing bays for Kisho 9H Ceramic Coating, ClearPro PPF, or Nano Ceramic Window Tint.',
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
      ...(Array.isArray(cityPage.qa) && cityPage.qa.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${pageUrl}#faq`,
              mainEntity: cityPage.qa.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ]
        : []),
    ],
  }
}

export const LOCAL_SERVICE_PILLARS = [
  {
    slug: 'car-wash',
    label: 'Car Wash & Detailing',
    shortLabel: 'Car Wash',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    startingKey: 'wash',
    actionLabel: 'Check live wash queue',
  },
  {
    slug: 'ceramic-coating',
    label: 'Ceramic Coating',
    shortLabel: 'Ceramic Coating',
    mode: 'book',
    serviceDetailRoute: '/services/ceramic',
    startingKey: 'ceramic',
    actionLabel: 'Book ceramic coating',
  },
  {
    slug: 'ppf',
    label: 'Paint Protection Film (PPF)',
    shortLabel: 'ClearPro PPF',
    mode: 'book',
    serviceDetailRoute: '/services/ppf',
    startingKey: 'ppf',
    actionLabel: 'Book ClearPro PPF',
  },
  {
    slug: 'window-tint',
    label: 'Nano Ceramic Window Tint',
    shortLabel: 'Window Tint',
    mode: 'book',
    serviceDetailRoute: '/services/tint',
    startingKey: 'tint',
    actionLabel: 'Book ceramic tint',
  },
]

const BRANCH_SERVICE_REVIEWS = {
  bacoor: [
    {
      name: 'Marryel Joan Macaraig',
      quote: 'I am a repeat customer and have my cars cleaned here. The cars always look brand new and smells nice after having them washed and waxed.',
      href: 'https://share.google/lpF0zmw4zeU7E7liX',
    },
    {
      name: 'Benedict Carl',
      quote: 'Availed the Basic package with Machine buffing, I could say that I’m satisfied with the services. Will definitely visit again.',
      href: 'https://share.google/apvEs8l2d3i7Lwz3I',
    },
    {
      name: 'Ailyn De Leon',
      quote: 'Clean, fast, and smells good. Keep it up! We’ll be back.',
      href: 'https://share.google/0rpL372H6dsN3wtia',
    },
  ],
  batangas: [
    {
      name: 'Paul Russel Sandoval',
      quote: 'Hands down one of the best carwash services around Batangas City! Hakum did a fast, thorough, and flawless job. Friendly staff and great value.',
      href: 'https://share.google/2YwjrE1QVXO2sYasP',
    },
    {
      name: 'Krisha May Aguila',
      quote: 'Excellent Carwash is comparable to other well-known car wash companies.',
      href: 'https://share.google/t7gyi8hUV0cqYSqvj',
    },
  ],
}

export const LOCAL_BRANCH_SERVICE_PAGES = [
  // ── BACOOR, CAVITE ────────────────────────────────────────────────────────
  {
    citySlug: 'bacoor',
    serviceSlug: 'car-wash',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Car Wash & Auto Detailing',
    serviceTypeSchema: 'AutoWash',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    eyebrow: 'Bacoor Car Wash Studio · RFC Molino II',
    h1: 'Swirl-Free Car Wash & Auto Detailing in Bacoor, Cavite.',
    seoTitle: 'Best Car Wash in Bacoor, Cavite (RFC Molino) — Two-Bucket pH-Neutral Studio',
    seoDescription:
      'Searching for the best car wash near me in Bacoor? Hakum Auto Care RFC Molino II runs two-bucket pH-neutral washes, interior deep cleaning, and live bay queue tracking.',
    heroSummary:
      'Built for daily commuters along Molino Boulevard, Daang Hari, and Aguinaldo Highway: our Bacoor bays pair snow-foam pre-wash, two-bucket grit-guard washing, dedicated wheel mitts, and live online queue tracking so your clear coat stays swirl-free.',
    processSteps: [
      'Cool-panel wheel decontamination and snow-foam pre-soak to lift Molino & highway dust safely.',
      'Two-bucket pH-neutral hand wash using separate microfiber mitts for upper paint and lower rockers.',
      'Blower + plush microfiber drying, glass degreasing, interior vacuuming, and clean satin tire finish.',
      'Final supervisor bay walk-through and SMS/app notification as soon as your car is ready.',
    ],
    localHighlights: [
      'Located right at RFC Molino II along Molino Boulevard — quick access from Vermosa, Daang Hari, Imus, and Zapote.',
      'Real-time queue counter (/queue/bacoor) shows active cars and bays before you leave your driveway.',
      'Coating-safe & PPF-safe pH-neutral shampoo formulas — never harsh dish soap or caustic tire degreasers.',
    ],
    qa: [
      {
        q: 'Where can I get a swirl-free car wash near me in Bacoor?',
        a: 'Hakum Auto Care Bacoor at RFC Molino II (Molino Boulevard) uses two-bucket pH-neutral snow foam, separate wheel/paint tools, and plush microfiber drying to prevent clear-coat swirl marks.',
      },
      {
        q: 'Can I check the Bacoor car wash queue online before going?',
        a: 'Yes — open hakumautocare.com/queue/bacoor anytime to see active waiting and in-bay vehicle counts at RFC Molino II in real time.',
      },
      {
        q: 'Do you clean interiors, leather seats, and odor issues in Bacoor?',
        a: 'Yes. Beyond our signature wash, our Bacoor studio offers Deep Interior Detailing, Seat Extraction, Leather Conditioning, Engine Wash, Watermark Removal, and Bactozero cabin sanitization.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'ceramic-coating',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Ceramic Coating (Kisho 9H)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ceramic',
    eyebrow: 'Bacoor Ceramic Coating Studio · Kisho 9H Japan',
    h1: 'Ceramic Coating in Bacoor, Cavite — Calibrated Kisho 9H Protection.',
    seoTitle: 'Ceramic Coating in Bacoor, Cavite Near Me — Kisho 9H Studio',
    seoDescription:
      'Protect your car paint with genuine Kisho 9H ceramic coating in Bacoor, Cavite. Multi-stage Rupes paint correction, enclosed curing bays, and free Unlimited Recoating support.',
    heroSummary:
      'True ceramic coating is 80% preparation. At Hakum Bacoor (RFC Molino II), every Ceramic package includes iron & clay decontamination, Rupes + Menzerna machine paint correction, IPA panel wipe, and authentic Japanese Kisho coating cured indoors.',
    processSteps: [
      'Paint depth inspection with a digital micron gauge + full chemical & clay bar decontamination.',
      'Multi-stage machine polishing using Rupes orbital systems to restore mirror clarity before locking paint in.',
      'Controlled enclosed application of Kisho ceramic layers across paintwork, glass, and trim.',
      'Scheduled 6-month Paint Maintenance checkups tracked automatically per plate in your Hakum portal.',
    ],
    localHighlights: [
      'Includes Unlimited Ceramic Coating Reboost support on eligible Premium & Platinum packages.',
      'Engineered to shield paint from Cavite traffic soot, tree sap, bird droppings, and hard-water spots.',
      'Serves Bacoor, Molino, Imus, Dasmariñas, Las Piñas, and Alabang car owners without driving to Makati/QC.',
    ],
    qa: [
      {
        q: 'How much does Ceramic Coating cost near Bacoor, Cavite?',
        a: 'Pricing depends on vehicle size (Small, Medium, Large, XL) and package tier (Lite, Premium, Platinum). Reserve a slot or inspect your paint with our Bacoor team via hakumautocare.com/book?branch=bacoor.',
      },
      {
        q: 'Does Hakum Bacoor polish out swirls before applying ceramic coating?',
        a: 'Yes. Our certified Bacoor detailers perform decontamination and machine paint correction first so swirl marks are refined rather than sealed underneath the ceramic layer.',
      },
      {
        q: 'What makes Hakum’s Bacoor Ceramic Coating stand out?',
        a: 'Authentic Kisho Japan chemistry applied inside enclosed lighting-calibrated bays, backed by documented 6-month maintenance scheduling and Unlimited Recoating on Premium/Platinum tiers.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'ppf',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Paint Protection Film (ClearPro PPF)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ppf',
    eyebrow: 'Bacoor ClearPro PPF Studio · Official Distributor',
    h1: 'Paint Protection Film (PPF) in Bacoor, Cavite — Official ClearPro TPU.',
    seoTitle: 'PPF Bacoor Near Me — ClearPro Self-Healing Paint Protection Film Bacoor, Cavite',
    seoDescription:
      'Looking for PPF near me in Bacoor, Cavite? Hakum Auto Care RFC Molino II installs genuine ClearPro self-healing optical TPU Paint Protection Film with a 10-year manufacturer warranty.',
    heroSummary:
      'Highway gravel on MCX, Daang Hari, and SLEX chips unprotected clear coat fast. Our enclosed Bacoor studio wraps daily SUVs, sports cars, and luxury crossovers in genuine ClearPro optical TPU film with wrapped edges and a 10-year warranty.',
    processSteps: [
      'Precision wash, clay decontamination, and paint prep inside our dust-managed Bacoor installation bay.',
      'Custom plotter patterns + meticulous edge-tucking using ClearPro optical-grade Polyoptico TPU.',
      'Steam-set alignment and Invisiglue adhesive inspection for near-invisible 95 GU gloss blend.',
      'Full 10-year warranty registration against yellowing, bubbling, peeling, or cracking.',
    ],
    localHighlights: [
      'Official ClearPro Philippines distributor — genuine rolls, never rebranded PVC or short-life hybrids.',
      'Self-healing top coat erases light wash swirls under Philippine sunlight or warm water.',
      'Available in High-Gloss Invisible, Matte/Satin (UltraSatin), and Cosmoblack roof/trim packages.',
    ],
    qa: [
      {
        q: 'Where can I install genuine ClearPro PPF in Bacoor or South Metro Manila?',
        a: 'Hakum Auto Care Bacoor at RFC Molino II is minutes from Alabang/MCX, Las Piñas, Imus, and Dasmariñas with an enclosed bay specifically fitted for full-front and full-body PPF installs.',
      },
      {
        q: 'How long is the ClearPro PPF warranty at Hakum Bacoor?',
        a: 'ClearPro PPF carries a 10-year manufacturer warranty covering yellowing, peeling, cracking, bubbling, and delamination when maintained per aftercare instructions.',
      },
      {
        q: 'Should I choose PPF, Ceramic Coating, or both?',
        a: 'PPF absorbs physical stone chips and scratches while Ceramic Coating maximizes chemical resistance and gloss. Many Bacoor SUV and sports-car owners install ClearPro PPF on high-impact zones and ceramic coat the entire vehicle.',
      },
    ],
  },
  {
    citySlug: 'bacoor',
    serviceSlug: 'window-tint',
    branchSlug: 'bacoor',
    cityName: 'Bacoor, Cavite',
    shortCity: 'Bacoor',
    serviceLabel: 'Nano Ceramic Window Tint',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/tint',
    eyebrow: 'Bacoor Nano Ceramic Window Tint · F1 Auto Films',
    h1: 'Nano Ceramic Window Tint in Bacoor, Cavite — Beat Heat Without Dark Glare.',
    seoTitle: 'Ceramic Window Tint in Bacoor, Cavite Near Me — IR Heat Rejection',
    seoDescription:
      'Install high IR heat-rejection nano ceramic window tint in Bacoor, Cavite. Preview shades in 3D with our online Tint Finder and book clean-bay fitting at RFC Molino II.',
    heroSummary:
      'Stop baking in afternoon Molino Boulevard traffic. Our nano-ceramic films block intense infrared heat and harmful UV rays while keeping night driving crisp across CAVITEX, Daang Hari, and SLEX.',
    processSteps: [
      'Match your night-vision comfort and privacy level using our live 3D Tint Finder shade preview.',
      'Old glue removal (if needed) + surgical interior protection and glass clay prep.',
      'Clean-bay heat shrinking and edge finishing for bubble-free, zero-haze clarity.',
      'Full RFID compatibility testing and signal-friendly non-metallic ceramic film verification.',
    ],
    localHighlights: [
      'Signal-friendly 100% ceramic construction — zero interference with RFID, GPS, or 5G mobile data.',
      'Compare Clear 70, Medium 35, Charcoal 15, and Super Dark 05 combinations before booking.',
      'Blocks UV heat that fades leather dashboards and stresses cabin AC compressors.',
    ],
    qa: [
      {
        q: 'Does your Bacoor ceramic window tint block Autosweep / Easytrip RFID?',
        a: 'No. Our nano-ceramic tint films are non-metallic, preserving toll RFID, dashcam GPS, and mobile reception while cutting cabin heat.',
      },
      {
        q: 'Can I preview tint darkness before driving to Hakum Bacoor?',
        a: 'Yes — open hakumautocare.com/tint-finder to test daylight and night visibility across shade combinations before booking RFC Molino II.',
      },
    ],
  },

  // ── BATANGAS CITY ─────────────────────────────────────────────────────────
  {
    citySlug: 'batangas',
    serviceSlug: 'car-wash',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Car Wash & Auto Detailing',
    serviceTypeSchema: 'AutoWash',
    mode: 'queue',
    serviceDetailRoute: '/services/wash-detailing',
    eyebrow: 'Batangas City Car Wash · Brgy. Alangilan',
    h1: 'Studio-Grade Car Wash & Auto Detailing in Batangas City.',
    seoTitle: 'Best Car Wash in Batangas City (Alangilan) — Swirl-Free Studio',
    seoDescription:
      'Looking for the best car wash in Batangas City near me? Hakum Auto Care Alangilan delivers two-bucket pH-neutral washes, hard-water spot removal, interior cleaning & live queue.',
    heroSummary:
      'Conveniently positioned along National Highway in Brgy. Alangilan, Hakum Batangas replaces hurried roadside sponge washes with safe pH-neutral chemistry, iron/tar removal for STAR Tollway commuters, and transparent live queue tracking.',
    processSteps: [
      'STAR Tollway bug, road-tar & brake-dust pre-rinse + snow foam encapsulation.',
      'Scratch-safe two-bucket hand wash with isolated wheel/fender brushes and fresh microfiber.',
      'Mineral-safe drying, vacuuming, streak-free glass prep, and clean interior finishing.',
      'Customer portal & SMS notification when ready for release.',
    ],
    localHighlights: [
      'Easy highway access for Alangilan, Kumintang, Pallocan, Balagtas, Lipa, and Bauan drivers.',
      'Live bay counts at hakumautocare.com/queue/batangas save you waiting in line under the sun.',
      'Specialized glass & paint watermark treatment for Batangas’ mineral-rich water and coastal humidity.',
    ],
    qa: [
      {
        q: 'Where is Hakum Car Wash in Batangas City?',
        a: 'Our Batangas City studio is along the National Highway (PNP area) in Brgy. Alangilan, minutes from Balagtas Exit and STAR Tollway.',
      },
      {
        q: 'Do you remove hard-water marks and acid-rain etching in Batangas?',
        a: 'Yes. We inspect mineral spots safely and offer Acid Rain / Watermark Removal, Glass Detailing, and hydrophobic glass protection tailored for Batangas weather.',
      },
      {
        q: 'Can I check wait times at Hakum Batangas City before visiting?',
        a: 'Yes — view the live Alangilan queue anytime at hakumautocare.com/queue/batangas or call our Batangas line directly at 0956 007 1028.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'ceramic-coating',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Ceramic Coating (Kisho 9H)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ceramic',
    eyebrow: 'Batangas Ceramic Coating · Kisho 9H Studio',
    h1: 'Ceramic Coating in Batangas City — Flagship Shine Without Driving to Manila.',
    seoTitle: 'Ceramic Coating in Batangas City Near Me — Kisho 9H Studio',
    seoDescription:
      'Get authentic Kisho 9H ceramic coating with multi-stage paint correction right in Alangilan, Batangas City. Coastal humidity & UV protection with Unlimited Recoating packages.',
    heroSummary:
      'Southern Luzon drivers no longer need an overnight Metro Manila trip for studio-grade ceramic protection. Hakum Batangas performs complete decontamination, Rupes paint correction, and genuine Kisho 9H curing right in Alangilan.',
    processSteps: [
      'Digital paint thickness check + iron fallout, tar, and clay decontamination.',
      'Multi-stage machine polishing to eliminate dealer swirls and Batangas sun oxidation.',
      'Controlled curing application of Kisho Japanese ceramic chemistry across panels and glass.',
      'Automatic 6-month maintenance reminders + Unlimited Recoating eligibility on Premium/Platinum.',
    ],
    localHighlights: [
      'Built for coastal salt mist, port humidity, agricultural dust, and intense STAR Tollway sun.',
      'Honest size-based pricing for sedans, crossovers, pickups, and full-size SUVs.',
      'Full work warranty and service history stored permanently under your vehicle plate.',
    ],
    qa: [
      {
        q: 'Do I have to drive to Metro Manila for real Kisho 9H Ceramic Coating?',
        a: 'No. Hakum Batangas City in Brgy. Alangilan carries the exact same Kisho Japan ceramic packages, Rupes polishing hardware, and enclosed lighting bays as our Cavite flagship.',
      },
      {
        q: 'How does ceramic coating help in Batangas coastal and highway weather?',
        a: 'Cured 9H SiO2 glass layers create strong water beading, UV fade resistance, and chemical defense against bug acids, salt air, and mineral rain spots.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'ppf',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Paint Protection Film (ClearPro PPF)',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/ppf',
    eyebrow: 'Batangas City ClearPro PPF · STAR Tollway Rock-Chip Defense',
    h1: 'Paint Protection Film (PPF) in Batangas City — Self-Healing ClearPro TPU.',
    seoTitle: 'PPF Batangas City Near Me — ClearPro Self-Healing Paint Protection Film',
    seoDescription:
      'Shield hoods, bumpers, and full bodies against STAR Tollway stone chips with official ClearPro TPU PPF installed in Batangas City. Backed by a 10-year warranty.',
    heroSummary:
      'Expressway gravel along STAR Tollway and CALABARZON diversion highways chips front bumpers fast. Hakum Batangas City installs genuine ClearPro self-healing optical TPU Paint Protection Film with zero visible glue lines.',
    processSteps: [
      'Deep wash, tar extraction, and panel prep inside our enclosed Batangas installation bay.',
      'Precision-cut ClearPro optical TPU patterns with hidden tucked panel edges.',
      '95 GU gloss verification and seam sealing across bumpers, hood, headlamps, and fenders.',
      '10-year manufacturer warranty registration protecting against yellowing or peeling.',
    ],
    localHighlights: [
      'Essential armor for Hilux, Fortuner, Everest, Raptor, Montero, and executive sedans running STAR Tollway.',
      'Heat-activated self-healing surface erases fine road brush marks.',
      'Served by trained Hakum Batangas installers — call 0956 007 1028 for a consultation.',
    ],
    qa: [
      {
        q: 'Why install ClearPro PPF in Batangas City?',
        a: 'If you drive the STAR Tollway, Batangas Diversion Road, or Lipa–Batangas routes, clear coat chips quickly from gravel and trucks. ClearPro TPU film absorbs impact while remaining virtually invisible.',
      },
      {
        q: 'Can Batangas owners get Full Front or Full Body ClearPro PPF?',
        a: 'Yes — reserve High-Impact Zones, Full Front, or Full Body PPF packages in High Gloss or Matte/Satin right at our Alangilan studio.',
      },
    ],
  },
  {
    citySlug: 'batangas',
    serviceSlug: 'window-tint',
    branchSlug: 'batangas',
    cityName: 'Batangas City',
    shortCity: 'Batangas City',
    serviceLabel: 'Nano Ceramic Window Tint',
    serviceTypeSchema: 'AutomotiveBusiness',
    mode: 'book',
    serviceDetailRoute: '/services/tint',
    eyebrow: 'Batangas Ceramic Window Tint · Cooler Cabins',
    h1: 'Nano Ceramic Window Tint in Batangas City — Maximum Heat Rejection.',
    seoTitle: 'Ceramic Window Tint in Batangas City Near Me — Alangilan Studio',
    seoDescription:
      'Upgrade your car tint in Batangas City with high IR-rejection nano ceramic films. Crystal-clear provincial night driving, RFID compatible, previewed on our 3D Tint Finder.',
    heroSummary:
      'Long provincial drives around Batangas and Lipa demand serious cabin cooling without sacrificing visibility on dark provincial roads at night. Our nano-ceramic series rejects intense solar heat while keeping nighttime clarity sharp.',
    processSteps: [
      'Compare front-to-rear shades in real time on our interactive 3D Tint Finder before arriving.',
      'Adhesive-safe old film strip + clean glass prep inside our Alangilan studio.',
      'One-piece precision heat shrinking for rear windshields and clean edge trims.',
      'Zero RFID or mobile signal interference verified before release.',
    ],
    localHighlights: [
      'Ideal balance of daytime heat rejection and safe night clarity on unlit Batangas roads.',
      'Available across Light, Medium, Dark, and Super Dark ceramic VLT tiers.',
      'Direct booking or bundle pricing with Ceramic Coating & PPF.',
    ],
    qa: [
      {
        q: 'Which ceramic tint shade is safest for provincial Batangas night driving?',
        a: 'Many Batangas customers pair Light/Medium (35%–50%) on the front windshield with Charcoal/Dark (15%) on the sides for maximum cooling without losing night road visibility.',
      },
      {
        q: 'Will ceramic tint interfere with my SLEX / STAR Tollway RFID?',
        a: 'No — nano-ceramic films contain zero metal, so windshield RFID stickers and GPS signals pass right through.',
      },
    ],
  },
]

const SERVICE_SLUG_ALIASES = {
  wash: 'car-wash',
  'wash-detailing': 'car-wash',
  'car-wash': 'car-wash',
  detailing: 'car-wash',
  ceramic: 'ceramic-coating',
  'ceramic-coating': 'ceramic-coating',
  ppf: 'ppf',
  'paint-protection-film': 'ppf',
  tint: 'window-tint',
  'window-tint': 'window-tint',
  'ceramic-tint': 'window-tint',
}

export function findLocalBranchServicePage(citySlug, serviceSlug) {
  const cleanCity = String(citySlug || '').trim().toLowerCase()
  const normalizedService = SERVICE_SLUG_ALIASES[String(serviceSlug || '').trim().toLowerCase()] || ''
  if (!cleanCity || !normalizedService) return null
  const exact = LOCAL_BRANCH_SERVICE_PAGES.find(
    (p) => p.citySlug === cleanCity && p.serviceSlug === normalizedService,
  )
  if (exact) return { page: exact, redirected: false, canonicalServiceSlug: normalizedService, canonicalCitySlug: cleanCity }
  // Expansion hubs (imus, dasmarinas, cavite) route cleanly to the nearest open Cavite flagship (bacoor)
  const cityPage = findLocalBranchPage(cleanCity)
  if (cityPage) {
    const fallback = LOCAL_BRANCH_SERVICE_PAGES.find(
      (p) => p.citySlug === cityPage.branchSlug && p.serviceSlug === normalizedService,
    )
    if (fallback) {
      return {
        page: fallback,
        redirected: true,
        canonicalCitySlug: fallback.citySlug,
        canonicalServiceSlug: fallback.serviceSlug,
      }
    }
  }
  return null
}

export function getBranchReviewsForCity(branchSlug) {
  return BRANCH_SERVICE_REVIEWS[String(branchSlug || '').trim().toLowerCase()] || []
}

export function buildBranchServiceJsonLd(page, { hours = [], origin = PRODUCTION_ORIGIN } = {}) {
  if (!page) return null
  const base = String(origin || PRODUCTION_ORIGIN).replace(/\/$/, '')
  const cityPage = findLocalBranchPage(page.citySlug)
  const mapInfo = BRANCH_MAP_LISTINGS[page.branchSlug]
  const pageUrl = `${base}/branches/${page.citySlug}/${page.serviceSlug}`
  const hasMap = mapInfo?.cid ? `https://www.google.com/maps?cid=${mapInfo.cid}` : undefined
  const phone = branchPhone(page.branchSlug)?.href?.replace(/^tel:/, '') || MAIN_LINE.href.replace(/^tel:/, '')
  const studioId = `${base}/branches/${page.citySlug}#studio`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': page.serviceTypeSchema || 'AutomotiveBusiness',
        '@id': studioId,
        name: `Hakum Auto Care — ${page.cityName}`,
        url: `${base}/branches/${page.citySlug}`,
        telephone: phone,
        image: `${base}/og-image.png`,
        areaServed: cityPage?.corridors || [page.cityName],
        address: {
          '@type': 'PostalAddress',
          addressLocality: page.shortCity,
          addressRegion: page.branchSlug === 'batangas' ? 'Batangas' : 'Cavite',
          addressCountry: 'PH',
          streetAddress: cityPage?.landmarkAddress || page.cityName,
        },
        ...(hasMap ? { hasMap } : {}),
        ...(mapInfo?.lat != null && mapInfo?.lng != null
          ? { geo: { '@type': 'GeoCoordinates', latitude: mapInfo.lat, longitude: mapInfo.lng } }
          : {}),
        ...(Array.isArray(hours) && hours.length ? { openingHoursSpecification: hours } : {}),
      },
      {
        '@type': 'Service',
        '@id': `${pageUrl}#service`,
        name: `${page.serviceLabel} in ${page.cityName}`,
        serviceType: page.serviceLabel,
        description: page.seoDescription,
        url: pageUrl,
        provider: { '@id': studioId },
        areaServed: cityPage?.corridors || [page.cityName],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Branches', item: `${base}/branches` },
          { '@type': 'ListItem', position: 3, name: page.cityName, item: `${base}/branches/${page.citySlug}` },
          { '@type': 'ListItem', position: 4, name: page.serviceLabel, item: pageUrl },
        ],
      },
      ...(Array.isArray(page.qa) && page.qa.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${pageUrl}#faq`,
              mainEntity: page.qa.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
              })),
            },
          ]
        : []),
    ],
  }
}
