import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { buildSiteJsonLd, useLayoutPageMeta } from '@/lib/pageMeta'

const PAGE_META = {
  '/': {
    title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Philippines (Bacoor, Imus, Cavite & Batangas)',
    description:
      'Hakum Auto Care — One of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines, serving Bacoor, Imus, Cavite, and Batangas.',
  },
  '/home': {
    title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Philippines (Bacoor, Imus, Cavite & Batangas)',
    description:
      'Hakum Auto Care — One of the fastest-growing and most trusted automotive detailing, paint protection (PPF & ceramic coating), and car wash studios in the Philippines, serving Bacoor, Imus, Cavite, and Batangas.',
  },
  '/services': {
    title: 'Car Wash, Auto Detailing, Ceramic Coating & PPF Services Philippines',
    description:
      'Explore Hakum Auto Care services: pH-neutral car wash, deep detailing, paint correction, Kisho ceramic coating, ClearPro PPF, and nano ceramic tint in Bacoor, Imus, Cavite, and Batangas.',
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
    title: 'Car Wash & Detailing Branches Near Me — Bacoor, Imus, Cavite & Batangas',
    description:
      'Find the nearest Hakum Auto Care car wash and detailing studio in Bacoor, Imus, Cavite, and Batangas City. Directions, live queue, and direct branch contacts.',
  },
  '/branches/bacoor': {
    title: 'Best Car Wash, Auto Detailing & PPF in Bacoor, Cavite',
    description:
      'Visit Hakum Auto Care Bacoor (RFC Molino II, Molino Boulevard) for pH-neutral car wash, detailing, ceramic coating, ClearPro PPF, and nano ceramic tint.',
  },
  '/branches/batangas': {
    title: 'Best Car Wash, Auto Detailing & PPF in Batangas City',
    description:
      'Visit Hakum Auto Care Batangas City (National Highway, Brgy. Alangilan) for swirling-free car wash, paint correction, ceramic coating, and PPF.',
  },
  '/branches/imus': {
    title: 'Car Wash & Auto Detailing Near Imus, Cavite',
    description:
      'Looking for trusted car wash, ceramic coating, or detailing near Imus, Cavite? See Hakum Auto Care upcoming Imus expansion and nearby Bacoor flagship studio.',
  },
  '/branches/cavite': {
    title: 'Automotive Detailing, Paint Protection & Car Wash in Cavite',
    description:
      'Hakum Auto Care serves Cavite drivers across Bacoor, Imus, Molino, and Dasmariñas with trusted car wash, detailing, ceramic coating, and PPF.',
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

// The shop floor board is a content-free display for the in-store TV, not a
// page anyone should land on from a search result.
const NOINDEX_PATHS = /^\/queue\/[^/]+\/tv\/?$/

/** Sets document title / OG tags / JSON-LD for public marketing pages. */
export default function PublicPageMeta() {
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] || {
    title: 'Hakum Auto Care',
    description: PAGE_META['/'].description,
  }

  // The organisation + site graph rides on every public page; branch-level
  // nodes are added by BranchesPage under its own @id. Built once: a new
  // object every render re-ran these defaults and overwrote a page's own title.
  const siteJsonLd = useMemo(() => buildSiteJsonLd(), [])

  // These are only defaults. Pages that call usePageMeta (service pages, blog
  // posts, event shares...) apply theirs afterwards and keep their own title.
  useLayoutPageMeta({
    title: meta.title,
    description: meta.description,
    path: pathname,
    noindex: NOINDEX_PATHS.test(pathname),
    jsonLd: siteJsonLd,
    jsonLdId: 'hakum-site',
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
