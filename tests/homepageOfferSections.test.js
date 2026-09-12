import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import { ceramicPackages, HOME_SECTION_IDS, ppfInstallProof } from '../src/data/publicHomeContent.js'
import { PPF_PACKAGES } from '../src/data/ppfPackages.js'
import { buildCeramicPackageCards, buildPpfPackageCards, ppfWarrantyYears } from '../src/lib/homepageContent.js'
import { applyPublicBookPrefill } from '../src/lib/uiDeadControls.js'

const projectFile = (relative) => new URL(`../${relative}`, import.meta.url)
const read = (relative) => readFile(projectFile(relative), 'utf8')

describe('ceramic coating offer cards', () => {
  it('puts the warranty and both CTAs on the card, and the detail copy behind it', () => {
    const cards = buildCeramicPackageCards(ceramicPackages)

    assert.deepEqual(cards.map(({ id, warrantyYears }) => [id, warrantyYears]), [
      ['premium', 5],
      ['platinum', 8],
    ])
    /* The bullet count is the owner's to set — the card contract is that every
       tier carries a pitch, detail copy, and a non-empty inclusions list. */
    assert.ok(cards.every((card) => card.pitch && card.copy && card.includes.length > 0))
    assert.deepEqual(cards.map(({ detailsId }) => detailsId), [
      'ceramic-package-details-premium',
      'ceramic-package-details-platinum',
    ])
    assert.deepEqual(cards[1].bookingState, {
      service: 'Ceramic Coating',
      package: 'PLATINUM Ceramic Coating',
      packageId: 'ceramic-platinum',
    })
  })

  it('renders the disclosure with the booking CTA beside it', async () => {
    const section = await read('src/components/public/home/HomeServiceSections.jsx')

    assert.match(section, /aria-expanded=\{open\}/)
    assert.match(section, /aria-controls=\{item\.detailsId\}/)
    assert.match(section, /className="ceramic-package-details" id=\{item\.detailsId\} hidden=\{!open\}/)
    assert.match(section, /className="ceramic-package-book"[\s\S]*?to="\/book"/)
  })
})

describe('PPF package value ladder', () => {
  it('reads the warranty years out of the warranty line', () => {
    assert.equal(ppfWarrantyYears('5-year PPF warranty for manufacturer defects only'), 5)
    assert.equal(ppfWarrantyYears('8-year manufacturer defect warranty'), 8)
    assert.equal(ppfWarrantyYears(''), null)
  })

  it('reduces each tier to three figures that escalate down the ladder', () => {
    const cards = buildPpfPackageCards(PPF_PACKAGES)

    assert.deepEqual(cards.map((card) => card.figures.map((figure) => figure.label)), [
      ['Areas covered', 'Film thickness', 'Warranty'],
      ['Areas covered', 'Film thickness', 'Warranty'],
      ['Areas covered', 'Film thickness', 'Warranty'],
      ['Areas covered', 'Film thickness', 'Warranty'],
    ])
    assert.deepEqual(cards.map((card) => card.figures.map((figure) => figure.value + figure.unit)), [
      ['5', '7.5mil', '7yr'],
      ['13', '7.5mil', '7yr'],
      ['13', '8mil', '10yr'],
      ['15', '8.5mil', '12yr'],
    ])
    /* Panel replacement rides on the warranty figure; Basic has none to show. */
    assert.deepEqual(cards.map((card) => card.figures[2].note), ['', '', '+ 2 panels', '+ 3 panels'])
    /* Two highlighted rows out of three is the same as none. */
    assert.deepEqual(cards.map((card) => card.isHighlighted), [false, false, true, false])
    /* Every tier quotes a floor rather than a flat figure — the operational
       disclaimers reserve the right to charge more for oversized vehicles. */
    assert.deepEqual(cards.map((card) => card.priceFromLabel), [
      'From \u20b148,000',
      'From \u20b175,000',
      'From \u20b194,000',
      'From \u20b1130,000',
    ])
    assert.deepEqual(cards.map((card) => card.headline), [
      'Where the road hits first.',
      'The whole car, on essential film.',
      'Every painted panel, covered.',
      'Nothing left exposed.',
    ])
  })

  it('books the package straight from the row, carrying the tier into the form', async () => {
    const cards = buildPpfPackageCards(PPF_PACKAGES)
    const section = await read('src/components/public/home/PpfPackagesSection.jsx')

    assert.match(section, /to="\/book"\s+state=\{card\.bookingState\}/)
    assert.match(
      applyPublicBookPrefill({}, cards[2].bookingState)._prefNotes,
      /^Package: Ultimate Protection · Full Body PPF · Film: 8 mil/,
    )
  })

  it('shows no install proof until real Hakum work is supplied', async () => {
    const section = await read('src/components/public/home/PpfPackagesSection.jsx')

    /* Rendered product frames and stock shots are the evidence a six-figure
       buyer discounts on sight — the strip stays absent rather than faked. */
    assert.deepEqual(ppfInstallProof, [])
    assert.match(section, /ppfInstallProof\.length \? \(/)
    assert.match(section, /ppf-install-proof/)
  })

  it('leads with the starting price, then the step ladder, then a panel-by-panel comparison', async () => {
    const section = await read('src/components/public/home/PpfPackagesSection.jsx')

    /* The floor is read from the packages, never typed in. */
    assert.match(section, /Math\.min\(\.\.\.PPF_PACKAGES\.map\(\(item\) => item\.priceFrom\)\)/)
    assert.match(section, /Starting from/)
    assert.match(section, /className=\{`bd-tier\$\{card\.isHighlighted \? ' is-recommended' : ''\}`\}/)
    assert.match(section, /className="bd-tier-riser"/)
    /* Coverage is compared panel by panel: High Impact and Basic film
       different panels, so a count of areas would hide the difference. */
    assert.match(section, /'Front bumper', \(pkg\) => tick\(covers\(pkg, 'Front bumper'\)\)/)
    assert.match(section, /'Taillights', \(pkg\) => tick\(covers\(pkg, 'Taillights'\)\)/)
    assert.match(section, /<th scope="row">\{label\}<\/th>/)
    /* Shared inclusions are said once, not repeated on every tier. */
    assert.doesNotMatch(section, /ppf-ladder-highlights|highlights\.map/)
    /* Repeated disclaimers collapse into one. */
    assert.equal((section.match(/Warranties cover manufacturer defects/g) || []).length, 1)
  })

  it('steps from front-only film on High Impact to full-body film from Basic up', () => {
    const [highImpact, basic, ultimate] = PPF_PACKAGES

    assert.equal(highImpact.id, 'high-impact')
    assert.equal(highImpact.priceFrom, 48000)
    assert.deepEqual(highImpact.coverageAreas, ['Hood', 'Headlights', 'Side mirrors', 'Front bumper', 'Front fenders'])
    /* Basic films the whole car, like Ultimate — the step up is the film,
       the warranty and the extras, not the panels. */
    assert.equal(basic.coverageType, 'Full Body PPF')
    assert.deepEqual(basic.coverageAreas, ultimate.coverageAreas)
    assert.equal(basic.keyEnhancements.some((line) => /ceramic coating on the rest/i.test(line)), false)
    assert.equal(basic.ladderNote.tone, 'step')
  })
})

describe('homepage closing flow', () => {
  it('drops the live queue section from the page and the codebase', async () => {
    assert.equal(HOME_SECTION_IDS.includes('queue'), false)

    const landing = await read('src/pages/PublicLandingPage.jsx')
    const ending = await read('src/components/public/home/HomeEndingSections.jsx')
    const css = await read('src/styles.css')

    assert.doesNotMatch(landing, /LiveQueueBoard/)
    assert.doesNotMatch(ending, /LiveQueueBoard|queue-teaser/)
    assert.doesNotMatch(css, /\.live-board|\.queue-teaser/)
  })

  it('collapses the branch list behind a disclosure and keeps a queue route out', async () => {
    const ending = await read('src/components/public/home/HomeEndingSections.jsx')
    const css = await read('src/styles.css')

    assert.match(ending, /aria-expanded=\{showBranches\}/)
    assert.match(ending, /aria-controls="home-branch-list"/)
    assert.match(ending, /className="home-branch-grid" id="home-branch-list"[^>]*hidden=\{!showBranches\}/)
    assert.match(ending, /to="\/branches"/)
    assert.match(ending, /className="home-branch-queue" to="\/queue"/)
    /* display:grid outranks the hidden attribute without this rule. */
    assert.match(css, /\.home-branch-grid\[hidden\] \{ display:none; \}/)
  })
})
