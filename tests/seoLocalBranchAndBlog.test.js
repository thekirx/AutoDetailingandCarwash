import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Local branch SEO hubs, nearest locator, and blog SEO', () => {
  it('covers Bacoor, Batangas City, Imus, Dasmariñas, and Cavite dedicated city pages cleanly', async () => {
    const { LOCAL_BRANCH_PAGES, buildBranchCityJsonLd, findLocalBranchPage } = await import(
      '../src/lib/localBranchPages.js'
    )
    assert.deepEqual(
      LOCAL_BRANCH_PAGES.map((p) => p.slug),
      ['bacoor', 'batangas', 'imus', 'cavite', 'dasmarinas'],
    )
    const bacoor = findLocalBranchPage('bacoor')
    const imus = findLocalBranchPage('imus')
    const dasma = findLocalBranchPage('dasmarinas')
    assert.ok(bacoor && imus && dasma)
    assert.equal(imus.branchSlug, 'bacoor', 'Imus page directs drivers to open Bacoor bay while Imus rolls out')
    assert.equal(dasma.branchSlug, 'bacoor', 'Dasmariñas page directs drivers to open Bacoor bay while Dasmariñas rolls out')

    const jsonLd = buildBranchCityJsonLd(bacoor)
    assert.equal(jsonLd['@context'], 'https://schema.org')
    const studio = jsonLd['@graph'].find((n) => n['@type'] === 'AutomotiveBusiness')
    const crumbs = jsonLd['@graph'].find((n) => n['@type'] === 'BreadcrumbList')
    const faq = jsonLd['@graph'].find((n) => n['@type'] === 'FAQPage')
    assert.ok(studio && studio.geo && studio.hasMap, 'City schema must include verified geo & hasMap')
    assert.ok(faq && faq.mainEntity.length >= 2, 'City schema must include local FAQs')
    assert.equal(crumbs.itemListElement.length, 3)
  })

  it('publishes all 25 Branch × Service pages across 5 cities and resolves city/service aliases cleanly', async () => {
    const {
      COMPLETE_DETAILING_CATALOG,
      LOCAL_BRANCH_SERVICE_PAGES,
      STUDIO_PRODUCTS_AND_BRANDS,
      buildBranchCityJsonLd,
      buildBranchServiceJsonLd,
      findLocalBranchPage,
      findLocalBranchServicePage,
    } = await import('../src/lib/localBranchPages.js')

    assert.equal(LOCAL_BRANCH_SERVICE_PAGES.length, 25)
    assert.equal(COMPLETE_DETAILING_CATALOG.length, 14)
    assert.equal(STUDIO_PRODUCTS_AND_BRANDS.length, 6)

    const bacoorPpf = findLocalBranchServicePage('bacoor', 'ppf')
    assert.equal(bacoorPpf?.redirected, false)
    assert.match(bacoorPpf?.page.seoTitle, /PPF Bacoor/i)

    const batangasWash = findLocalBranchServicePage('batangas', 'car-wash')
    assert.equal(batangasWash?.redirected, false)
    assert.match(batangasWash?.page.seoTitle, /Batangas Car Wash/i)
    assert.match(batangasWash?.page.aiSummary || '', /Batangas City/)

    const imusCeramic = findLocalBranchServicePage('imus', 'ceramic-coating')
    assert.equal(imusCeramic?.redirected, false)
    assert.equal(imusCeramic?.canonicalCitySlug, 'imus')

    const aliasMolinoCeramic = findLocalBranchServicePage('molino', 'ceramic')
    assert.equal(aliasMolinoCeramic?.redirected, true)
    assert.equal(aliasMolinoCeramic?.canonicalCitySlug, 'bacoor')
    assert.equal(aliasMolinoCeramic?.canonicalServiceSlug, 'ceramic-coating')

    const aliasBatangasTint = findLocalBranchServicePage('alangilan', 'tint')
    assert.equal(aliasBatangasTint?.redirected, true)
    assert.equal(aliasBatangasTint?.canonicalCitySlug, 'batangas')
    assert.equal(aliasBatangasTint?.canonicalServiceSlug, 'window-tint')

    const ld = buildBranchServiceJsonLd(bacoorPpf.page)
    const types = ld['@graph'].map((n) => n['@type'])
    assert.ok(types.includes('Service'))
    assert.ok(types.includes('BreadcrumbList'))
    assert.ok(types.includes('FAQPage'))
    const serviceNode = ld['@graph'].find((n) => n['@type'] === 'Service')
    assert.ok(serviceNode?.hasOfferCatalog?.itemListElement?.length >= 1)
    assert.equal(JSON.stringify(ld).includes('aggregateRating'), false)

    const batangasCityLd = buildBranchCityJsonLd(findLocalBranchPage('batangas'))
    const batangasStudio = batangasCityLd['@graph'].find((n) => n['@type'] === 'AutomotiveBusiness')
    assert.equal(batangasStudio?.hasOfferCatalog?.itemListElement?.length, 14)
  })

  it('ranks open branches accurately for Bacoor, Imus, and Batangas City queries', async () => {
    const { QUICK_CITY_ORIGINS, rankOpenBranchesForOrigin } = await import('../src/lib/localBranchPages.js')
    const imusOrigin = QUICK_CITY_ORIGINS.find((c) => c.id === 'imus')
    const batangasOrigin = QUICK_CITY_ORIGINS.find((c) => c.id === 'batangas')

    const rankedFromImus = rankOpenBranchesForOrigin({ lat: imusOrigin.lat, lng: imusOrigin.lng })
    assert.equal(rankedFromImus[0].branch.slug, 'bacoor')
    assert.ok(rankedFromImus[0].distanceKm < 15)

    const rankedFromBatangas = rankOpenBranchesForOrigin({ lat: batangasOrigin.lat, lng: batangasOrigin.lng })
    assert.equal(rankedFromBatangas[0].branch.slug, 'batangas')
    assert.ok(rankedFromBatangas[0].distanceKm < 10)
  })

  it('publishes /blog as a real route (no redirect to /events#blog) and wires city routes', () => {
    const app = read('src/App.jsx')
    assert.match(app, /path="\/branches\/:citySlug"/)
    assert.match(app, /path="\/blog"\s+element=\{<BlogPage\s*\/>\}/)
    assert.doesNotMatch(app, /path="\/blog"\s+element=\{<Navigate/)
  })

  it('emits enriched BlogPosting schema with keywords and custom SEO fields', async () => {
    const { buildBlogPostJsonLd } = await import('../src/lib/seoLocalGuides.js')
    const { attachContentMeta, extractContentMeta } = await import('../src/lib/contentBlocks.js')

    const blocks = attachContentMeta([], {
      seo_title: 'Custom Detailing Title',
      seo_description: 'Custom meta description for Bacoor drivers.',
      seo_keywords: 'car wash near me, detailing bacoor',
      ai_summary: 'Short AI summary.',
    })
    const meta = extractContentMeta({ content_blocks: blocks })
    assert.equal(meta.seo_keywords, 'car wash near me, detailing bacoor')

    const ld = buildBlogPostJsonLd({
      slug: 'best-car-wash-detailing-bacoor',
      title: 'Original Title',
      seo_title: meta.seo_title,
      seo_description: meta.seo_description,
      seo_keywords: meta.seo_keywords,
      content_blocks: blocks,
    })
    assert.equal(ld['@type'], 'BlogPosting')
    assert.equal(ld.headline, 'Custom Detailing Title')
    assert.equal(ld.description, 'Custom meta description for Bacoor drivers.')
    assert.equal(ld.keywords, 'car wash near me, detailing bacoor')
    assert.ok(Array.isArray(ld.spatialCoverage) && ld.spatialCoverage.length >= 2)
  })

  it('includes /blog, 5 city hubs, all 25 branch×service pages, AI bots, and excludes low-value legal/form routes from sitemap', () => {
    const app = read('src/App.jsx')
    assert.match(app, /path="\/branches\/:citySlug\/:serviceSlug"/)

    const sitemap = read('public/sitemap.xml')
    for (const city of ['bacoor', 'batangas', 'imus', 'dasmarinas', 'cavite']) {
      assert.match(sitemap, new RegExp(`https://www\\.hakumautocare\\.com/branches/${city}<`))
      for (const svc of ['car-wash', 'auto-detailing', 'ceramic-coating', 'ppf', 'window-tint']) {
        assert.match(sitemap, new RegExp(`https://www\\.hakumautocare\\.com/branches/${city}/${svc}<`))
      }
    }
    for (const p of ['/blog', '/blog/best-car-wash-detailing-dasmarinas', '/blog/best-car-wash-detailing-batangas-city']) {
      assert.match(sitemap, new RegExp(`https://www\\.hakumautocare\\.com${p.replace(/\//g, '\\/')}<`))
    }
    for (const excluded of ['/complaints', '/terms', '/privacy', '/cookies']) {
      assert.doesNotMatch(sitemap, new RegExp(`https://www\\.hakumautocare\\.com${excluded}<`))
    }
    const robots = read('public/robots.txt')
    assert.match(robots, /OAI-SearchBot/)
    assert.match(robots, /PerplexityBot/)
    const pkg = JSON.parse(read('package.json'))
    assert.match(pkg.scripts.build, /prerender-seo\.mjs/)
  })
})
