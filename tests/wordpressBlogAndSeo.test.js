import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  BLOG_POST_TEMPLATES,
  attachContentMeta,
  extractContentMeta,
  extractInternalLinks,
  extractTableOfContents,
  normalizeBlogTags,
  parseInlineRichText,
} from '../src/lib/contentBlocks.js'
import { analyzeContentSeo } from '../src/lib/contentAnalyzer.js'
import { isLiveBlogPost, mergeBlogPostsWithGuides } from '../src/lib/seoLocalGuides.js'
import {
  buildBreadcrumbJsonLd,
  buildHeadPatch,
  buildServicePageJsonLd,
  buildSiteJsonLd,
} from '../src/lib/pageMeta.js'
import {
  buildArticleCrawlerHtml,
  buildBranchCityCrawlerHtml,
  buildBranchServiceCrawlerHtml,
  buildCoreServiceCrawlerHtml,
  buildRssXml,
  buildSitemapXml,
  handleSeoRequest,
} from '../server/seoApi.mjs'
import {
  findLocalBranchPage,
  findLocalBranchServicePage,
} from '../src/lib/localBranchPages.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('Technical SEO & AI Visibility setup', () => {
  it('configures SearchAction, hreflang, HSTS, Content-Signal, llms.txt, and dynamic SEO rewrites', () => {
    const siteLd = buildSiteJsonLd()
    const website = siteLd['@graph'].find((n) => n['@type'] === 'WebSite')
    assert.equal(website?.potentialAction?.['@type'], 'SearchAction')
    assert.match(website?.potentialAction?.target?.urlTemplate || '', /\/blog\?q=\{search_term_string\}$/)

    const patch = buildHeadPatch({
      title: 'Test Guide',
      description: 'Short description for testing SEO head tags.',
      path: '/blog/test-guide',
      ogType: 'article',
      keywords: 'ceramic coating, bacoor',
      article: { publishedTime: '2026-11-19T08:00:00Z', section: 'Paint & Ceramic Craft' },
    })
    assert.equal(patch.meta.find((m) => m.key === 'og:type')?.content, 'article')
    assert.equal(patch.meta.find((m) => m.key === 'article:section')?.content, 'Paint & Ceramic Craft')
    assert.equal(patch.meta.find((m) => m.key === 'keywords')?.content, 'ceramic coating, bacoor')
    assert.ok(patch.links.some((l) => l.rel === 'alternate' && l.hreflang === 'en-PH'))
    assert.ok(patch.links.some((l) => l.rel === 'alternate' && l.hreflang === 'x-default'))

    const notFoundSrc = read('src/pages/NotFoundPage.jsx')
    assert.match(notFoundSrc, /noindex:\s*true/, 'NotFoundPage must emit noindex to avoid soft-404 indexation')

    const robots = read('public/robots.txt')
    assert.match(robots, /Claude-SearchBot/)
    assert.match(robots, /OAI-SearchBot/)
    assert.match(robots, /PerplexityBot/)
    assert.match(robots, /Google-Extended/)
    assert.match(robots, /User-agent:\s*Bytespider[\s\S]*?Disallow:\s*\//)
    assert.match(robots, /User-agent:\s*CCBot[\s\S]*?Disallow:\s*\//)

    assert.ok(existsSync(join(root, 'public', 'llms.txt')), 'public/llms.txt must ship')
    const llms = read('public/llms.txt')
    assert.match(llms, /https:\/\/www\.hakumautocare\.com\/branches\/bacoor/)

    const vercel = JSON.parse(read('vercel.json'))
    assert.ok(vercel.rewrites.some((r) => r.source === '/sitemap.xml' && r.destination === '/api/seo?operation=sitemap'))
    assert.ok(vercel.rewrites.some((r) => r.source === '/rss.xml' && r.destination === '/api/seo?operation=rss'))
    assert.ok(vercel.rewrites.some((r) => r.source === '/blog/:slug' && Array.isArray(r.has)))
    const globalHeaders = vercel.headers.find((h) => h.source === '/(.*)')?.headers || []
    assert.ok(globalHeaders.some((h) => h.key === 'Strict-Transport-Security'))
  })

  it('builds valid Service, FAQPage, and BreadcrumbList schemas without invented ratings', () => {
    const ld = buildServicePageJsonLd({
      slug: 'ppf',
      name: 'ClearPro Paint Protection Film (PPF)',
      description: 'Optical TPU PPF protection.',
      faqs: [{ question: 'Does it self-heal?', answer: 'Yes, heat heals light swirls.' }],
    })
    const types = ld['@graph'].map((n) => n['@type'])
    assert.ok(types.includes('Service'))
    assert.ok(types.includes('BreadcrumbList'))
    assert.ok(types.includes('FAQPage'))
    assert.equal(JSON.stringify(ld).includes('aggregateRating'), false)

    const crumbs = buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/shop' },
    ])
    assert.equal(crumbs.itemListElement.length, 2)
  })

  it('builds dynamic XML sitemap, RSS feed, and crawler article HTML while respecting scheduling & noindex', () => {
    const futureIso = new Date(Date.now() + 86_400_000).toISOString()
    const pastIso = new Date(Date.now() - 3_600_000).toISOString()

    const dbBlogs = [
      {
        slug: 'fresh-live-post',
        title: 'Fresh Live Post',
        status: 'published',
        is_published: true,
        published_at: pastIso,
        excerpt: 'Live excerpt',
      },
      {
        slug: 'due-scheduled-post',
        title: 'Due Scheduled Post',
        status: 'scheduled',
        is_published: false,
        published_at: pastIso,
      },
      {
        slug: 'future-scheduled-post',
        title: 'Future Scheduled Post',
        status: 'scheduled',
        is_published: false,
        published_at: futureIso,
      },
      {
        slug: 'hidden-noindex-post',
        title: 'Hidden Noindex Post',
        status: 'published',
        is_published: true,
        published_at: pastIso,
        noindex: true,
      },
    ]

    const xml = buildSitemapXml({ dbBlogs })
    assert.match(xml, /\/shop</)
    assert.match(xml, /\/blog\/fresh-live-post</)
    assert.match(xml, /\/blog\/due-scheduled-post</)
    assert.doesNotMatch(xml, /future-scheduled-post/)
    assert.doesNotMatch(xml, /hidden-noindex-post/)

    const rss = buildRssXml({ dbBlogs })
    assert.match(rss, /<rss version="2\.0"/)
    assert.match(rss, /Fresh Live Post/)
    assert.doesNotMatch(rss, /Future Scheduled Post/)

    const html = buildArticleCrawlerHtml({
      slug: 'fresh-live-post',
      post: { ...dbBlogs[0], content_blocks: [{ type: 'paragraph', text: 'Ceramic guide' }] },
    })
    assert.match(html, /<meta property="og:type" content="article" \/>/)
    assert.match(html, /"@type":"BlogPosting"/)
  })

  it('renders rich crawler HTML for branch cities, local services, and core services with Schema.org graph', async () => {
    const bacoorPage = findLocalBranchPage('bacoor')
    const cityHtml = buildBranchCityCrawlerHtml({ cityPage: bacoorPage })
    assert.match(cityHtml, /<title>Bacoor Car Wash &amp; Auto Detailing \| Ceramic &amp; PPF · Hakum Auto Care<\/title>/)
    assert.match(cityHtml, /"@type":"AutomotiveBusiness"/)
    assert.match(cityHtml, /"@type":"OfferCatalog"/)
    assert.match(cityHtml, /"@type":"FAQPage"/)
    assert.match(cityHtml, /href="https:\/\/www\.hakumautocare\.com\/branches\/bacoor"/)
    assert.match(cityHtml, /RFC Molino II/)
    assert.match(cityHtml, /Executive Summary:/)

    const ppfMatch = findLocalBranchServicePage('bacoor', 'ppf')
    const serviceHtml = buildBranchServiceCrawlerHtml({ page: ppfMatch.page })
    assert.match(serviceHtml, /<title>PPF Bacoor Near Me — ClearPro Paint Protection Film · Hakum Auto Care<\/title>/)
    assert.match(serviceHtml, /"@type":"Service"/)
    assert.match(serviceHtml, /"@type":"FAQPage"/)
    assert.match(serviceHtml, /ClearPro/)

    const coreHtml = buildCoreServiceCrawlerHtml({ serviceSlug: 'ppf' })
    assert.match(coreHtml, /ClearPro Paint Protection Film/)
    assert.match(coreHtml, /"@type":"Service"/)

    // Test handleSeoRequest handler outputs
    const fakeRes = (onEnd) => ({
      status: 200,
      headers: {},
      body: '',
      writeHead(status, headers) {
        this.status = status
        this.headers = headers
      },
      end(chunk) {
        this.body = chunk || ''
        if (onEnd) onEnd(this)
      },
    })

    await new Promise((resolve) => {
      const res = fakeRes((r) => {
        assert.equal(r.status, 200)
        assert.match(r.body, /Batangas Car Wash/)
        assert.match(r.body, /PNP Highway/)
        resolve()
      })
      handleSeoRequest({ method: 'GET', url: '/api/seo?operation=branch-meta&citySlug=batangas' }, res)
    })

    await new Promise((resolve) => {
      const res = fakeRes((r) => {
        assert.equal(r.status, 301)
        assert.equal(r.headers.Location, '/branches/bacoor/ceramic-coating')
        resolve()
      })
      handleSeoRequest({ method: 'GET', url: '/api/seo?operation=branch-service-meta&citySlug=molino&serviceSlug=ceramic' }, res)
    })

    await new Promise((resolve) => {
      const res = fakeRes((r) => {
        assert.equal(r.status, 200)
        assert.match(r.body, /"@type":"WebSite"/)
        assert.match(r.body, /SearchAction/)
        assert.match(r.body, /National Highway/)
        resolve()
      })
      handleSeoRequest({ method: 'GET', url: '/api/seo?operation=home-meta' }, res)
    })

    await new Promise((resolve) => {
      const res = fakeRes((r) => {
        assert.equal(r.status, 200)
        assert.match(r.body, /"@type":"AutomotiveBusiness"/)
        assert.match(r.body, /\/branches\/batangas\/car-wash/)
        resolve()
      })
      handleSeoRequest({ method: 'GET', url: '/api/seo?operation=branches-meta' }, res)
    })

    // Open Graph protocol uses 'website' (not invalid 'service') and sitemap stays synced
    assert.doesNotMatch(serviceHtml, /property="og:type" content="service"/)
    assert.match(serviceHtml, /property="og:type" content="website"/)
    assert.doesNotMatch(coreHtml, /property="og:type" content="service"/)
    assert.match(coreHtml, /property="og:type" content="website"/)

    const expectedSitemap = buildSitemapXml({ origin: 'https://www.hakumautocare.com' })
    const shippedSitemap = read('public/sitemap.xml')
    assert.equal(shippedSitemap.trim(), expectedSitemap.trim(), 'public/sitemap.xml must match buildSitemapXml()')
    assert.match(shippedSitemap, /\/partnerships</)
    assert.match(shippedSitemap, /\/queue\/bacoor</)
    assert.match(shippedSitemap, /\/queue\/batangas</)

    // Noindex discipline across legal, auth, public form, and shop TV shells
    const legalPatch = buildHeadPatch({ title: 'Terms', path: '/terms', robots: 'noindex,follow' })
    assert.equal(legalPatch.robots, 'noindex,follow')
    assert.equal(legalPatch.isNoindex, true)
    assert.equal(legalPatch.meta.some((m) => m.key === 'googlebot'), false)
    assert.equal(legalPatch.links.some((l) => l.rel === 'alternate'), false)

    for (const rel of [
      'src/pages/LegalPages.jsx',
      'src/pages/PublicQueueTvPage.jsx',
      'src/pages/PublicFormPage.jsx',
      'src/pages/CustomerSignInPage.jsx',
      'src/pages/CustomerSignUpPage.jsx',
      'src/pages/CustomerSetPasswordPage.jsx',
      'src/pages/LoginPage.jsx',
      'src/pages/AccessDeniedPage.jsx',
      'src/pages/OpsNotFoundPage.jsx',
    ]) {
      assert.match(read(rel), /noindex/, `${rel} must opt out of search indexing`)
    }
  })
})

describe('WordPress Blog Editor, Templates, Inline Rich Text & SEO Analyzer', () => {
  it('parses bold, italic, code, and safe links while stripping unsafe javascript: URIs', () => {
    const segs = parseInlineRichText(
      'Book **Kisho** *ceramic* at [Hakum Bacoor](/branches/bacoor) or avoid [xss](javascript:alert(1)).',
    )
    assert.ok(segs.some((s) => s.type === 'bold' && s.text === 'Kisho'))
    assert.ok(segs.some((s) => s.type === 'italic' && s.text === 'ceramic'))
    assert.ok(segs.some((s) => s.type === 'link' && s.href === '/branches/bacoor' && s.isInternal))
    assert.equal(
      segs.some((s) => s.type === 'link' && /javascript:/i.test(s.href)),
      false,
    )
  })

  it('provides 4 WordPress article templates, tag normalization, TOC extraction, and SEO scoring', () => {
    assert.equal(BLOG_POST_TEMPLATES.length, 4)
    assert.deepEqual(normalizeBlogTags(['PPF', 'ppf ', ' Ceramic Coating ']), ['ppf', 'ceramic coating'])

    const blocks = attachContentMeta(
      [
        { type: 'heading', level: 2, text: 'Why Bacoor Needs pH-Neutral Care' },
        { type: 'paragraph', text: 'Learn about ceramic coating in Bacoor and [book a bay](/book). '.repeat(30) },
        { type: 'heading', level: 2, text: 'Five Wash Rules' },
        { type: 'image', url: '/og-image.png', alt: 'Bacoor detailing studio' },
      ],
      {
        tags: ['ceramic', 'bacoor'],
        seo_title: 'Best Ceramic Coating Studio in Bacoor',
        seo_description: 'Protect your car finish in Bacoor with Kisho 9H ceramic coating, calibrated correction, and pH-neutral two-bucket care.',
        seo_keywords: 'ceramic coating, detailing bacoor',
        ai_summary: 'Hakum Auto Care in RFC Molino II, Bacoor provides certified Kisho 9H ceramic coating with dust-controlled curing bays.',
      },
    )

    const meta = extractContentMeta({ content_blocks: blocks })
    assert.deepEqual(meta.tags, ['ceramic', 'bacoor'])
    const toc = extractTableOfContents(blocks)
    assert.equal(toc.length, 2)
    assert.equal(toc[0].anchor, 'why-bacoor-needs-ph-neutral-care')
    assert.deepEqual(extractInternalLinks(blocks), ['/book'])

    const report = analyzeContentSeo({
      title: 'Best Ceramic Coating Studio in Bacoor',
      slug: 'best-ceramic-coating-studio-in-bacoor',
      cover_url: '/og-image.png',
      ...meta,
      content_blocks: blocks,
    })
    assert.ok(report.score >= 85, `Expected strong SEO score, got ${report.score}`)
    assert.equal(report.tone, 'good')
  })

  it('enforces scheduled timestamps when filtering live blog posts', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    assert.equal(isLiveBlogPost({ status: 'scheduled', is_published: false, published_at: future }), false)
    assert.equal(isLiveBlogPost({ status: 'scheduled', is_published: false, published_at: past }), true)
    const merged = mergeBlogPostsWithGuides([
      { id: '1', slug: 'sched-future', title: 'Future', status: 'scheduled', is_published: false, published_at: future },
      { id: '2', slug: 'sched-past', title: 'Past', status: 'scheduled', is_published: false, published_at: past },
    ])
    assert.equal(merged.some((p) => p.slug === 'sched-future'), false)
    assert.equal(merged.some((p) => p.slug === 'sched-past'), true)
  })
})
