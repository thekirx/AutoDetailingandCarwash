import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { formatDiscountPercent, normalizeReferralProgram, referralOfferCopy, DEFAULT_FRIEND_POINTS, DEFAULT_DISCOUNT_RATE } from '../src/lib/referralProgram.js'

test('missing settings stay at 50 points and 5 percent', () => {
  const program = normalizeReferralProgram(null)
  assert.deepEqual(program, { friend_points: 50, discount_rate: 0.05 })
  assert.equal(formatDiscountPercent(program.discount_rate), '5%')
})

test('percent input and stored rate normalize to the same offer', () => {
  assert.deepEqual(normalizeReferralProgram({ friend_points: 80, discount_percent: 5 }), {
    friend_points: 80,
    discount_rate: 0.05,
  })
  assert.equal(
    referralOfferCopy({ friend_points: 0, discount_rate: 0 }),
    'When a friend uses this code on a detailing booking, you get 0% off your next detailing booking. They get 0 points.',
  )
})

test('blank offer input uses the same defaults as the database function', () => {
  assert.deepEqual(normalizeReferralProgram({ friend_points: '', discount_percent: '' }), {
    friend_points: DEFAULT_FRIEND_POINTS,
    discount_rate: DEFAULT_DISCOUNT_RATE,
  })
  const sql = readFileSync(new URL('../supabase/migrations/20261028120000_referral_discount_default_5.sql', import.meta.url), 'utf8')
  assert.match(sql, /friend_points', ''\)::int[\s\S]*?\), 50\)/)
  assert.match(sql, /discount_rate', ''\)::numeric[\s\S]*?\), 0\.05\)/)
})

test('a points redemption deducts the pickup branch, not global stock', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261017180000_redeem_branch_stock.sql', import.meta.url), 'utf8')
  const portal = readFileSync(new URL('../server/customerPortal.mjs', import.meta.url), 'utf8')
  const page = readFileSync(new URL('../src/pages/CustomerVouchersPage.jsx', import.meta.url), 'utf8')
  assert.match(sql, /product_branch_stock/)
  assert.match(sql, /hakum\.allow_stock_decrease/)
  assert.doesNotMatch(sql, /stock_qty/)
  assert.match(portal, /p_branch: branch/)
  assert.match(portal, /referral_program_settings/)
  assert.match(page, /branch_slug: pickup/)
  assert.match(page, /branchOnHand/)
  assert.doesNotMatch(page, /stock_qty/)
})

test('a later edit can award a friend code and uses the price the board saved', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261017190000_friend_referral_on_update.sql', import.meta.url), 'utf8')
  const board = readFileSync(new URL('../src/pages/BookingBoardPage.jsx', import.meta.url), 'utf8')
  assert.match(sql, /before insert or update/i)
  assert.match(sql, /after insert or update/i)
  assert.match(sql, /final_price_minor/)
  assert.match(sql, /pg_trigger_depth\(\) > 1/)
  assert.match(board, /price_minor = Math\.round/)
})

test('referral offer is read from settings in the trigger, shop, and staff form', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261017170000_referral_program_settings.sql', import.meta.url), 'utf8')
  const portal = readFileSync(new URL('../server/customerPortal.mjs', import.meta.url), 'utf8')
  const points = readFileSync(new URL('../server/accessoryPoints.mjs', import.meta.url), 'utf8')
  const merch = readFileSync(new URL('../src/pages/ProductsManagePage.jsx', import.meta.url), 'utf8')
  const inventory = readFileSync(new URL('../src/pages/InventoryPage.jsx', import.meta.url), 'utf8')
  assert.match(sql, /referral_program_settings/)
  assert.match(sql, /award_points/)
  assert.match(sql, /coalesce\(usage_kind, 'resellable'\) <> 'internal'/)
  assert.doesNotMatch(sql, /category = 'accessories'/)
  assert.match(portal, /usage_kind\.is\.null,usage_kind\.neq\.internal/)
  assert.match(portal, /program: normalizeReferralProgram/)
  assert.match(points, /Point prices are for accessories and sellables/)
  assert.match(merch, /usage_kind \|\| 'resellable'/)
  assert.match(inventory, /ReferralProgramCard/)
})
