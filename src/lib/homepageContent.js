function resultState(item, error) {
  if (error) return { status: 'error', item: null, error }
  return { status: item ? 'ready' : 'empty', item, error: null }
}

/* "5-year PPF warranty for manufacturer defects only" -> 5. The qualifier stays
   on the card as fine print; only the number is pulled out for the value row. */
export function ppfWarrantyYears(warrantyLine) {
  const match = /(\d+)\s*-?\s*year/i.exec(String(warrantyLine || ''))
  return match ? Number(match[1]) : null
}

/* Panel replacement rides along with the warranty figure rather than taking its
   own slot — Basic has none, and a fourth column reading "Not included" spends
   the row's most valuable space saying nothing. */
function replacementNote(clauses = []) {
  const panels = /(\d+)\s*-?\s*panel/i.exec(clauses[0] || '')
  return panels ? `+ ${panels[1]} panels` : ''
}

/* "7.5 mil premium-grade PPF" -> "7.5". The grade is the same on every tier, so
   only the number distinguishes them. */
function filmMil(thickness) {
  const match = /([\d.]+)\s*mil/i.exec(String(thickness || ''))
  return match ? match[1] : String(thickness || '')
}

/**
 * Homepage PPF cards. Each tier reduces to three figures that escalate down the
 * ladder — 4/13/16 areas, 7.5/8.5 mil, 5/8 years — because a buyer at this price
 * scans for the step up rather than reading three similar paragraphs. Everything
 * shared across the tiers (self-healing film, hydrophobic finish, the free
 * coatings) is stated once in the section intro instead of on every row.
 */
export function buildPpfPackageCards(packages = []) {
  return packages.map((item, index) => ({
    id: item.id,
    number: String(index + 1).padStart(2, '0'),
    title: item.title,
    subtitle: item.subtitle,
    description: item.shortDescription,
    coverageType: item.coverageType,
    coverageCount: item.coverageAreas.length,
    thickness: item.filmThickness,
    warrantySummary: item.warranty[0] || '',
    warrantyYears: ppfWarrantyYears(item.warranty[0]),
    headline: item.headline,
    coverageAreas: item.coverageAreas,
    enhancements: item.keyEnhancements,
    detailsId: `ppf-package-details-${item.id}`,
    figures: [
      { value: String(item.coverageAreas.length), unit: '', label: 'Areas covered', note: '' },
      { value: filmMil(item.filmThickness), unit: 'mil', label: 'Film thickness', note: '' },
      {
        value: String(ppfWarrantyYears(item.warranty[0]) || ''),
        unit: 'yr',
        label: 'Warranty',
        note: replacementNote(item.replacementClause),
      },
    ],
    recommendedLabel: item.recommendedLabel,
    /* Every tier carries a badge, but only one row gets the visual emphasis —
       highlighting two of three is the same as highlighting none. */
    isHighlighted: Boolean(item.isHighlighted),
    ctaLabel: item.ctaLabel,
    bookingState: {
      service: 'Paint Protection Film',
      package: item.title,
      packageId: item.id,
      coverageType: item.coverageType,
      filmThickness: item.filmThickness,
    },
  }))
}

/**
 * Homepage ceramic coating cards. The panel front sells the warranty; `copy`
 * and `includes` move behind a "Know more" disclosure so the card stops reading
 * like a poster and starts reading like an offer.
 */
export function buildCeramicPackageCards(packages = []) {
  return packages.map((item) => ({
    id: item.id,
    title: item.title,
    warrantyYears: item.warrantyYears,
    pitch: item.pitch,
    copy: item.copy,
    includes: item.includes,
    image: item.bgImage,
    imageAlt: `${item.title} ceramic coating package`,
    detailsId: `ceramic-package-details-${item.id}`,
    ctaLabel: `Book ${item.title.toLowerCase()} ceramic coating`,
    bookingState: {
      service: 'Ceramic Coating',
      package: `${item.title} Ceramic Coating`,
      packageId: `ceramic-${item.id}`,
    },
  }))
}

export function mapBlogToHybridCard(row) {
  if (!row) return null
  const external = String(row.external_url || '').trim()
  return {
    id: row.id,
    kind: 'post',
    title: row.title,
    excerpt: row.excerpt || '',
    mediaUrl: row.cover_url || '',
    href: external || (row.slug ? `/blog/${row.slug}` : '/blog'),
    platform: external ? 'Instagram' : 'Hakum Blog',
    ctaLabel: 'Read post',
    date: row.published_at || null,
  }
}

export function mapEventToHybridCard(row) {
  if (!row) return null
  const branch = String(row.branch || '').trim()
  return {
    id: row.id,
    kind: 'event',
    title: row.title,
    excerpt: row.description || '',
    mediaUrl: row.banner_url || '',
    href: row.slug ? `/events/${row.slug}` : '/events',
    platform: branch ? branch.charAt(0).toUpperCase() + branch.slice(1) : 'Hakum',
    ctaLabel: 'Event details',
    date: row.is_date_tba ? null : row.starts_at || null,
    dateLabel: row.is_date_tba ? 'To be announced' : '',
  }
}

export async function loadHomepageContent(client) {
  const [blogsResult, eventsResult] = await Promise.all([
    client
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, published_at, external_url')
      .eq('is_published', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1),
    client
      .from('events')
      .select('id, title, slug, description, starts_at, banner_url, branch, is_date_tba')
      .eq('is_published', true)
      .order('starts_at', { ascending: true })
      .limit(1),
  ])

  return {
    post: resultState(mapBlogToHybridCard(blogsResult.data?.[0]), blogsResult.error),
    event: resultState(mapEventToHybridCard(eventsResult.data?.[0]), eventsResult.error),
  }
}
