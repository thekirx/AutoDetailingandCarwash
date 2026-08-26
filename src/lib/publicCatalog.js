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

export function buildPublicServiceOverview(rows) {
  return (rows || []).map(enrichPublicCatalogService)
}

export function publicPackageOverview() {
  return {
    ceramic: ceramicPackages.map((item) => item.title),
    ppf: PPF_PACKAGES.map((item) => item.title),
  }
}
