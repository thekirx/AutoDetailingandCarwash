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
    assert.ok(cards.every((card) => card.pitch && card.copy && card.includes.length === 4))
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
    ])
    assert.deepEqual(cards.map((card) => card.figures.map((figure) => figure.value + figure.unit)), [
      ['4', '7.5mil', '5yr'],
      ['13', '7.5mil', '5yr'],
      ['15', '8.5mil', '8yr'],
    ])
    /* Panel replacement rides on the warranty figure; Basic has none to show. */
    assert.deepEqual(cards.map((card) => card.figures[2].note), ['', '+ 2 panels', '+ 4 panels'])
    /* Two highlighted rows out of three is the same as none. */
    assert.deepEqual(cards.map((card) => card.isHighlighted), [false, true, false])
    assert.deepEqual(cards.map((card) => card.headline), [
      'The panels that take the hits.',
      'Every painted panel, covered.',
      'Nothing left exposed.',
    ])
  })

  it('books the package straight from the row, carrying the tier into the form', async () => {
    const cards = buildPpfPackageCards(PPF_PACKAGES)
    const section = await read('src/components/public/home/PpfPackagesSection.jsx')

    assert.match(section, /Book now <ArrowRight/)
    assert.match(
      applyPublicBookPrefill({}, cards[1].bookingState)._prefNotes,
      /^Package: Premium Protection · Full Body PPF · Film: 7\.5 mil/,
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

  it('states shared inclusions once and keeps tier specifics in the active accordion panel', async () => {
    const section = await read('src/components/public/home/PpfPackagesSection.jsx')

    assert.match(section, /ppf-package-included/)
    assert.match(section, /Every package includes/)
    /* Self-healing, hydrophobic and seamless are on all three tiers — printing
       them per row is what made the packages look interchangeable. */
    assert.doesNotMatch(section, /ppf-ladder-highlights|highlights\.map/)
    assert.match(section, /className="ppfa-lane"/)
    assert.match(section, /className=\{`ppfa-panelcard/)
    assert.match(section, /aria-expanded=\{isOpen\}/)
    assert.match(section, /onMouseEnter=\{\(\) => setActive\(i\)\}/)
    assert.match(section, /onFocus=\{\(\) => setActive\(i\)\}/)
    assert.match(section, /onClick=\{\(\) => setActive\(i\)\}/)
    assert.match(section, /className="ppfa-figure"/)
    assert.match(section, /className="ppfa-specs"/)
    /* Three repeated disclaimers collapse into one. */
    assert.equal((section.match(/Warranties cover manufacturer defects/g) || []).length, 1)
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
