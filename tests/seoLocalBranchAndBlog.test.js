import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('Local branch SEO hubs, nearest locator, and blog SEO', () => {
  it('covers Bacoor, Batangas City, Imus, and Cavite dedicated city pages cleanly', async () => {
    const { LOCAL_BRANCH_PAGES, buildBranchCityJsonLd, findLocalBranchPage } = await import(
      '../src/lib/localBranchPages.js'
    )
    assert.deepEqual(
      LOCAL_BRANCH_PAGES.map((p) => p.slug),
      ['bacoor', 'batangas', 'imus', 'cavite'],
    )
    const bacoor = findLocalBranchPage('bacoor')
    const imus = findLocalBranchPage('imus')
    assert.ok(bacoor && imus)
    assert.equal(imus.branchSlug, 'bacoor', 'Imus page directs drivers to open Bacoor bay while Imus rolls out')

    const jsonLd = buildBranchCityJsonLd(bacoor)
    assert.equal(jsonLd['@context'], 'https://schema.org')
    const studio = jsonLd['@graph'].find((n) => n['@type'] === 'AutomotiveBusiness')
    const crumbs = jsonLd['@graph'].find((n) => n['@type'] === 'BreadcrumbList')
    assert.ok(studio && studio.geo && studio.hasMap, 'City schema must include verified geo & hasMap')
    assert.equal(crumbs.itemListElement.length, 3)
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

  it('includes /blog, city routes, AI search bots, and pre-render build hook', () => {
    const sitemap = read('public/sitemap.xml')
    for (const p of ['/blog', '/branches/bacoor', '/branches/batangas', '/branches/imus', '/branches/cavite']) {
      assert.match(sitemap, new RegExp(`https://www\\.hakumautocare\\.com${p.replace('/', '\\/')}<`))
    }
    const robots = read('public/robots.txt')
    assert.match(robots, /OAI-SearchBot/)
    assert.match(robots, /PerplexityBot/)
    const pkg = JSON.parse(read('package.json'))
    assert.match(pkg.scripts.build, /prerender-seo\.mjs/)
  })
})
