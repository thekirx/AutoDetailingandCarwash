import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { buildSiteJsonLd, useLayoutPageMeta } from '@/lib/pageMeta'

const PAGE_META = {
  '/': {
    title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF',
    description:
      'Swirl-free two-bucket car wash, auto detailing, Kisho 9H ceramic coating & ClearPro PPF in Bacoor, Imus, Dasmariñas, Cavite & Batangas City.',
  },
  '/home': {
    title: 'Hakum Auto Care — Car Wash, Detailing, Ceramic & PPF',
    description:
      'Swirl-free two-bucket car wash, auto detailing, Kisho 9H ceramic coating & ClearPro PPF in Bacoor, Imus, Dasmariñas, Cavite & Batangas City.',
  },
  '/services': {
    title: 'Car Wash, Auto Detailing, Ceramic & PPF Services',
    description:
      'ClearPro PPF, Kisho 9H ceramic coating, nano ceramic tint, and two-bucket pH-neutral car wash across Bacoor, Cavite & Batangas City.',
  },
  '/shop': {
    title: 'Car Care & Aftercare Shop',
    description:
      'Shop pH-neutral car shampoos, ceramic boosters, microfiber towels, and detailing essentials at Hakum Auto Care in Bacoor, Cavite, and Batangas.',
  },
  '/tint-finder': {
    title: 'Nano Ceramic Tint Finder Philippines',
    description:
      'Answer four quick questions to find your recommended front and rear tint shades, compare nano ceramic tint packages, and book at Hakum Auto Care in Cavite or Batangas.',
  },
  '/book': {
    title: 'Book Car Wash, Detailing or PPF Near Me',
    description:
      'Book your car wash, detailing, ceramic coating, or PPF slot online at Hakum Auto Care Bacoor (near Imus, Cavite) or Batangas City and track live queue.',
  },
  '/queue': {
    title: 'Live Car Wash & Detailing Queue Philippines',
    description:
      'Check live queue counts at Hakum Auto Care branches in Bacoor (Cavite) and Batangas City before driving in.',
  },
  '/branches': {
    title: 'Detailing Branches — Bacoor, Imus & Batangas',
    description:
      'Find Hakum Auto Care detailing, PPF & car wash studios in Bacoor, Imus, Dasmariñas, Cavite & Batangas City. Maps, phone & live queue.',
  },
  '/branches/bacoor': {
    title: 'Bacoor Car Wash & Auto Detailing | Ceramic & PPF',
    description:
      'Visit Hakum Auto Care Bacoor (RFC Molino II, Molino Blvd) for pH-neutral car wash, detailing, Kisho 9H ceramic coating & ClearPro PPF.',
  },
  '/branches/batangas': {
    title: 'Batangas Car Wash & Batangas City Auto Detailing',
    description:
      'Hakum Auto Care Batangas City (Alangilan Highway): swirl-free car wash, interior detailing, Kisho 9H ceramic coating & ClearPro PPF.',
  },
  '/branches/imus': {
    title: 'Imus Car Wash & Auto Detailing Near Me, Cavite',
    description:
      'Imus car wash, auto detailing, ceramic coating & ClearPro PPF near Vermosa and Aguinaldo Hwy — open nearby in Bacoor; Imus opening soon.',
  },
  '/branches/dasmarinas': {
    title: 'Dasmariñas Car Wash & Auto Detailing Near Me',
    description:
      'Dasmariñas car wash, auto detailing, ceramic coating & PPF near Salawag and Pala-Pala — open nearby in Bacoor; Dasmariñas opening soon.',
  },
  '/branches/cavite': {
    title: 'Cavite Car Wash, Auto Detailing & PPF Studio',
    description:
      'Hakum Auto Care serves Cavite drivers across Bacoor, Imus & Dasmariñas with pH-neutral car wash, Rupes correction, Kisho ceramic & PPF.',
  },
  '/partnerships': {
    title: 'Brand Collabs & Automotive Events',
    description: 'Collaborate with Hakum Auto Care on car meets, automotive products, events, and distribution.',
  },
  '/contact': {
    title: 'Contact Hakum Auto Care Philippines',
    description: 'Contact Hakum Auto Care in Bacoor, Cavite or Batangas City for bookings, detailing consultations, and branch questions.',
  },
  '/complaints': { title: 'Complaints & Client Support', description: 'Submit feedback or service support requests to Hakum Auto Care.' },
  '/events': {
    title: 'Events, Car Meets & Detailing Blog Philippines',
    description:
      'Hakum Auto Care events, car meets, customer stories, and automotive detailing guides for Bacoor, Imus, Cavite, and Batangas.',
  },
  '/blog': {
    title: 'Auto Detailing, PPF & Car Wash Blog Philippines',
    description:
      'Expert guides on car wash science, ceramic coating, paint protection film (PPF), and finding the nearest Hakum studio in Bacoor, Imus, Cavite, and Batangas.',
  },
  '/terms': { title: 'Terms of Service', description: 'Terms of Service for Hakum Auto Care.' },
  '/privacy': { title: 'Privacy Policy', description: 'Privacy Policy for Hakum Auto Care.' },
  '/cookies': { title: 'Cookie Policy', description: 'Cookie Policy for Hakum Auto Care.' },
  '/403': { title: 'Access denied', description: 'You do not have access to that Hakum Auto Care page.' },
}

// The shop floor board, complaints form, /home shell alias, and 403/404 are excluded from the index.
const NOINDEX_PATHS = /^(?:\/queue\/[^/]+\/tv|\/complaints|\/home|\/403|\/404)\/?$/

/** Sets document title / OG tags / JSON-LD for public marketing pages. */
export default function PublicPageMeta() {
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] || {
    title: 'Hakum Auto Care',
    description: PAGE_META['/'].description,
  }
  const canonicalRoute = pathname === '/home' ? '/' : pathname

  // The organisation + site graph rides on every public page; branch-level
  // nodes are added by BranchesPage under its own @id. Built once: a new
  // object every render re-ran these defaults and overwrote a page's own title.
  const siteJsonLd = useMemo(() => buildSiteJsonLd(), [])

  // These are only defaults. Pages that call usePageMeta (service pages, blog
  // posts, event shares...) apply theirs afterwards and keep their own title.
  useLayoutPageMeta({
    title: meta.title,
    description: meta.description,
    path: canonicalRoute,
    canonical: pathname === '/home' ? '/' : undefined,
    noindex: NOINDEX_PATHS.test(pathname),
    jsonLd: siteJsonLd,
    jsonLdId: 'hakum-site',
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
