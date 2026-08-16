function resultState(item, error) {
  if (error) return { status: 'error', item: null, error }
  return { status: item ? 'ready' : 'empty', item, error: null }
}

export function buildPpfPackageCards(packages = []) {
  return packages.map((item, index) => ({
    id: item.id,
    number: String(index + 1).padStart(2, '0'),
    title: item.title,
    subtitle: item.subtitle,
    description: item.shortDescription,
    coverageType: item.coverageType,
    coverageAreas: [...item.coverageAreas],
    thickness: item.filmThickness,
    enhancements: [...item.keyEnhancements],
    benefits: [...item.filmBenefits],
    warranty: [...item.warranty],
    replacementClause: [...item.replacementClause],
    freeAddOns: [...item.freeAddOns],
    recommendedLabel: item.recommendedLabel,
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

export function mapBlogToHybridCard(row) {
  if (!row) return null
  return {
    id: row.id,
    kind: 'post',
    title: row.title,
    excerpt: row.excerpt || '',
    mediaUrl: row.cover_url || '',
    href: row.slug ? `/blog/${row.slug}` : '/blog',
    platform: 'Hakum Blog',
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
    date: row.starts_at || null,
  }
}

export async function loadHomepageContent(client) {
  const [blogsResult, eventsResult] = await Promise.all([
    client
      .from('blogs')
      .select('id, title, slug, excerpt, cover_url, published_at')
      .eq('is_published', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(1),
    client
      .from('events')
      .select('id, title, slug, description, starts_at, banner_url, branch')
      .eq('is_published', true)
      .order('starts_at', { ascending: true })
      .limit(1),
  ])

  return {
    post: resultState(mapBlogToHybridCard(blogsResult.data?.[0]), blogsResult.error),
    event: resultState(mapEventToHybridCard(eventsResult.data?.[0]), eventsResult.error),
  }
}
