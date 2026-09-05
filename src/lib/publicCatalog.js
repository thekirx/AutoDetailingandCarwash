/** Public marketing catalog — service names from Inventory `services`, copy from homepage overlays. */

import { ceramicPackages, services as homepageServices } from '../data/publicHomeContent.js'
import { PPF_PACKAGES } from '../data/ppfPackages.js'

const MARKETING_SLUG_ALIASES = {
  'premium-car-wash': 'carwash',
  'car-wash': 'carwash',
  'full-exterior-detailing': 'detailing',
  'nano-ceramic-tint': 'ceramic-tint',
  'paint-protection-film': 'paint-protection-film',
  'ceramic-coating': 'ceramic-coating',
  'interior-detailing': 'interior-detailing',
  'glass-detailing': 'glass-detailing',
  'engine-wash': 'engine-wash',
  'mobile-detailing': 'mobile-detailing',
}

function titleToSlug(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const MARKETING_COPY_BY_KEY = Object.fromEntries(
  homepageServices.map((item) => [titleToSlug(item.title), item.copy]),
)

/** Inventory slug → the canonical marketing key used for copy and artwork lookups. */
export function marketingKeyForServiceSlug(slug) {
  const raw = String(slug || '').toLowerCase()
  return MARKETING_SLUG_ALIASES[raw] || raw
}

export function marketingCopyForServiceSlug(slug) {
  return MARKETING_COPY_BY_KEY[marketingKeyForServiceSlug(slug)] || ''
}

export async function fetchPublicCatalogServices() {
  const { supabase } = await import('./supabase.js')
  const { data, error } = await supabase
    .from('services')
    .select('id, name, slug, description, display_order, pay_category')
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('display_order')
  if (error) throw error
  return data || []
}

/** Inventory row → public /services card (DB name wins; homepage copy when slug matches). */
export function enrichPublicCatalogService(row) {
  const slug = String(row?.slug || '')
  const marketingCopy = marketingCopyForServiceSlug(slug)
  return {
    id: row.id,
    slug,
    title: row.name,
    copy: marketingCopy || row.description || 'Book for current pricing and availability.',
  }
}

/* Services the catalog carries for booking and the bay, but that the public
   /services list does not show: paint maintenance, and the three counter
   packages. They stay active in the catalog, stay bookable, and still price
   and ring up normally — this hides them from the marketing overview only,
   so nothing here touches operations. */
const HIDDEN_FROM_PUBLIC_OVERVIEW = new Set([
  'paint-maintenance',
  'express-wash-package',
  'full-care-package',
  'hakum-custom-package',
])

/* Matched on slug and on name: the live catalog owns its own slugs, so a
   package renamed in Inventory should still drop out of the public list. */
function isHiddenFromPublicOverview(row) {
  return (
    HIDDEN_FROM_PUBLIC_OVERVIEW.has(marketingKeyForServiceSlug(row?.slug)) ||
    HIDDEN_FROM_PUBLIC_OVERVIEW.has(titleToSlug(row?.name))
  )
}

export function buildPublicServiceOverview(rows) {
  const source = rows?.length
    ? rows
    : homepageServices
        .filter((item) => item.available !== false)
        .map((item, index) => ({
          id: `marketing-${titleToSlug(item.title)}`,
          name: item.title,
          slug: titleToSlug(item.title),
          description: item.copy,
          display_order: index + 1,
        }))

  return source.filter((row) => !isHiddenFromPublicOverview(row)).map(enrichPublicCatalogService)
}

export function publicServiceDestination(item = {}) {
  const key = marketingKeyForServiceSlug(item.slug)
  const editorialRoutes = {
    'paint-protection-film': '/services/ppf',
    'ceramic-coating': '/services/ceramic',
    'ceramic-tint': '/services/tint',
  }

  if (editorialRoutes[key]) return { to: editorialRoutes[key] }
  if (key === 'carwash') return { to: '/queue' }

  return {
    to: '/book',
    state: { service: item.title, service_id: item.id },
  }
}

export function publicPackageOverview() {
  return {
    ceramic: ceramicPackages.map((item) => item.title),
    ppf: PPF_PACKAGES.map((item) => item.title),
  }
}
