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

/** Client-side document title + Open Graph tags (SPA; crawlers that execute JS see updates). */
export function usePageMeta({ title, description = DEFAULT_DESCRIPTION, path = '/', image = '/og-image.png' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE}` : SITE
    document.title = fullTitle

    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:url', absoluteUrl(path))
    upsertMeta('property', 'og:image', absoluteUrl(image))
    upsertMeta('property', 'og:site_name', SITE)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', absoluteUrl(image))
  }, [title, description, path, image])
}
