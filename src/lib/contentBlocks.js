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
export function normalizeBlogTags(rawTags) {
  const list = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === 'string'
      ? rawTags.split(',')
      : []
  const seen = new Set()
  const out = []
  for (const item of list) {
    const cleaned = String(item || '').trim().toLowerCase().replace(/\s+/g, ' ')
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
  }
  return out.slice(0, 12)
}

export function extractContentMeta(itemOrBlocks = {}) {
  const isBlocksArray = Array.isArray(itemOrBlocks)
  const item = isBlocksArray ? { content_blocks: itemOrBlocks } : itemOrBlocks || {}
  const firstMeta = item?.content_blocks?.[0]?.post_meta || {}
  const region = item?.region || firstMeta.region || 'all'
  const regionOption = BLOG_REGION_OPTIONS.find((r) => r.value === region)
  const isFeatured = Boolean(
    item?.is_featured ?? item?.featured ?? firstMeta.is_featured ?? firstMeta.featured ?? false,
  )
  const tags = normalizeBlogTags(
    Array.isArray(item?.tags) && item.tags.length ? item.tags : firstMeta.tags || [],
  )
  return {
    category: item?.category || firstMeta.category || 'Regional Authority Guide',
    region,
    regionLabel:
      item?.regionLabel ||
      firstMeta.regionLabel ||
      (region !== 'all' ? regionOption?.label || region : '') ||
      '',
    tags,
    ai_summary: item?.ai_summary || firstMeta.ai_summary || '',
    read_minutes: Number(item?.read_minutes || firstMeta.read_minutes) || 0,
    is_featured: isFeatured,
    featured: isFeatured,
    seo_title: item?.seo_title || firstMeta.seo_title || '',
    seo_description: item?.seo_description || firstMeta.seo_description || '',
    seo_keywords: item?.seo_keywords || firstMeta.seo_keywords || '',
    canonical_url: item?.canonical_url || firstMeta.canonical_url || '',
    og_image_url: item?.og_image_url || firstMeta.og_image_url || '',
    noindex: Boolean(item?.noindex ?? firstMeta.noindex ?? false),
    template_key: item?.template_key || firstMeta.template_key || '',
  }
}

/** Attach extended metadata onto block[0].post_meta so it persists in Supabase content_blocks jsonb */
export function attachContentMeta(blocks = [], meta = {}) {
  const normalized = normalizeBlocks(blocks)
  const list = normalized.length ? normalized : [emptyBlock('paragraph')]
  const isFeatured = Boolean(meta.is_featured ?? meta.featured)
  const tags = normalizeBlogTags(meta.tags)
  const cleanMeta = {
    category: String(meta.category || 'Regional Authority Guide').trim(),
    region: String(meta.region || 'all').trim(),
    regionLabel: String(meta.regionLabel || '').trim(),
    tags,
    ai_summary: String(meta.ai_summary || '').trim(),
    read_minutes: Number(meta.read_minutes) || 0,
    is_featured: isFeatured,
    featured: isFeatured,
    seo_title: String(meta.seo_title || '').trim(),
    seo_description: String(meta.seo_description || '').trim(),
    seo_keywords: String(meta.seo_keywords || '').trim(),
    canonical_url: String(meta.canonical_url || '').trim(),
    og_image_url: String(meta.og_image_url || '').trim(),
    noindex: Boolean(meta.noindex),
    template_key: String(meta.template_key || '').trim(),
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

/** WordPress-style one-click blog article format templates. */
export const BLOG_POST_TEMPLATES = [
  {
    key: 'local-authority-guide',
    label: 'Branch & Local SEO Guide',
    summary: 'Structured local guide for Bacoor, Imus, Cavite, or Batangas drivers.',
    category: 'Regional Authority Guide',
    tags: ['car wash', 'auto detailing', 'philippines'],
    blocks: [
      { type: 'heading', level: 2, text: 'Why drivers in this corridor choose a studio over a roadside wash' },
      { type: 'paragraph', text: 'Explain local road dust, ultraviolet sun exposure, and rainwater mineral spotting. Link drivers naturally to [Hakum Branches](/branches) and our [Live Queue](/queue).' },
      { type: 'callout', tone: 'summary', title: 'Studio Standard Highlights', text: 'Two-bucket pH-neutral contact wash, enclosed dust-controlled curing bays, and digital clear-coat depth checks.' },
      { type: 'heading', level: 2, text: 'Core services available inside the studio' },
      { type: 'list', ordered: false, items: [
        'Swirl-safe [pH-Neutral Wash & Detailing](/services/wash-detailing)',
        '[Kisho 9H Ceramic Coating](/services/ceramic) with calibrated paint correction',
        '[ClearPro Self-Healing PPF](/services/ppf) and [Nano Ceramic Tint](/services/tint)',
      ] },
      { type: 'quote', text: 'True gloss starts with safe washing and disciplined decontamination before a single coat goes on.', cite: 'Hakum Technical Bay' },
      { type: 'cta', label: 'Book Your Bay Slot', url: '/book', style: 'primary' },
    ],
  },
  {
    key: 'service-comparison',
    label: 'Service / Cost Comparison',
    summary: 'Helps customers decide between PPF, Ceramic Coating, Tint, or Detailing packages.',
    category: 'Paint & Ceramic Craft',
    tags: ['ppf', 'ceramic coating', 'comparison'],
    blocks: [
      { type: 'heading', level: 2, text: 'What problem does each paint protection layer actually solve?' },
      { type: 'paragraph', text: 'Compare impact protection (**ClearPro TPU PPF**) against chemical/UV gloss resistance (**Kisho 9H Ceramic Coating**) for daily Philippine driving.' },
      { type: 'callout', tone: 'pricing', title: 'Decision Shortcut', text: 'Choose **PPF** for highway rock chips and leading edges; choose **Ceramic Coating** for hydrophobic gloss and easy washing—or layer both for maximum defense.' },
      { type: 'heading', level: 2, text: 'Side-by-side durability and maintenance breakdown' },
      { type: 'list', ordered: true, items: [
        'Stone-chip defense: [ClearPro PPF](/services/ppf) absorbs gravel impacts via self-healing urethane.',
        'Gloss & wash ease: [Kisho 9H Ceramic](/services/ceramic) repels mud, bird droppings, and acid rain.',
        'Heat rejection: pair exterior film with [Nano Ceramic Window Tint](/services/tint).',
      ] },
      { type: 'cta', label: 'Compare & Book Protection', url: '/book', style: 'primary' },
    ],
  },
  {
    key: 'before-after-story',
    label: 'Before & After Transformation',
    summary: 'Showcase real bay work with gallery frames, process steps, and vehicle story.',
    category: 'Studio News & Promos',
    tags: ['paint correction', 'before and after', 'transformation'],
    blocks: [
      { type: 'heading', level: 2, text: 'Incoming inspection: clear-coat defects and contamination check' },
      { type: 'paragraph', text: 'Describe the vehicle make, model, mileage, and incoming paint condition under calibrated multi-kelvin inspection lighting.' },
      { type: 'gallery', columns: 2, caption: 'Studio bay progress: inspection vs finished gloss', images: [] },
      { type: 'heading', level: 2, text: 'Step-by-step bay workflow' },
      { type: 'list', ordered: true, items: [
        'Iron fallout, tar removal, and fine clay decontamination',
        'Measured **Rupes** & **Menzerna** machine correction passes',
        'IPA wipe-down and dust-controlled coating or film installation',
      ] },
      { type: 'cta', label: 'Schedule a Paint Inspection', url: '/book', style: 'primary' },
    ],
  },
  {
    key: 'car-care-howto',
    label: 'Car Care How-To Guide',
    summary: 'Actionable maintenance playbook that prevents swirl marks and hard water etching.',
    category: 'Car Wash Science',
    tags: ['car care', 'how to', 'ph neutral wash'],
    blocks: [
      { type: 'heading', level: 2, text: 'Why common car wash habits ruin factory clear coat' },
      { type: 'paragraph', text: 'Explain how circular dish-soap scrubbing creates permanent **micro-marring** and water-spot etching under noon sun.' },
      { type: 'heading', level: 2, text: 'Five steps to maintain ceramic or waxed paint safely' },
      { type: 'list', ordered: true, items: [
        'Pre-rinse thoroughly and apply **pH-neutral snow foam** before touching paint.',
        'Wash top-to-bottom using two buckets with grit guards.',
        'Use dedicated microfiber towels for paint vs lower rockers and wheels.',
        'Dry immediately with high-GSM plush microfiber or filtered air.',
        'Visit our [Live Queue](/queue) for studio maintenance washes between detailing visits.',
      ] },
      { type: 'callout', tone: 'tip', title: 'Studio Maintenance Tip', text: 'Avoid parking wet panels under direct noon sun or automatic bristle brushes.' },
      { type: 'cta', label: 'See Car Wash & Detailing Options', url: '/services/wash-detailing', style: 'primary' },
    ],
  },
]

export function slugifyAnchor(text = '', fallback = 'section') {
  return (
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || fallback
  )
}

/** Extract heading outline for WordPress-style Table of Contents navigation. */
export function extractTableOfContents(blocks = []) {
  const rows = normalizeBlocks(blocks)
  const used = new Map()
  const out = []
  for (const b of rows) {
    if (b.type !== 'heading') continue
    const text = String(b.text || '').trim()
    if (!text) continue
    const level = Number(b.level) >= 3 ? 3 : 2
    const base = slugifyAnchor(text, `sec-${out.length + 1}`)
    const count = (used.get(base) || 0) + 1
    used.set(base, count)
    const anchor = count > 1 ? `${base}-${count}` : base
    out.push({ id: b.id, anchor, level, text })
  }
  return out
}

function isSafeRichUrl(rawUrl) {
  const u = String(rawUrl || '').trim()
  if (!u) return false
  if (u.startsWith('/') && !u.startsWith('//')) return true
  return /^https?:\/\/[^\s]+$/i.test(u)
}

/**
 * Parse safe inline Markdown-lite formatting (**bold**, *italic*, `code`, [text](url))
 * into immutable AST segments for XSS-free React rendering.
 */
export function parseInlineRichText(input = '') {
  const str = String(input || '')
  if (!str) return []
  const tokenRe = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  const out = []
  let lastIndex = 0
  let match

  while ((match = tokenRe.exec(str)) !== null) {
    if (match.index > lastIndex) {
      out.push({ type: 'text', text: str.slice(lastIndex, match.index) })
    }
    if (match[2] !== undefined && match[3] !== undefined) {
      const label = match[2]
      const href = match[3].trim()
      if (isSafeRichUrl(href)) {
        out.push({ type: 'link', text: label, href, isInternal: href.startsWith('/') })
      } else {
        out.push({ type: 'text', text: label })
      }
    } else if (match[4] !== undefined) {
      out.push({ type: 'bold', text: match[4] })
    } else if (match[5] !== undefined) {
      out.push({ type: 'italic', text: match[5] })
    } else if (match[6] !== undefined) {
      out.push({ type: 'code', text: match[6] })
    }
    lastIndex = tokenRe.lastIndex
  }

  if (lastIndex < str.length) {
    out.push({ type: 'text', text: str.slice(lastIndex) })
  }
  return out
}

/** Count internal Hakum links inside paragraph, list, callout, and CTA blocks. */
export function extractInternalLinks(blocks = []) {
  const rows = normalizeBlocks(blocks)
  const links = new Set()
  const collectFromText = (val) => {
    for (const seg of parseInlineRichText(val)) {
      if (seg.type === 'link' && seg.isInternal) links.add(seg.href)
    }
  }
  for (const b of rows) {
    if (b.text) collectFromText(b.text)
    if (Array.isArray(b.items)) b.items.forEach(collectFromText)
    if (b.type === 'cta' && b.url && String(b.url).startsWith('/')) {
      links.add(String(b.url).trim())
    }
  }
  return [...links]
}
