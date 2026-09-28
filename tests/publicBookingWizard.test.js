import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const book = read('src/pages/PublicUtilityPage.jsx')
const bookCss = read('src/pages/BookingWizard.css')
const branches = read('src/pages/PublicPages.jsx')
const layout = read('src/layouts/PublicLayout.jsx')

describe('/book wizard', () => {
  it('walks six steps and ends on review', () => {
    assert.match(book, /WIZARD_STEPS = \['Service', 'Branch', 'Date & time', 'Your car', 'Your details', 'Review'\]/)
    assert.match(book, /className="bk-wizard"/)
    assert.match(book, /Step <b>\{step \+ 1\}<\/b> of \{WIZARD_STEPS\.length\}/)
  })

  it('no longer asks for car size but still sends vehicle_type', () => {
    assert.doesNotMatch(book, /Car size/)
    assert.doesNotMatch(book, /PRICING_SIZES/)
    assert.match(book, /vehicle_type: 'medium'/)
    assert.match(book, /onSizeSuggest/)
    assert.match(book, /vehicle_type: form\.vehicle_type/)
  })

  it('shows "From" prices from the public starting-price RPC', () => {
    assert.match(book, /useStartingPrices/)
    assert.match(book, /`From \$\{formatStartingPrice\(minor\)\}`/)
  })

  it('sends Manila time and keeps the same API call', () => {
    assert.match(book, /scheduled_start: `\$\{form\.visit_date\}T\$\{form\.visit_time\}:00\+08:00`/)
    assert.match(book, /fetch\('\/api\/public-book'/)
  })

  it('keeps Next and Request booking as separate buttons', () => {
    assert.match(book, /key="submit" type="submit"/)
    assert.match(book, /key="next" type="button"/)
  })

  it('uses large, readable type', () => {
    assert.match(bookCss, /\.bk-field > span,[\s\S]*?font-size: 17px/)
    assert.match(bookCss, /height: 58px/)
  })
})

describe('/branches page', () => {
  it('has no Book a service link anywhere', () => {
    assert.doesNotMatch(branches, /Book a service at this branch/)
    assert.doesNotMatch(branches, /to=\{`\/book\?branch=/)
    assert.match(layout, /pathname === '\/branches'/)
  })

  it('offers Google Maps and Waze directions instead of OpenStreetMap', () => {
    assert.doesNotMatch(branches, /openstreetmap/)
    assert.match(branches, /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=\$\{pin\}/)
    assert.match(branches, /https:\/\/waze\.com\/ul\?ll=\$\{pin\}&navigate=yes/)
  })
})
