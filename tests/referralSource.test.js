import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { friendCodeAccountError, normalizeReferral, rankReferrals, referralRequiredError, referralStaffOptionLabel } from '../src/lib/referralSource.js'
import { mintReferralCode, referrerDiscountMinor } from '../src/lib/friendReferral.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')
const crew = [{ id: 's1', full_name: 'Mia Santos', label: 'Mia Santos · Bacoor' }]

describe('booking referral source', () => {
  it('requires a source, and a name only for Hakum staff', () => {
    assert.match(referralRequiredError({}), /where you heard/)
    assert.equal(referralRequiredError({ referral_source: 'social_media' }), '')
    assert.match(referralRequiredError({ referral_source: 'talked_to_employee' }), /employee or type/)
    assert.match(referralRequiredError({ referral_source: 'friend_referral', referred_by_name: 'ab' }), /friend/)
    assert.equal(referralRequiredError({ referral_source: 'friend_referral', referred_by_name: 'hk4k2m9p' }), '')
  })

  it('fills the crew id when the typed name matches, and drops the name for other sources', () => {
    const hit = normalizeReferral({ source: 'talked_to_employee', name: 'Mia Santos · Bacoor', staff: crew })
    assert.equal(hit.referred_by_staff_id, 's1')
    assert.equal(hit.referred_by_name, 'Mia Santos')
    const miss = normalizeReferral({ source: 'talked_to_employee', name: 'Walk-in cousin', staff: crew })
    assert.equal(miss.referred_by_staff_id, null)
    assert.equal(miss.referred_by_name, 'Walk-in cousin')
    const social = normalizeReferral({ source: 'social_media', name: 'Mia Santos', staff: crew })
    assert.equal(social.referred_by_name, null)
    assert.equal(social.referred_by_staff_id, null)
    const friend = normalizeReferral({ source: 'friend_referral', name: ' hk-4k 2m9p ' })
    assert.equal(friend.referred_by_name, 'HK4K2M9P')
    assert.equal(friend.referred_by_staff_id, null)
    assert.equal(referrerDiscountMinor(100000), 97000)
    assert.equal(mintReferralCode(() => 0), 'HKAAAAAA')
  })

  it('a staff edit keeps the linked customer so a saved friend code can be saved again', () => {
    const board = read('src/pages/BookingBoardPage.jsx')
    const select = board.match(/const BOOKING_ROW_SELECT =\s*'([^']+)'/)
    assert.ok(select, 'booking rows must name their columns')
    assert.match(select[1], /\bcustomer_id\b/)
    assert.match(board, /customer_id: booking\.customer_id/)
  })

  it('a friend code needs the booking customer, and the insert uses that same sentence', () => {
    const sentence = 'Link this booking to a customer account before using a friend code.'
    assert.equal(friendCodeAccountError({ referral_source: 'social_media' }, null), '')
    assert.equal(friendCodeAccountError({ referral_source: 'friend_referral', referred_by_name: 'HK4K2M9P' }, 'cust-1'), '')
    assert.equal(friendCodeAccountError({ referral_source: 'friend_referral', referred_by_name: 'HK4K2M9P' }, null), sentence)
    assert.match(read('server/publicBook.mjs'), /friendCodeAccountError/)
    assert.match(read('src/pages/PublicUtilityPage.jsx'), /friendCodeAccountError/)
    assert.match(read('src/pages/CustomerBookPage.jsx'), /friendCodeAccountError/)
    assert.match(read('src/pages/BookingBoardPage.jsx'), /friendCodeAccountError/)
    assert.match(read('supabase/migrations/20261017190000_friend_referral_on_update.sql'), new RegExp(sentence.replace(/[.]/g, '\\.')))
  })

  it('ranks sources by count and staff names only inside Hakum staff', () => {
    const ranked = rankReferrals([
      { referral_source: 'social_media' },
      { referral_source: 'social_media' },
      { referral_source: 'talked_to_employee', referred_by_name: 'Mia Santos' },
      { referral_source: null },
    ])
    assert.equal(ranked.answered, 3)
    assert.equal(ranked.total, 4)
    assert.equal(ranked.sources[0].id, 'social_media')
    assert.equal(ranked.sources[0].count, 2)
    assert.equal(ranked.staff[0].name, 'Mia Santos')
    assert.equal(ranked.staff[0].share, 1)
    assert.equal(referralStaffOptionLabel({ full_name: 'Mia Santos', role: 'staff', branch_slug: 'bacoor' }, { bacoor: 'Bacoor' }), 'Mia Santos · Bacoor')
    assert.equal(referralStaffOptionLabel({ full_name: 'Ana Cruz', role: 'admin' }), 'Ana Cruz · Admin')
  })

  it('is on the customer, public, and staff booking forms, and on the SA and ASA boards', () => {
    for (const file of ['src/pages/CustomerBookPage.jsx', 'src/pages/PublicUtilityPage.jsx', 'src/pages/BookingBoardPage.jsx']) {
      assert.match(read(file), /Where did you hear about us\?|ReferralSourceFields/)
    }
    assert.match(read('src/pages/SuperAdminFloorBoard.jsx'), /ReferralRank/)
    assert.match(read('src/pages/OperationsPages.jsx'), /isAssistantSuperAdmin\(profile\)/)
    assert.match(read('server/dataCenter.mjs'), /select\('\*'\)/)
  })
})
