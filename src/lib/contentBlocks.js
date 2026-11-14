/** WordPress-like content blocks & metadata helpers for blogs & events */

export const BLOCK_TYPES = [
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'image', label: 'Image / Photo' },
  { value: 'gallery', label: 'Photo Gallery' },
  { value: 'callout', label: 'Callout / Key Box' },
  { value: 'video', label: 'Video' },
  { value: 'quote', label: 'Quote' },
  { value: 'list', label: 'List' },
  { value: 'divider', label: 'Divider' },
  { value: 'cta', label: 'Button / CTA' },
]

export const BLOG_REGION_OPTIONS = [
  { value: 'all', label: 'All Branches / General' },
  { value: 'bacoor', label: 'Bacoor, Cavite' },
  { value: 'batangas', label: 'Batangas City' },
  { value: 'imus', label: 'Imus, Cavite' },
  { value: 'cavite', label: 'Cavite Province' },
  { value: 'craft', label: 'Paint & Ceramic Craft' },
]

export const BLOG_CATEGORY_OPTIONS = [
  { value: 'Regional Authority Guide', label: 'Regional Authority Guide' },
  { value: 'Paint & Ceramic Craft', label: 'Paint & Ceramic Craft' },
  { value: 'Car Wash Science', label: 'Car Wash Science' },
  { value: 'Community & Meets', label: 'Community & Meets' },
  { value: 'Studio News & Promos', label: 'Studio News & Promos' },
]

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8)
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export function slugifyContentTitle(title, id = '') {
  const base = String(title || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'post'
  const suffix = String(id || '').replace(/-/g, '').slice(0, 8)
  return suffix ? `${base}-${suffix}` : base
}

export function emptyBlock(type = 'paragraph') {
  const id = uid()
  if (type === 'heading') return { id, type, level: 2, text: '' }
  if (type === 'image') return { id, type, url: '', alt: '', caption: '', layout: 'normal', aspect: 'auto' }
  if (type === 'gallery') return { id, type, columns: 2, caption: '', images: [] }
  if (type === 'callout') return { id, type, tone: 'tip', title: 'Studio Note', text: '' }
  if (type === 'video') return { id, type, url: '', provider: 'auto', caption: '' }
  if (type === 'quote') return { id, type, text: '', cite: '' }
  if (type === 'list') return { id, type, ordered: false, items: [''] }
  if (type === 'divider') return { id, type }
  if (type === 'cta') return { id, type, label: 'Learn more', url: '', form_id: '', style: 'primary' }
  return { id, type: 'paragraph', text: '' }
}

export function normalizeBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((raw) => {
    const type = BLOCK_TYPES.some((t) => t.value === raw?.type) ? raw.type : 'paragraph'
    const id = String(raw?.id || uid())
    const postMetaPatch = raw?.post_meta && typeof raw.post_meta === 'object' ? { post_meta: raw.post_meta } : {}

    if (type === 'heading') {
      const level = [1, 2, 3].includes(Number(raw.level)) ? Number(raw.level) : 2
      return { id, type, level, text: String(raw.text || ''), ...postMetaPatch }
    }
    if (type === 'image') {
      const layout = ['normal', 'wide', 'full'].includes(raw.layout) ? raw.layout : 'normal'
      const aspect = ['auto', '16:9', '4:3', '1:1'].includes(raw.aspect) ? raw.aspect : 'auto'
      return {
        id,
        type,
        url: String(raw.url || '').trim(),
        alt: String(raw.alt || '').trim(),
        caption: String(raw.caption || '').trim(),
        layout,
        aspect,
        ...postMetaPatch,
      }
    }
    if (type === 'gallery') {
      const columns = [2, 3, 4].includes(Number(raw.columns)) ? Number(raw.columns) : 2
      const images = (Array.isArray(raw.images) ? raw.images : [])
        .map((img) => ({
          id: String(img?.id || uid()),
          url: String(img?.url || '').trim(),
          alt: String(img?.alt || '').trim(),
          caption: String(img?.caption || '').trim(),
        }))
        .filter((img) => Boolean(img.url))
      return {
        id,
        type,
        columns,
        caption: String(raw.caption || '').trim(),
        images,
        ...postMetaPatch,
      }
    }
    if (type === 'callout') {
      const tone = ['tip', 'summary', 'pricing', 'note'].includes(raw.tone) ? raw.tone : 'tip'
      return {
        id,
        type,
        tone,
        title: String(raw.title || '').trim(),
        text: String(raw.text || ''),
        ...postMetaPatch,
      }
    }
    if (type === 'video') {
      return {
        id,
        type,
        url: String(raw.url || '').trim(),
        provider: String(raw.provider || 'auto'),
        caption: String(raw.caption || '').trim(),
        ...postMetaPatch,
      }
    }
    if (type === 'quote') {
      return { id, type, text: String(raw.text || ''), cite: String(raw.cite || ''), ...postMetaPatch }
    }
    if (type === 'list') {
      const items = Array.isArray(raw.items)
        ? raw.items.map((s) => String(s || '').trim()).filter(Boolean)
        : String(raw.itemsText || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
      return { id, type, ordered: Boolean(raw.ordered), items: items.length ? items : [''], ...postMetaPatch }
    }
    if (type === 'divider') return { id, type, ...postMetaPatch }
    if (type === 'cta') {
      return {
        id,
        type,
        label: String(raw.label || 'Learn more').trim() || 'Learn more',
        url: String(raw.url || '').trim(),
        form_id: String(raw.form_id || '').trim(),
        style: raw.style === 'secondary' ? 'secondary' : 'primary',
        ...postMetaPatch,
      }
    }
    return { id, type: 'paragraph', text: String(raw.text || ''), ...postMetaPatch }
  })
}

/** Extract blog/event extended metadata stored either at top-level or on block[0].post_meta */
export function extractContentMeta(itemOrBlocks = {}) {
  const isBlocksArray = Array.isArray(itemOrBlocks)
  const item = isBlocksArray ? { content_blocks: itemOrBlocks } : itemOrBlocks || {}
  const firstMeta = item?.content_blocks?.[0]?.post_meta || {}
  const region = item?.region || firstMeta.region || 'all'
  const regionOption = BLOG_REGION_OPTIONS.find((r) => r.value === region)
  const isFeatured = Boolean(
    item?.is_featured ?? item?.featured ?? firstMeta.is_featured ?? firstMeta.featured ?? false,
  )
  return {
    category: item?.category || firstMeta.category || 'Regional Authority Guide',
    region,
    regionLabel:
      item?.regionLabel ||
      firstMeta.regionLabel ||
      (region !== 'all' ? regionOption?.label || region : '') ||
      '',
    ai_summary: item?.ai_summary || firstMeta.ai_summary || '',
    read_minutes: Number(item?.read_minutes || firstMeta.read_minutes) || 0,
    is_featured: isFeatured,
    featured: isFeatured,
    seo_title: item?.seo_title || firstMeta.seo_title || '',
    seo_description: item?.seo_description || firstMeta.seo_description || '',
  }
}

/** Attach extended metadata onto block[0].post_meta so it persists in Supabase content_blocks jsonb */
export function attachContentMeta(blocks = [], meta = {}) {
  const normalized = normalizeBlocks(blocks)
  const list = normalized.length ? normalized : [emptyBlock('paragraph')]
  const isFeatured = Boolean(meta.is_featured ?? meta.featured)
  const cleanMeta = {
    category: String(meta.category || 'Regional Authority Guide').trim(),
    region: String(meta.region || 'all').trim(),
    regionLabel: String(meta.regionLabel || '').trim(),
    ai_summary: String(meta.ai_summary || '').trim(),
    read_minutes: Number(meta.read_minutes) || 0,
    is_featured: isFeatured,
    featured: isFeatured,
    seo_title: String(meta.seo_title || '').trim(),
    seo_description: String(meta.seo_description || '').trim(),
  }
  return list.map((block, index) => (index === 0 ? { ...block, post_meta: cleanMeta } : block))
}

/** Compute live reading statistics for the WordPress-style status bar */
export function estimateReadingStats(blocks = [], title = '', excerpt = '') {
  const normalized = normalizeBlocks(blocks)
  const chunks = [title, excerpt]
  for (const b of normalized) {
    if (b.text) chunks.push(b.text)
    if (b.title) chunks.push(b.title)
    if (b.caption) chunks.push(b.caption)
    if (Array.isArray(b.items)) chunks.push(b.items.join(' '))
  }
  const fullText = chunks.filter(Boolean).join(' ').trim()
  const words = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0
  const characters = fullText.length
  const readMinutes = Math.max(1, Math.ceil(words / 180))
  return {
    words,
    characters,
    blockCount: normalized.length,
    readMinutes,
    minutes: readMinutes,
  }
}

/** Extract YouTube/Vimeo embed URL when possible; otherwise return original for <video src>. */
export function resolveVideoEmbed(url) {
  const raw = String(url || '').trim()
  if (!raw) return null
  const yt =
    raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/) ||
    raw.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/)
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vim = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vim) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vim[1]}` }
  if (/\.(mp4|webm)(\?|$)/i.test(raw)) return { kind: 'file', src: raw }
  return { kind: 'link', src: raw }
}

export function sampleBlogBlocks() {
  return normalizeBlocks([
    { type: 'heading', level: 2, text: 'Heat, salt air, and daily wash cycles' },
    { type: 'paragraph', text: 'Metro and coastal cars take a beating. Ceramic is not a magic spray. It is prep, product, and discipline.' },
    { type: 'cta', label: 'Book a visit', url: '/book', style: 'primary' },
  ])
}
