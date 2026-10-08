import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { buildSiteJsonLd, usePageMeta } from '@/lib/pageMeta'

const PAGE_META = {
  '/': {
    title: null,
    description: 'Premium car wash, detailing, ceramic coating, and PPF in Bacoor and Batangas. Book online and track the live queue.',
  },
  '/services': { title: 'Services', description: 'Car wash, interior detailing, paint correction, ceramic coating, and PPF at Hakum Auto Care.' },
  '/book': { title: 'Book a service', description: 'Book a Hakum Auto Care visit at Bacoor or Batangas.' },
  '/queue': { title: 'Live queue', description: 'Customer count board or shop TV floor board at Hakum Auto Care branches.' },
  '/branches': { title: 'Branches', description: 'Find Hakum Auto Care branches in Bacoor and Batangas.' },
  '/partnerships': { title: 'Brand Collabs', description: 'Collaborate with Hakum Auto Care on products, events, content, and distribution.' },
  '/contact': { title: 'Contact', description: 'Contact Hakum Auto Care for bookings, services, and branch questions.' },
  '/complaints': { title: 'Complaints', description: 'Submit a complaint or feedback to Hakum Auto Care.' },
  '/events': { title: 'Events & Blog', description: 'Hakum Auto Care events, registrations, car care stories, and blog posts.' },
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
  // nodes are added by BranchesPage under its own @id.
  const siteJsonLd = buildSiteJsonLd()

  usePageMeta({
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
