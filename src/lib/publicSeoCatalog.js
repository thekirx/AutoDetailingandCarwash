/**
 * Canonical SEO metadata for core public routes and service pillars.
 * Single source of truth consumed by PublicPageMeta, page components,
 * static prerendering (scripts/prerender-seo.mjs), and crawler SSR (server/seoApi.mjs).
 */
export const PUBLIC_ROUTE_SEO = {
  '/': {
    title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF',
    description:
      'Swirl-free two-bucket car wash, auto detailing, Kisho 9H ceramic coating & ClearPro PPF in Bacoor, Imus, Dasmariñas, Cavite & Batangas City.',
  },
  '/home': {
    title: 'Car Wash, Detailing, Ceramic & PPF Home',
    description:
      'Swirl-free two-bucket car wash, auto detailing, Kisho 9H ceramic coating & ClearPro PPF in Bacoor, Imus, Dasmariñas, Cavite & Batangas City.',
  },
  '/services': {
    title: 'Car Wash, Auto Detailing, Ceramic & PPF Services',
    description:
      'ClearPro PPF, Kisho 9H ceramic coating, nano ceramic tint, and two-bucket pH-neutral car wash across Bacoor, Cavite & Batangas City.',
  },
  '/shop': {
    title: 'Car Care & Aftercare Shop — Shampoos & Boosters',
    description:
      'Shop pH-neutral car shampoos, ceramic boosters, microfiber towels, and detailing essentials stocked at Hakum Auto Care Bacoor and Batangas City.',
  },
  '/tint-finder': {
    title: '3D Nano Ceramic Tint Finder — Compare Shade Clarity',
    description:
      'Preview front windshield, side window, and rear glass tint shades on an interactive 3D car before booking installation in Bacoor or Batangas City.',
  },
  '/book': {
    title: 'Book Car Wash, Detailing, Ceramic Coating or PPF Near Me',
    description:
      'Book your detailing consultation, Kisho 9H ceramic coating, ClearPro PPF, or ceramic window tint slot online at Hakum Auto Care Bacoor or Batangas City.',
  },
  '/queue': {
    title: 'Live Car Wash & Detailing Queue — Bacoor & Batangas',
    description:
      'Check real-time waiting cars and active bays at Hakum Auto Care Bacoor (RFC Molino) and Batangas City (Alangilan) before leaving home.',
  },
  '/branches': {
    title: 'Detailing Branches — Bacoor, Imus & Batangas',
    description:
      'Find Hakum Auto Care detailing, PPF & car wash studios in Bacoor, Imus, Dasmariñas, Cavite & Batangas City. Maps, phone & live queue.',
  },
  '/branches/bacoor': {
    title: 'Bacoor Car Wash & Auto Detailing | Ceramic & PPF',
    description:
      'Top-rated Bacoor car wash at RFC Molino II, Molino Blvd: two-bucket pH-neutral wash, Rupes paint correction, Kisho 9H ceramic, ClearPro PPF & tint.',
  },
  '/branches/batangas': {
    title: 'Batangas Car Wash & Batangas City Detailing Studio',
    description:
      'Top Batangas car wash in Alangilan, Batangas City: two-bucket pH-neutral washing, watermark removal, Rupes correction, Kisho 9H ceramic & ClearPro PPF.',
  },
  '/branches/imus': {
    title: 'Imus Car Wash, Detailing, Ceramic & PPF Near Me',
    description:
      'Imus car wash, auto detailing, ceramic coating & ClearPro PPF near Vermosa and Aguinaldo Hwy — open nearby in Bacoor; Imus opening soon.',
  },
  '/branches/dasmarinas': {
    title: 'Dasmariñas Car Wash, Detailing & ClearPro PPF',
    description:
      'Dasmariñas car wash, ceramic coating & ClearPro PPF near Salawag and Pala-Pala — minutes up Molino Rd to Hakum Bacoor while Dasmariñas prepares to launch.',
  },
  '/branches/cavite': {
    title: 'Cavite Car Wash, Auto Detailing & ClearPro PPF',
    description:
      'Hakum Auto Care serves Cavite drivers across Bacoor, Imus & Dasmariñas with pH-neutral car wash, Rupes correction, Kisho ceramic & PPF.',
  },
  '/partnerships': {
    title: 'Brand Collabs & Automotive Events',
    description: 'Collaborate with Hakum Auto Care on car meets, automotive products, events, and studio partnerships in Cavite and Batangas City.',
  },
  '/contact': {
    title: 'Contact Hakum Auto Care — Bacoor & Batangas Studios',
    description:
      'Contact Hakum Auto Care in Bacoor, Cavite (0915 629 6096) or Batangas City (0956 007 1028) for bookings, PPF quotes, and ceramic coating consultations.',
  },
  '/complaints': {
    title: 'Submit a Complaint',
    description:
      'Submit a service feedback report or branch inquiry directly to Hakum Auto Care management in Bacoor or Batangas City.',
  },
  '/events': {
    title: 'Events, Car Meets & Detailing Guides Philippines',
    description:
      'Hakum Auto Care events, car meets, customer car stories, and local car care guides across Bacoor, Imus, Dasmariñas, Cavite & Batangas City.',
  },
  '/blog': {
    title: 'Auto Detailing, PPF & Car Wash Blog Philippines',
    description:
      'Detailing craft, ceramic coating protection, PPF insights, and local studio guides for Bacoor, Imus, Dasmariñas, Cavite & Batangas City.',
  },
  '/terms': {
    title: 'Terms of Service',
    description:
      'Terms of Service for Hakum Auto Care bookings, ClearPro PPF & ceramic warranty conditions, vouchers, Push/SMS alerts, and customer accounts.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description:
      'Hakum Auto Care Privacy Policy under the Philippine Data Privacy Act (RA 10173): vehicle photos, SMS alerts, web push, and account rights.',
  },
  '/cookies': {
    title: 'Cookie Policy',
    description:
      'How Hakum Auto Care uses essential session cookies, local preferences, and PWA offline storage across our website and customer portal.',
  },
  '/403': {
    title: 'Access denied',
    description: 'You do not have permission to view that Hakum Auto Care page.',
  },
}

export const SERVICE_SEO_BY_SLUG = {
  ppf: {
    slug: 'ppf',
    name: 'ClearPro Paint Protection Film (PPF)',
    title: 'ClearPro Paint Protection Film (PPF) — Bacoor & Batangas',
    description:
      'Self-healing ClearPro TPU Paint Protection Film (PPF) installed in enclosed bays in Bacoor & Batangas City, backed by a 10-year warranty.',
  },
  ceramic: {
    slug: 'ceramic',
    name: 'Kisho 9H Ceramic Coating',
    title: 'Kisho 9H Ceramic Coating — Bacoor, Cavite & Batangas',
    description:
      'Multi-stage paint correction and authentic Kisho 9H Ceramic Coating in Bacoor, Cavite and Batangas City with Unlimited Recoating packages.',
  },
  tint: {
    slug: 'tint',
    name: 'Nano Ceramic Window Tint',
    title: 'Nano Ceramic Window Tint — Bacoor, Imus & Batangas',
    description:
      'High heat-rejection nano ceramic window tint in Bacoor, Cavite and Batangas City — RFID-safe night clarity previewed in 3D before booking.',
  },
  'wash-detailing': {
    slug: 'wash-detailing',
    name: 'Car Wash & Auto Detailing',
    title: 'Car Wash & Auto Detailing — Bacoor, Imus & Batangas',
    description:
      'Two-bucket pH-neutral car wash, interior sanitization, and swirl-free detailing in Bacoor (Molino), Batangas City (Alangilan), serving Imus and Dasmariñas.',
  },
}
