import { useEffect } from 'react'

const SITE = 'Hakum Auto Care'
const DEFAULT_DESCRIPTION =
  'Premium car wash, detailing, ceramic coating, and PPF in Bacoor and Batangas. Book online and track the live queue.'

function absoluteUrl(path = '/') {
  if (typeof window === 'undefined') return path
  const origin = window.location.origin
  if (!path || path === '/') return origin + '/'
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

/** Normalise a route to a single leading slash, '/' when absent. */
export function canonicalPath(path = '/') {
  const raw = String(path || '').trim()
  if (!raw) return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

/**
 * Compose the document title.
 *
 * BUG-051: this used to be `${title} · ${SITE}` unconditionally, so any caller
 * whose title was already the site name (the /home fallback in PublicPageMeta)
 * produced "Hakum Auto Care · Hakum Auto Care" in the tab, in SERP results and
 * in Facebook/TikTok link previews.
 */
export function buildDocumentTitle(title) {
  const value = String(title || '').trim()
  if (!value || value === SITE) return SITE
  return `${value} · ${SITE}`
}

/* ── Structured data ─────────────────────────────────────────────────────── */

// day_of_week 0 is Sunday here, matching WEEKDAY_LABELS in
// lib/branchOperatingHours.js. Getting this backwards would publish every
// branch's hours shifted a day, which is worse than publishing none.
const SCHEMA_DAY = [
  'https://schema.org/Sunday',
  'https://schema.org/Monday',
  'https://schema.org/Tuesday',
  'https://schema.org/Wednesday',
  'https://schema.org/Thursday',
  'https://schema.org/Friday',
  'https://schema.org/Saturday',
]

/**
 * HH:MM from a stored time. Accepts 08:00, 8:00, 8:00:00, 8 AM and 6:00 PM —
 * the 12-hour form is tested first, because "6:00 PM" otherwise parses as 06:00
 * and would publish a shop closing at six in the morning.
 */
function clock(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const twelve = raw.match(/^(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m?\.?$/i)
  if (twelve) {
    const hour24 = (Number(twelve[1]) % 12) + (/p/i.test(twelve[3]) ? 12 : 0)
    return `${String(hour24).padStart(2, '0')}:${twelve[2] || '00'}`
  }

  const hm = raw.match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/)
  if (!hm) return null
  const hour = Number(hm[1])
  if (hour > 23) return null
  return `${String(hour).padStart(2, '0')}:${hm[2]}`
}

/**
 * Convert branch_operating_hours rows into schema.org OpeningHoursSpecification.
 * Rows with is_closed, or with no parsable clock, are dropped rather than
 * guessed at — a wrong opening hour is worse for a map listing than no hour.
 */
export function openingHoursSpecification(week = []) {
  const seen = new Set()
  const out = []
  for (const row of week || []) {
    const day = SCHEMA_DAY[Number(row?.day_of_week)]
    if (!day || row?.is_closed) continue
    const opens = clock(row?.opens_at)
    const closes = clock(row?.closes_at)
    if (!opens || !closes) continue
    const key = `${day}|${opens}|${closes}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens, closes })
  }
  return out
}

/**
 * Local-business structured data for the public surfaces.
 *
 * Only facts we actually hold are emitted. There is deliberately NO
 * aggregateRating: Google review URLs do not exist for any branch yet
 * (Unresolved decision #5/#13), and an invented rating is a manual-action
 * risk. Real street addresses are likewise still landmarks ("RFC Molino",
 * "PNP Batangas") pending the owner's own (Unresolved decision #9), so the
 * landmark is published as the street address rather than a fabricated one.
 */
export function buildLocalBusinessJsonLd({
  branches = [],
  hoursBySlug = {},
  areaServed = ['Bacoor', 'Batangas'],
  telephone = '+639156296096',
} = {}) {
  const nodes = branches.map((b) => {
    // A branch that has not opened yet publishes an empty specification rather
    // than the defaults the hours table happens to carry.
    const hours = b.coming_soon ? [] : openingHoursSpecification(hoursBySlug[b.slug] || [])
    return {
      '@type': 'AutomotiveBusiness',
      '@id': `${absoluteUrl('/')}#${b.slug}`,
      name: `${SITE} ${publicName(b)}`.trim(),
      url: absoluteUrl(`/branches#${b.slug}`),
      areaServed,
      ...(b.coming_soon || hours.length ? { openingHoursSpecification: hours } : {}),
      ...(b.address ? { address: { '@type': 'PostalAddress', addressLocality: publicName(b), streetAddress: b.address } } : {}),
      ...(b.phone ? { telephone: b.phone } : { telephone }),
    }
  })

  return {
    '@context': 'https://schema.org',
    '@graph': nodes.length
      ? nodes
      : [{ '@type': 'AutomotiveBusiness', name: SITE, areaServed, telephone }],
  }
}

/** Site-level graph: what the org is, and what the domain represents. */
export function buildSiteJsonLd({ areaServed = ['Bacoor', 'Batangas'] } = {}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${absoluteUrl('/')}#organization`,
        name: SITE,
        url: absoluteUrl('/'),
        areaServed,
        logo: absoluteUrl('/og-image.png'),
      },
      {
        '@type': 'WebSite',
        '@id': `${absoluteUrl('/')}#website`,
        url: absoluteUrl('/'),
        name: SITE,
        publisher: { '@id': `${absoluteUrl('/')}#organization` },
      },
    ],
  }
}

function publicName(branch) {
  return String(branch?.name || branch?.slug || '').trim()
}

/* ── Head application ────────────────────────────────────────────────────── */

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Canonical + robots directives, so duplicate URL forms consolidate. */
export function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Upsert a JSON-LD block. Keyed by @id/data-jsonld so re-renders replace rather
 * than stack. The site graph and the branch graph use different ids and can
 * coexist on /branches.
 */
export function upsertJsonLd(data, id = 'hakum-jsonld') {
  let el = document.head.querySelector(`script[data-jsonld="${id}"]`)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.setAttribute('data-jsonld', id)
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * The complete set of head directives for a page, as data.
 *
 * Pure and DOM-free so the crawler-visible contract (title, canonical, robots,
 * Open Graph, JSON-LD) is assertable without a browser. usePageMeta is only the
 * applier.
 */
export function buildHeadPatch({
  title,
  description = DEFAULT_DESCRIPTION,
  path = '/',
  image = '/og-image.png',
  noindex = false,
  jsonLd = null,
  jsonLdId = 'hakum-jsonld',
} = {}) {
  const fullTitle = buildDocumentTitle(title)
  const url = absoluteUrl(canonicalPath(path))
  const ogImage = absoluteUrl(image)
  return {
    title: fullTitle,
    canonical: url,
    robots: noindex ? 'noindex,nofollow' : 'index,follow',
    meta: [
      { attr: 'name', key: 'description', content: description },
      { attr: 'property', key: 'og:title', content: fullTitle },
      { attr: 'property', key: 'og:description', content: description },
      { attr: 'property', key: 'og:type', content: 'website' },
      { attr: 'property', key: 'og:url', content: url },
      { attr: 'property', key: 'og:image', content: ogImage },
      { attr: 'property', key: 'og:site_name', content: SITE },
      { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
      { attr: 'name', key: 'twitter:title', content: fullTitle },
      { attr: 'name', key: 'twitter:description', content: description },
      { attr: 'name', key: 'twitter:image', content: ogImage },
      // The in-store TV board is a content-free display; keep it out of the index.
      { attr: 'name', key: 'robots', content: noindex ? 'noindex,nofollow' : 'index,follow' },
    ],
    links: [{ rel: 'canonical', href: url }],
    jsonLd,
    jsonLdId,
  }
}

/** Client-side document title + Open Graph + canonical + JSON-LD (SPA). */
export function usePageMeta({
  title,
  description,
  path,
  image,
  noindex,
  jsonLd = null,
  jsonLdId = 'hakum-jsonld',
} = {}) {
  useEffect(() => {
    const patch = buildHeadPatch({ title, description, path, image, noindex, jsonLd, jsonLdId })
    document.title = patch.title
    for (const entry of patch.meta) upsertMeta(entry.attr, entry.key, entry.content)
    for (const link of patch.links) upsertLink(link.rel, link.href)
    if (patch.jsonLd) upsertJsonLd(patch.jsonLd, jsonLdId)
  }, [title, description, path, image, noindex, jsonLd, jsonLdId])
}

export { SITE, DEFAULT_DESCRIPTION }