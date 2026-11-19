import { estimateReadingStats, extractInternalLinks, normalizeBlocks } from './contentBlocks.js'

/**
 * Pure WordPress Yoast/RankMath-style On-Page SEO & AI Search (GEO) analyzer
 * for blog drafts and built-in regional guides.
 */
export function analyzeContentSeo(draft = {}) {
  const title = String(draft.title || '').trim()
  const seoTitle = String(draft.seo_title || title).trim()
  const excerpt = String(draft.excerpt || '').trim()
  const metaDesc = String(draft.seo_description || draft.ai_summary || excerpt).trim()
  const aiSummary = String(draft.ai_summary || '').trim()
  const slug = String(draft.slug || '').trim().toLowerCase()
  const rawKeywords = String(draft.seo_keywords || '').trim()
  const focusKeyword = rawKeywords.split(',')[0]?.trim().toLowerCase() || ''
  const tags = Array.isArray(draft.tags) ? draft.tags.filter(Boolean) : []
  const blocks = normalizeBlocks(draft.content_blocks)
  const stats = estimateReadingStats(blocks, title, excerpt)

  const headings = blocks.filter((b) => b.type === 'heading' && String(b.text || '').trim())
  const subHeadings = headings.filter((b) => Number(b.level) >= 2)
  const firstParagraph = String(blocks.find((b) => b.type === 'paragraph')?.text || '').toLowerCase()
  const internalLinks = extractInternalLinks(blocks)

  let totalImages = 0
  let missingAltCount = 0
  for (const b of blocks) {
    if (b.type === 'image' && b.url) {
      totalImages += 1
      if (!String(b.alt || '').trim()) missingAltCount += 1
    } else if (b.type === 'gallery' && Array.isArray(b.images)) {
      for (const img of b.images) {
        if (img.url) {
          totalImages += 1
          if (!String(img.alt || '').trim()) missingAltCount += 1
        }
      }
    }
  }

  const checks = [
    {
      id: 'seo-title-length',
      label: 'SEO Title length (30–65 chars)',
      passed: seoTitle.length >= 30 && seoTitle.length <= 65,
      warn: seoTitle.length >= 20 && seoTitle.length <= 75,
      detail: `${seoTitle.length} chars`,
      points: 15,
    },
    {
      id: 'meta-description-length',
      label: 'Meta Description length (110–160 chars)',
      passed: metaDesc.length >= 110 && metaDesc.length <= 160,
      warn: metaDesc.length >= 70 && metaDesc.length <= 175,
      detail: `${metaDesc.length} chars`,
      points: 15,
    },
    {
      id: 'focus-keyword',
      label: 'Focus Keyword in Title & Slug or Intro',
      passed: Boolean(
        focusKeyword &&
          seoTitle.toLowerCase().includes(focusKeyword) &&
          (slug.includes(focusKeyword.replace(/\s+/g, '-')) || firstParagraph.includes(focusKeyword)),
      ),
      warn: Boolean(focusKeyword && (seoTitle.toLowerCase().includes(focusKeyword) || firstParagraph.includes(focusKeyword))),
      detail: focusKeyword ? `"${focusKeyword}"` : 'Add primary keyword',
      points: 15,
    },
    {
      id: 'content-depth',
      label: 'Article depth (300+ words)',
      passed: stats.words >= 300,
      warn: stats.words >= 150,
      detail: `${stats.words} words`,
      points: 15,
    },
    {
      id: 'heading-hierarchy',
      label: 'Scannable H2 / H3 subheadings (2+)',
      passed: subHeadings.length >= 2,
      warn: subHeadings.length === 1,
      detail: `${subHeadings.length} section heading${subHeadings.length === 1 ? '' : 's'}`,
      points: 10,
    },
    {
      id: 'internal-links',
      label: 'Internal links to Hakum pages (services, branches, /book)',
      passed: internalLinks.length >= 1,
      warn: false,
      detail: `${internalLinks.length} internal link${internalLinks.length === 1 ? '' : 's'}`,
      points: 10,
    },
    {
      id: 'image-alt-text',
      label: 'Descriptive Alt Text on all photos',
      passed: missingAltCount === 0 && (Boolean(draft.cover_url) || totalImages > 0),
      warn: missingAltCount === 0,
      detail:
        totalImages === 0
          ? draft.cover_url
            ? 'Cover set (add inline photos for rich snippets)'
            : 'No cover or inline image yet'
          : missingAltCount === 0
            ? `All ${totalImages} photos have alt text`
            : `${missingAltCount} photo(s) missing alt text`,
      points: 10,
    },
    {
      id: 'ai-summary-tags',
      label: 'AI Overview Summary & Tags',
      passed: aiSummary.length >= 60 && tags.length >= 1,
      warn: aiSummary.length >= 40 || tags.length >= 1,
      detail: `${aiSummary.length >= 60 ? 'AI summary ready' : 'Short AI summary'} · ${tags.length} tag(s)`,
      points: 10,
    },
  ]

  let earned = 0
  for (const c of checks) {
    if (c.passed) earned += c.points
    else if (c.warn) earned += Math.round(c.points * 0.5)
  }

  const score = Math.max(0, Math.min(100, earned))
  const grade = score >= 80 ? 'Strong SEO' : score >= 55 ? 'Needs Polish' : 'Weak SEO'
  const tone = score >= 80 ? 'good' : score >= 55 ? 'ok' : 'poor'

  return {
    score,
    grade,
    tone,
    checks,
    metrics: {
      words: stats.words,
      readMinutes: stats.readMinutes,
      internalLinks: internalLinks.length,
      totalImages,
      missingAltCount,
      tagsCount: tags.length,
    },
  }
}
