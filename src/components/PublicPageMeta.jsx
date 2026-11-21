import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { buildSiteJsonLd, useLayoutPageMeta } from '@/lib/pageMeta'
import { PUBLIC_ROUTE_SEO } from '@/lib/publicSeoCatalog'

// The shop floor board, complaints form, /home shell alias, and 403/404 are excluded from the index.
const NOINDEX_PATHS = /^(?:\/queue\/[^/]+\/tv|\/complaints|\/home|\/403|\/404)\/?$/

/** Sets document title / OG tags / JSON-LD for public marketing pages. */
export default function PublicPageMeta() {
  const { pathname } = useLocation()
  const meta = PUBLIC_ROUTE_SEO[pathname] || {
    title: 'Hakum Auto Care',
    description: PUBLIC_ROUTE_SEO['/'].description,
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
