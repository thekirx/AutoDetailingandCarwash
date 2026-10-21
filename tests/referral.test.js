import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  REFERRAL_DEFAULTS,
  isReferralEligibleService,
  makeReferralCode,
  normalizeReferralCode,
  normalizeReferralSettings,
  readReferralCode,
  referralLink,
  referralStatusLine,
  rememberReferralCode,
  validityPhrase,
} from '../src/lib/referral.js'
import {
  REFERRAL_DISCOUNT_REASON,
  applyAdHocDiscount,
  applyReferralRewardToCart,
  buildPosSalePayload,
  priceCartForMembership,
  referralRewardLineError,
  referralRewardMinor,
  validatePosLinePrice,
} from '../src/lib/posSale.js'

// Live catalog, 2026-10-17 (read-only query), plus the rule Kirk set.
const catalog = [
  ['premium-car-wash', 'wash', false],
  ['express-wash-package', 'package', false],
  ['engine-wash', 'addon', false],
  ['glass-detailing', 'addon', true],
  ['full-care-package', 'package', true],
  ['hakum-custom-package', 'package', true],
  ['interior-detailing', 'general', true],
  ['full-exterior-detailing', 'general', true],
  ['mobile-detailing', 'general', true],
  ['paint-maintenance', 'detailing', true],
  ['ceramic-coating', 'detailing', true],
  ['ceramic-coating-premium', 'detailing', true],
  ['nano-ceramic-tint', 'detailing', true],
  ['paint-protection-film', 'detailing', true],
  ['ppf-high-impact', 'detailing', true],
]

describe('which services count (detailing and up, never carwash)', () => {
  for (const [slug, pay_category, expected] of catalog) {
    it(`${slug} → ${expected ? 'counts' : 'does not count'}`, () => {
      assert.equal(isReferralEligibleService({ slug, pay_category }), expected)
    })
  }

  it('the database flag wins over the slug rule', () => {
    assert.equal(isReferralEligibleService({ slug: 'premium-car-wash', pay_category: 'wash', referral_eligible: true }), true)
    assert.equal(isReferralEligibleService({ slug: 'ceramic-coating', pay_category: 'detailing', referral_eligible: false }), false)
  })
})

describe('settings', () => {
  it('ships off, with 3-day rewards and a cap of 5', () => {
    assert.equal(REFERRAL_DEFAULTS.enabled, false)
    assert.equal(REFERRAL_DEFAULTS.validity_days, 3)
    assert.equal(REFERRAL_DEFAULTS.yearly_cap, 5)
  })

  it('follows the row when it changes (validity is a settings edit, not code)', () => {
    const s = normalizeReferralSettings({ enabled: true, validity_days: 30, yearly_cap: 2, reward_kind: 'percent_off', reward_value: 20 })
    assert.equal(s.validity_days, 30)
    assert.equal(s.yearly_cap, 2)
    assert.equal(s.reward_kind, 'percent_off')
    assert.equal(validityPhrase(s.validity_days), '30 days')
    assert.equal(validityPhrase(1), '1 day')
  })

  it('falls back to defaults for junk', () => {
    const s = normalizeReferralSettings({ validity_days: -4, yearly_cap: 'x', reward_label: '  ', eligible_services: [] })
    assert.equal(s.enabled, false)
    assert.equal(s.validity_days, 3)
    assert.equal(s.yearly_cap, 5)
    assert.equal(s.reward_label, 'Detailing reward')
    assert.ok(s.eligible_services.length > 0)
  })

  it('never lists Carwash as counting', () => {
    assert.ok(!REFERRAL_DEFAULTS.eligible_services.includes('Carwash'))
    assert.ok(REFERRAL_DEFAULTS.excluded_services.includes('Carwash'))
  })
})

describe('codes and links', () => {
  it('builds FIRSTNAME-XXX without ambiguous characters', () => {
    const code = makeReferralCode('Kirk Orino', () => 0.5)
    assert.match(code, /^KIRK-[A-HJ-NP-Z2-9]{3}$/)
    assert.equal(normalizeReferralCode(code), code)
    assert.match(makeReferralCode('José', () => 0), /^JOSE-/)
    assert.match(makeReferralCode('', () => 0), /^HAKUM-/)
  })

  it('rejects malformed codes', () => {
    assert.equal(normalizeReferralCode('kirk-7q2'), 'KIRK-7Q2')
    assert.equal(normalizeReferralCode('KIRK-0O1'), '')
    assert.equal(normalizeReferralCode('<script>'), '')
    assert.equal(normalizeReferralCode(''), '')
  })

  it('makes a /r/ link on the given origin', () => {
    assert.equal(referralLink('KIRK-7Q2', 'https://x.vercel.app/'), 'https://x.vercel.app/r/KIRK-7Q2')
    assert.equal(referralLink('bad'), '')
  })

  it('remembers a code for sign-up and survives storage failures', () => {
    const mem = new Map()
    const store = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null, removeItem: (k) => mem.delete(k) }
    assert.equal(rememberReferralCode('kirk-7q2', store), 'KIRK-7Q2')
    assert.equal(readReferralCode(store), 'KIRK-7Q2')
    const broken = { setItem() { throw new Error('private') }, getItem() { throw new Error('private') } }
    assert.equal(rememberReferralCode('KIRK-7Q2', broken), 'KIRK-7Q2')
    assert.equal(readReferralCode(broken), '')
  })

  it('explains why a friend is still waiting', () => {
    assert.match(referralStatusLine({ status: 'pending', waiting_reason: 'carwash_only' }), /Carwash doesn’t count/)
    assert.match(referralStatusLine({ status: 'pending', waiting_reason: 'no_visit' }), /first detailing/)
    assert.match(referralStatusLine({ status: 'qualified' }), /in Rewards/)
  })
})

describe('POS: a reward only goes on detailing and up', () => {
  const ids = { wash: 'svc-wash', interior: 'svc-int', tint: 'svc-tint' }
  const eligible = new Set([ids.interior, ids.tint])
  const line = (key, id, price, extra = {}) => ({ key, id, item_type: 'service', name: key, quantity: 1, list_price_minor: price, unit_price_minor: price, price_minor: price, ...extra })
  const reward = { id: 'rw-1' }
  const amount = { reward_kind: 'amount_off', reward_value: 50000 }

  it('refuses carwash and points at detailing', () => {
    assert.match(referralRewardLineError(line('wash', ids.wash, 35000), eligible), /not carwash/)
    const res = applyReferralRewardToCart([line('wash', ids.wash, 35000)], 'wash', { reward, settings: amount, eligibleServiceIds: eligible })
    assert.equal(res.ok, false)
  })

  it('applies to interior detailing with a reason the sale checks accept', () => {
    const res = applyReferralRewardToCart([line('wash', ids.wash, 35000), line('int', ids.interior, 250000)], 'int', {
      reward,
      settings: amount,
      eligibleServiceIds: eligible,
    })
    assert.equal(res.ok, true)
    const applied = res.cart.find((l) => l.key === 'int')
    assert.equal(applied.unit_price_minor, 200000)
    assert.equal(applied.referral_reward_id, 'rw-1')
    assert.equal(applied.adhoc_discount_reason, REFERRAL_DISCOUNT_REASON)
    assert.equal(res.cart.find((l) => l.key === 'wash').unit_price_minor, 35000)
    assert.deepEqual(validatePosLinePrice(applied, { services: [{ id: ids.interior, price_minor: 250000 }] }), { ok: true })
  })

  it('one reward per sale', () => {
    const first = applyReferralRewardToCart([line('int', ids.interior, 250000), line('tint', ids.tint, 1300000)], 'int', { reward, settings: amount, eligibleServiceIds: eligible })
    const second = applyReferralRewardToCart(first.cart, 'tint', { reward: { id: 'rw-2' }, settings: amount, eligibleServiceIds: eligible })
    assert.equal(second.ok, false)
  })

  it('keeps queue/board tickets at their floor amount (crew pay)', () => {
    assert.match(referralRewardLineError(line('t', ids.tint, 1300000, { from_handoff: true }), eligible), /queue ticket/)
  })

  it('needs quantity 1 and an undiscounted, paid line', () => {
    assert.match(referralRewardLineError(line('i', ids.interior, 250000, { quantity: 2 }), eligible), /quantity to 1/)
    assert.match(referralRewardLineError(line('i', ids.interior, 0, { is_loyalty_award: true }), eligible), /already free/)
    assert.match(referralRewardLineError(line('i', ids.interior, 200000, { adhoc_discount_applied: true }), eligible), /already has a discount/)
  })

  it('caps the amount at the price; percent rounds', () => {
    assert.equal(referralRewardMinor(30000, amount), 30000)
    assert.equal(referralRewardMinor(250000, { reward_kind: 'percent_off', reward_value: 15 }), 37500)
    assert.equal(referralRewardMinor(250000, { reward_kind: 'amount_off', reward_value: 0 }), 0)
  })

  it('refuses when the reward value is not set yet', () => {
    const res = applyReferralRewardToCart([line('int', ids.interior, 250000)], 'int', { reward, settings: { reward_kind: 'amount_off', reward_value: 0 }, eligibleServiceIds: eligible })
    assert.equal(res.ok, false)
  })

  it('an ad-hoc discount leaves the reward line alone', () => {
    const withReward = applyReferralRewardToCart([line('int', ids.interior, 250000), line('m', ids.wash, 35000)], 'int', { reward, settings: amount, eligibleServiceIds: eligible }).cart
    const pct = applyAdHocDiscount(withReward, { percent: 10, reason: 'Manager comp' })
    assert.equal(pct.cart.find((l) => l.key === 'int').unit_price_minor, 200000)
  })

  it('repricing (customer changed) drops the reward', () => {
    const withReward = applyReferralRewardToCart([line('int', ids.interior, 250000)], 'int', { reward, settings: amount, eligibleServiceIds: eligible }).cart
    const repriced = priceCartForMembership(withReward, { membershipsEnabled: false })
    assert.equal(repriced[0].referral_reward_id, undefined)
    assert.equal(repriced[0].unit_price_minor, 250000)
  })

  it('the sale payload carries the reduced price', () => {
    const cart = applyReferralRewardToCart([line('int', ids.interior, 250000)], 'int', { reward, settings: amount, eligibleServiceIds: eligible }).cart
    const payload = buildPosSalePayload({ branch: 'banilad', customerId: 'c1', paymentMethod: 'cash', cart, discountReason: REFERRAL_DISCOUNT_REASON, discountMinor: 50000 })
    assert.equal(payload.lines[0].unit_price_minor, 200000)
    assert.equal(payload.discount_reason, REFERRAL_DISCOUNT_REASON)
  })
})

describe('change-proofing: decisions live in one place', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  function walk(dir, acc = []) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full, acc)
      else if (/\.(jsx?|mjs)$/.test(name)) acc.push(full)
    }
    return acc
  }
  const files = walk(join(root, 'src'))

  it('"free carwash" is written only in birthdayPerk.js', () => {
    const offenders = files.filter((f) => !f.endsWith('birthdayPerk.js') && /free carwash/i.test(readFileSync(f, 'utf8')))
    // The floor board's "free carwash crew" means idle wash staff, not the gift.
    const allowed = offenders.filter((f) => /SuperAdminFloorBoard/.test(f))
    assert.deepEqual(offenders.filter((f) => !allowed.includes(f)).map((f) => f.slice(root.length)), [])
  })

  it('no customer surface hard-codes the 3-day validity', () => {
    const offenders = files.filter((f) => /refer/i.test(f) && !f.endsWith('referral.js') && /\b3[\s-]days?\b/i.test(readFileSync(f, 'utf8')))
    assert.deepEqual(offenders.map((f) => f.slice(root.length)), [])
  })
})
