import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  customerVoucherRulesLine,
  mintPromoCode,
  normalizePromoCode,
  promoAppliesToService,
  promoCodeShapeError,
  promoDiscountedPriceMinor,
  promoVoucherRemaining,
  promoVoucherWindowError,
  voucherScopeLabel,
} from '../src/lib/promoVoucher.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('promo vouchers', () => {
  it('normalizes codes, discounts price, and gates the window', () => {
    assert.match(mintPromoCode(() => 0), /^VK[A-Z2-9]{4}$/)
    assert.equal(normalizePromoCode(' vk-ab 12 '), 'VKAB12')
    assert.equal(promoCodeShapeError('AB'), 'Type a voucher code of 4 to 16 letters or numbers.')
    assert.equal(promoCodeShapeError('SUMMER10'), null)
    assert.equal(promoDiscountedPriceMinor(10000, { discount_kind: 'free' }), 0)
    assert.equal(promoDiscountedPriceMinor(10000, { discount_kind: 'percent', discount_percent: 10 }), 9000)
    assert.equal(promoVoucherRemaining({ max_uses: 10, uses_count: 3 }), 7)
    assert.equal(
      promoVoucherWindowError({ is_active: true, max_uses: 10, uses_count: 10, starts_on: null, ends_on: null }, '2026-10-19'),
      'That voucher has no uses left.',
    )
    assert.equal(
      promoVoucherWindowError(
        { is_active: true, max_uses: 10, uses_count: 0, starts_on: '2026-10-01', ends_on: '2026-10-31' },
        '2026-10-19',
      ),
      null,
    )
    assert.equal(promoAppliesToService({ applies_to: 'wash' }, 'wash', 'service'), true)
    assert.equal(promoAppliesToService({ applies_to: 'wash' }, 'detailing', 'detailing'), false)
    assert.match(customerVoucherRulesLine({ discount_kind: 'percent', discount_percent: 15, max_uses: 10, uses_count: 2, ends_on: '2026-11-01' }), /15% off/)
  })

  it('supports exact fixed amount discount (e.g. 300 OFF) and specific service scoping', () => {
    // 300 OFF (30,000 minor)
    const fixed300 = { discount_kind: 'fixed', discount_amount_minor: 30000 }
    assert.equal(promoDiscountedPriceMinor(100000, fixed300), 70000) // 1,000 - 300 = 700
    assert.equal(promoDiscountedPriceMinor(20000, fixed300), 0) // 200 - 300 = 0 (cannot be negative)
    assert.match(customerVoucherRulesLine({ ...fixed300, max_uses: 10, uses_count: 2 }), /₱300 off/)

    // Specific service scoping (e.g. Nano Ceramic Tint only)
    const tintVoucher = { applies_to: 'service', service_id: 'tint-svc-uuid' }
    assert.equal(promoAppliesToService(tintVoucher, 'detailing', 'nano-ceramic-tint', 'tint-svc-uuid'), true)
    assert.equal(promoAppliesToService(tintVoucher, 'detailing', 'tint-pkg', 'child-pkg-uuid', 'tint-svc-uuid'), true)
    assert.equal(promoAppliesToService(tintVoucher, 'wash', 'carwash', 'wash-svc-uuid'), false)
    assert.equal(promoAppliesToService(tintVoucher, 'detailing', 'ceramic-coating', 'ceramic-svc-uuid'), false)

    // Scope labels
    assert.equal(voucherScopeLabel(tintVoucher, 'Nano Ceramic Tint'), 'Nano Ceramic Tint only')
    assert.equal(voucherScopeLabel({ applies_to: 'detailing' }), 'detailing only')
    assert.equal(voucherScopeLabel({ applies_to: 'wash' }), 'wash and packages only')
    assert.equal(voucherScopeLabel({ applies_to: 'any' }), 'all services')
  })

  it('gates apply and consume in SQL and puts Vouchers on the SA nav', async () => {
    const sql = await readFile(resolve(root, 'supabase/migrations/20261019110000_promo_vouchers.sql'), 'utf8')
    const perms = await readFile(resolve(root, 'src/auth/permissions.js'), 'utf8')
    const editor = await readFile(resolve(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
    const pos = await readFile(resolve(root, 'src/pages/PosPage.jsx'), 'utf8')
    const page = await readFile(resolve(root, 'src/pages/VouchersPage.jsx'), 'utf8')

    assert.match(sql, /create table if not exists public\.promo_vouchers/)
    assert.match(sql, /apply_booking_promo_voucher/)
    assert.match(sql, /consume_booking_promo_voucher/)
    assert.match(sql, /Only a Team Lead can apply a voucher code on the queue/)
    const widened = await readFile(resolve(root, 'supabase/migrations/20261026202000_voucher_apply_pos.sql'), 'utf8')
    assert.match(widened, /team_lead', 'admin', 'BossMich'/)
    assert.match(widened, /Only the Team Lead, Branch Admin, or office can apply a voucher/)
    assert.match(perms, /canManageVouchers/)
    assert.match(perms, /nav\('Vouchers', '\/operations\/vouchers'/)
    assert.match(editor, /apply_booking_promo_voucher/)
    assert.match(pos, /consume_booking_promo_voucher/)
    assert.match(page, /max_uses/)
    assert.match(page, /Fixed amount off/)
    assert.match(page, /Specific service/)

    const specificMigration = await readFile(resolve(root, 'supabase/migrations/20261101200000_voucher_specific_service_and_fixed_amount.sql'), 'utf8')
    assert.match(specificMigration, /discount_amount_minor/)
    assert.match(specificMigration, /service_id/)
    assert.match(specificMigration, /promo_vouchers_kind_ck/)
    assert.match(specificMigration, /promo_vouchers_applies_ck/)
  })

  it('provides customer voucher input and checkout voucher application', async () => {
    const customerVouchers = await readFile(resolve(root, 'src/pages/CustomerVouchersPage.jsx'), 'utf8')
    const customerBook = await readFile(resolve(root, 'src/pages/CustomerBookPage.jsx'), 'utf8')
    const customerVisit = await readFile(resolve(root, 'src/pages/CustomerVisitPage.jsx'), 'utf8')
    const publicBook = await readFile(resolve(root, 'server/publicBook.mjs'), 'utf8')
    const customerPortal = await readFile(resolve(root, 'server/customerPortal.mjs'), 'utf8')

    // Customer Vouchers Page has option to put voucher code
    assert.match(customerVouchers, /Have a voucher code?/)
    assert.match(customerVouchers, /check-voucher/)
    assert.match(customerVouchers, /checkVoucherCode/)
    assert.match(customerVouchers, /Use on next booking/)

    // Customer Book Page has option to put voucher upon checkout
    assert.match(customerBook, /Promo voucher/)
    assert.match(customerBook, /applyVoucherDirect/)
    assert.match(customerBook, /voucher_code:/)
    assert.match(customerBook, /promoDiscountedPriceMinor/)
    assert.match(customerBook, /Available vouchers:/)

    // Customer Visit Page allows applying voucher to active visit
    assert.match(customerVisit, /apply-booking-voucher/)
    assert.match(customerVisit, /applyVoucherToVisit/)
    assert.match(customerVisit, /Voucher discount/)

    // Backend handlers support check-voucher and public-book voucher code
    assert.match(customerPortal, /action === 'check-voucher'/)
    assert.match(customerPortal, /action === 'apply-booking-voucher'/)
    assert.match(publicBook, /rawVoucherCode/)
    assert.match(publicBook, /promo_voucher_redemptions/)
    assert.match(publicBook, /promo_discount_minor/)
  })
})
