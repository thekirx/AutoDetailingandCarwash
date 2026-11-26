import { useEffect, useLayoutEffect } from 'react'
import { BRANCH_MAP_LISTINGS } from './homeBranches.js'

const SITE = 'Hakum Auto Care'
const PRODUCTION_ORIGIN = 'https://www.hakumautocare.com'
const DEFAULT_DESCRIPTION =
  'Swirl-free two-bucket car wash, auto detailing, Kisho 9H ceramic coating & ClearPro PPF in Bacoor, Imus, Dasmariñas, Cavite & Batangas City.'

const VERIFIED_SOCIAL_PROFILES = [
  'https://www.facebook.com/profile.php?id=61573318005308',
  'https://www.facebook.com/share/1GHerg8pxV/',
  'https://www.instagram.com/_hakumautocare',
  'https://www.tiktok.com/@hakum_autocare',
]

function absoluteUrl(path = '/', origin) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : PRODUCTION_ORIGIN)
  if (!path || path === '/') return `${base}/`
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
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
  origin,
} = {}) {
  const coreOfferCatalog = {
    '@type': 'OfferCatalog',
    name: 'Automotive Detailing, Paint Protection & Car Wash Services',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Signature pH-Neutral Car Wash' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Deep Interior & Exterior Auto Detailing' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Multi-Stage Paint Correction' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Kisho Ceramic Coating' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'ClearPro Paint Protection Film (PPF)' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Nano Ceramic Window Tint' } },
    ],
  }

  const serviceArea = [
    { '@type': 'City', name: 'Bacoor' },
    { '@type': 'City', name: 'Imus' },
    { '@type': 'AdministrativeArea', name: 'Cavite' },
    { '@type': 'City', name: 'Batangas City' },
    { '@type': 'AdministrativeArea', name: 'Batangas' },
    { '@type': 'Country', name: 'Philippines' },
  ]

  const nodes = branches.map((b) => {
    // A branch that has not opened yet publishes an empty specification rather
    // than the defaults the hours table happens to carry.
    const hours = b.coming_soon ? [] : openingHoursSpecification(hoursBySlug[b.slug] || [])
    const mapInfo = BRANCH_MAP_LISTINGS[b.slug]
    const lat = Number.isFinite(Number(b.latitude)) ? Number(b.latitude) : mapInfo?.lat
    const lng = Number.isFinite(Number(b.longitude)) ? Number(b.longitude) : mapInfo?.lng
    const hasMapUrl = mapInfo?.cid ? `https://www.google.com/maps?cid=${mapInfo.cid}` : undefined
    const canonicalBranchUrl = ['bacoor', 'batangas', 'imus', 'dasmarinas', 'cavite'].includes(b.slug)
      ? absoluteUrl(`/branches/${b.slug}`, origin)
      : absoluteUrl(`/branches#${b.slug}`, origin)

    return {
      '@type': 'AutomotiveBusiness',
      additionalType: 'https://schema.org/AutoWash',
      '@id': `${absoluteUrl('/', origin)}#${b.slug}`,
      name: `${SITE} ${publicName(b)}`.trim(),
      url: canonicalBranchUrl,
      image: absoluteUrl('/og-image.png', origin),
      areaServed,
      serviceArea,
      hasOfferCatalog: coreOfferCatalog,
      ...(hasMapUrl ? { hasMap: hasMapUrl } : {}),
      ...(lat != null && lng != null
        ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } }
        : {}),
      ...(b.coming_soon || hours.length ? { openingHoursSpecification: hours } : {}),
      ...(b.address
        ? {
            address: {
              '@type': 'PostalAddress',
              addressLocality: publicName(b),
              addressCountry: 'PH',
              streetAddress: b.address,
            },
          }
        : {}),
      ...(b.phone ? { telephone: b.phone } : { telephone }),
      sameAs: [...VERIFIED_SOCIAL_PROFILES, ...(hasMapUrl ? [hasMapUrl] : [])],
    }
  })

  return {
    '@context': 'https://schema.org',
    '@graph': nodes.length
      ? nodes
      : [
          {
            '@type': 'AutomotiveBusiness',
            additionalType: 'https://schema.org/AutoWash',
            name: SITE,
            areaServed,
            serviceArea,
            hasOfferCatalog: coreOfferCatalog,
            telephone,
          },
        ],
  }
}

/** Site-level graph: what the org is, and what the domain represents. */
export function buildSiteJsonLd({
  areaServed = ['Philippines', 'Cavite', 'Bacoor', 'Imus', 'Batangas'],
  origin,
} = {}) {
  const baseUrl = absoluteUrl('/', origin)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}#organization`,
        name: SITE,
        alternateName: 'Hakum Automotive Care',
        description: DEFAULT_DESCRIPTION,
        url: baseUrl,
        telephone: '+639156296096',
        areaServed,
        knowsAbout: [
          'Car Wash',
          'Auto Detailing',
          'Paint Protection Film (PPF)',
          'Ceramic Coating',
          'Paint Correction',
          'Window Tint',
        ],
        sameAs: VERIFIED_SOCIAL_PROFILES,
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/icon-512.png', origin),
          contentUrl: absoluteUrl('/icon-512.png', origin),
          width: 512,
          height: 512,
        },
        image: absoluteUrl('/og-image.png', origin),
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}#website`,
        url: baseUrl,
        name: SITE,
        inLanguage: 'en-PH',
        description: DEFAULT_DESCRIPTION,
        publisher: { '@id': `${baseUrl}#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}blog?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

export function buildBreadcrumbJsonLd(items = [], origin) {
  const baseUrl = String(origin || PRODUCTION_ORIGIN).replace(/\/$/, '')
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => {
      const path = canonicalPath(item.path || '/')
      return {
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: path === '/' ? `${baseUrl}/` : `${baseUrl}${path}`,
      }
    }),
  }
}

/** Structured Service + FAQ + Breadcrumb graph for service landing pages (strictly fact-based). */
export function buildServicePageJsonLd({
  slug,
  name,
  description,
  faqs = [],
  image = '/og-image.png',
  origin,
} = {}) {
  const baseUrl = String(origin || PRODUCTION_ORIGIN).replace(/\/$/, '')
  const pagePath = slug ? `/services/${slug}` : '/services'
  const pageUrl = `${baseUrl}${pagePath}`
  const graph = [
    {
      '@type': 'Service',
      '@id': `${pageUrl}#service`,
      name: String(name || 'Hakum Auto Care Service'),
      serviceType: String(name || 'Automotive Detailing'),
      description: String(description || DEFAULT_DESCRIPTION),
      url: pageUrl,
      image: image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`,
      provider: { '@id': `${baseUrl}/#organization` },
      areaServed: [
        { '@type': 'City', name: 'Bacoor' },
        { '@type': 'City', name: 'Imus' },
        { '@type': 'AdministrativeArea', name: 'Cavite' },
        { '@type': 'City', name: 'Batangas City' },
        { '@type': 'Country', name: 'Philippines' },
      ],
    },
    buildBreadcrumbJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: 'Services', path: '/services' },
        ...(slug ? [{ name: name || slug, path: pagePath }] : []),
      ],
      baseUrl,
    ),
  ]

  if (Array.isArray(faqs) && faqs.length) {
    const items = faqs
      .map((f) => ({ q: f?.question || f?.q, a: f?.answer || f?.a }))
      .filter((f) => f.q && f.a)
    if (items.length) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: items.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      })
    }
  }

  return { '@context': 'https://schema.org', '@graph': graph }
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

/** Canonical + hreflang directives, so duplicate URL forms consolidate. */
export function upsertLink(rel, href, extraAttrs = {}) {
  const selector =
    extraAttrs.hreflang != null
      ? `link[rel="${rel}"][hreflang="${extraAttrs.hreflang}"]`
      : `link[rel="${rel}"]`
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    for (const [k, v] of Object.entries(extraAttrs)) {
      if (v != null) el.setAttribute(k, String(v))
    }
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
  ogType = 'website',
  keywords = '',
  canonical = '',
  article = null,
  noindex = false,
  robots = '',
  jsonLd = null,
  jsonLdId = 'hakum-jsonld',
} = {}) {
  const fullTitle = buildDocumentTitle(title)
  const routeUrl = absoluteUrl(canonicalPath(path))
  const canonicalTrimmed = String(canonical || '').trim()
  const resolvedCanonical = canonicalTrimmed
    ? /^https?:\/\//i.test(canonicalTrimmed)
      ? canonicalTrimmed
      : absoluteUrl(canonicalPath(canonicalTrimmed))
    : routeUrl
  const ogImage = /^https?:\/\//i.test(String(image || '').trim())
    ? String(image).trim()
    : absoluteUrl(image || '/og-image.png')
  const explicitRobots = String(robots || '').trim()
  const robotsValue = explicitRobots || (noindex === 'follow' ? 'noindex,follow' : noindex ? 'noindex,nofollow' : 'index,follow')
  const isNoindex = Boolean(noindex) || /^noindex\b/i.test(robotsValue)
  const meta = [
    { attr: 'name', key: 'description', content: description },
    ...(String(keywords || '').trim() ? [{ attr: 'name', key: 'keywords', content: String(keywords).trim() }] : []),
    { attr: 'property', key: 'og:title', content: fullTitle },
    { attr: 'property', key: 'og:description', content: description },
    { attr: 'property', key: 'og:type', content: ogType === 'article' ? 'article' : 'website' },
    { attr: 'property', key: 'og:locale', content: 'en_PH' },
    { attr: 'property', key: 'og:url', content: resolvedCanonical },
    { attr: 'property', key: 'og:image', content: ogImage },
    { attr: 'property', key: 'og:site_name', content: SITE },
    { attr: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { attr: 'name', key: 'twitter:title', content: fullTitle },
    { attr: 'name', key: 'twitter:description', content: description },
    { attr: 'name', key: 'twitter:image', content: ogImage },
    // The in-store TV board, legal/account shells & /404 routes stay out of the search index.
    { attr: 'name', key: 'robots', content: robotsValue },
    ...(!isNoindex
      ? [{ attr: 'name', key: 'googlebot', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' }]
      : []),
  ]

  if (ogType === 'article' && article && typeof article === 'object') {
    if (article.publishedTime) meta.push({ attr: 'property', key: 'article:published_time', content: article.publishedTime })
    if (article.modifiedTime) meta.push({ attr: 'property', key: 'article:modified_time', content: article.modifiedTime })
    if (article.section) meta.push({ attr: 'property', key: 'article:section', content: article.section })
    if (article.author) meta.push({ attr: 'property', key: 'article:author', content: article.author })
  }

  const links = [{ rel: 'canonical', href: resolvedCanonical }]
  if (!isNoindex) {
    links.push(
      { rel: 'alternate', hreflang: 'en-PH', href: resolvedCanonical },
      { rel: 'alternate', hreflang: 'x-default', href: resolvedCanonical },
    )
  }

  return {
    title: fullTitle,
    canonical: resolvedCanonical,
    robots: robotsValue,
    isNoindex,
    meta,
    links,
    jsonLd,
    jsonLdId,
  }
}

function applyHeadPatch(options) {
  const patch = buildHeadPatch(options)
  document.title = patch.title
  for (const entry of patch.meta) upsertMeta(entry.attr, entry.key, entry.content)
  if (patch.isNoindex) {
    document.head.querySelector('meta[name="googlebot"]')?.remove()
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove())
  }
  for (const link of patch.links) {
    upsertLink(link.rel, link.href, link.hreflang ? { hreflang: link.hreflang } : {})
  }
  if (patch.jsonLd) upsertJsonLd(patch.jsonLd, options.jsonLdId)
}

/** Client-side document title + Open Graph + canonical + JSON-LD (SPA). */
export function usePageMeta({
  title,
  description,
  path,
  image,
  ogType,
  keywords,
  canonical,
  article,
  noindex,
  robots,
  jsonLd = null,
  jsonLdId = 'hakum-jsonld',
} = {}) {
  const articleKey = article ? JSON.stringify(article) : ''
  useEffect(() => {
    applyHeadPatch({
      title,
      description,
      path,
      image,
      ogType,
      keywords,
      canonical,
      article,
      noindex,
      robots,
      jsonLd,
      jsonLdId,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, image, ogType, keywords, canonical, articleKey, noindex, robots, jsonLd, jsonLdId])
}

/**
 * The public layout's site-wide defaults. Layout effects run before every
 * passive effect in the same commit, so a page's own usePageMeta always lands
 * after these and its title wins.
 */
export function useLayoutPageMeta({
  title,
  description,
  path,
  image,
  ogType,
  keywords,
  canonical,
  noindex,
  robots,
  jsonLd = null,
  jsonLdId = 'hakum-jsonld',
} = {}) {
  useLayoutEffect(() => {
    applyHeadPatch({ title, description, path, image, ogType, keywords, canonical, noindex, robots, jsonLd, jsonLdId })
  }, [title, description, path, image, ogType, keywords, canonical, noindex, robots, jsonLd, jsonLdId])
}

export { SITE, DEFAULT_DESCRIPTION }