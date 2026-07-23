import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageMeta } from '@/lib/pageMeta'

const PAGE_META = {
  '/': {
    title: null,
    description: 'Premium car wash, detailing, ceramic coating, and PPF in Bacoor and Batangas. Book online and track the live queue.',
  },
  '/services': { title: 'Services', description: 'Car wash, interior detailing, paint correction, ceramic coating, and PPF at Hakum Auto Care.' },
  '/packages': { title: 'Packages', description: 'Ceramic coating and paint protection film packages from Hakum Auto Care.' },
  '/book': { title: 'Book a service', description: 'Book a Hakum Auto Care visit at Bacoor or Batangas.' },
  '/queue': { title: 'Live queue', description: 'Check live queue counts at Hakum Auto Care branches.' },
  '/branches': { title: 'Branches', description: 'Find Hakum Auto Care branches in Bacoor and Batangas.' },
  '/contact': { title: 'Contact', description: 'Contact Hakum Auto Care for bookings, services, and branch questions.' },
  '/complaints': { title: 'Complaints', description: 'Submit a complaint or feedback to Hakum Auto Care.' },
  '/events': { title: 'Events', description: 'Hakum Auto Care events and registrations.' },
  '/terms': { title: 'Terms of Service', description: 'Terms of Service for Hakum Auto Care.' },
  '/privacy': { title: 'Privacy Policy', description: 'Privacy Policy for Hakum Auto Care.' },
}

/** Sets document title / OG tags for public marketing pages. */
export default function PublicPageMeta() {
  const { pathname } = useLocation()
  const meta = PAGE_META[pathname] || {
    title: 'Hakum Auto Care',
    description: PAGE_META['/'].description,
  }

  usePageMeta({
    title: meta.title,
    description: meta.description,
    path: pathname,
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
