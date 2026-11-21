import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { requireActiveStaff, resolveActiveStaff } from '../server/staffAuth.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

function fakeStaffDb({ authUser = { id: 'staff-1' }, staffRow = null, assigns = [] } = {}) {
  const eqCalls = []
  const db = {
    auth: {
      getUser: async () => ({
        data: authUser ? { user: authUser } : { user: null },
        error: authUser ? null : new Error('invalid token'),
      }),
    },
    from(table) {
      const chain = {
        select: () => chain,
        eq: (col, val) => {
          eqCalls.push([table, col, val])
          return chain
        },
        maybeSingle: async () => ({
          data: table === 'staff_profiles' ? staffRow : null,
          error: null,
        }),
        then: (cb) =>
          Promise.resolve({
            data: table === 'staff_branch_assignments' ? assigns : [],
            error: null,
          }).then(cb),
      }
      return chain
    },
  }
  return { db, eqCalls }
}

const DELEGATING_AUTH_MODULES = [
  'server/busybeeApi.mjs',
  'server/customerAdminApi.mjs',
  'server/customerHistoryApi.mjs',
  'server/lifecycleSmsApi.mjs',
  'server/notificationBroadcastKindsApi.mjs',
  'server/notificationSettingsApi.mjs',
  'server/notificationTemplatesApi.mjs',
  'server/notifyOpsEventApi.mjs',
  'server/notifyPlannerApi.mjs',
  'server/notifyPosApi.mjs',
  'server/posAnnounceApi.mjs',
  'server/publicInquiry.mjs',
  'server/pushApi.mjs',
  'server/scheduledRun.mjs',
  'server/sendFinanceQuote.mjs',
  'server/smartSearchApi.mjs',
  'server/smsTemplatesApi.mjs',
  'server/vehicleTransferApi.mjs',
]

describe('server staffAuth deepening & archived-staff blocking', () => {
  it('resolveActiveStaff filters is_active=true AND is_archived=false and returns null when empty', async () => {
    const missing = await resolveActiveStaff(fakeStaffDb().db, '')
    assert.equal(missing, null)

    const archived = fakeStaffDb({ staffRow: null })
    const res = await resolveActiveStaff(archived.db, 'jwt-archived')
    assert.equal(res, null)
    assert.ok(archived.eqCalls.some(([t, c, v]) => t === 'staff_profiles' && c === 'is_active' && v === true))
    assert.ok(archived.eqCalls.some(([t, c, v]) => t === 'staff_profiles' && c === 'is_archived' && v === false))

    const direct = fakeStaffDb({ staffRow: { id: 's-2', role: 'admin', is_active: true } })
    const row = await resolveActiveStaff(direct.db, null, { userId: 's-2', select: 'id, role, is_active' })
    assert.equal(row?.id, 's-2')
    assert.ok(direct.eqCalls.some(([t, c, v]) => t === 'staff_profiles' && c === 'id' && v === 's-2'))
    assert.ok(direct.eqCalls.some(([t, c, v]) => t === 'staff_profiles' && c === 'is_archived' && v === false))
  })

  it('requireActiveStaff throws 401 when unauthenticated and 403 for archived/missing staff', async () => {
    await assert.rejects(
      () => requireActiveStaff(fakeStaffDb().db, ''),
      (err) => err?.status === 401,
    )
    const archived = fakeStaffDb({ staffRow: null })
    await assert.rejects(
      () => requireActiveStaff(archived.db, 'jwt-archived'),
      (err) => err?.status === 403,
    )
  })

  it('all server API auth modules delegate staff lookup to staffAuth.mjs instead of inline staff_profiles auth queries', () => {
    for (const file of DELEGATING_AUTH_MODULES) {
      const src = read(file)
      assert.match(src, /from '\.\/staffAuth\.mjs'/, `${file} must import staffAuth.mjs`)
      if (file === 'server/smartSearchApi.mjs') {
        assert.match(src, /requireActiveStaff/)
      } else {
        assert.doesNotMatch(
          src,
          /\.from\(\s*['"]staff_profiles['"]\s*\)/,
          `${file} must not inline .from('staff_profiles') auth lookups`,
        )
      }
    }

    const birthday = read('server/staffBirthdayGreetings.mjs')
    assert.match(birthday, /\.eq\(\s*['"]is_archived['"]\s*,\s*false\s*\)/)
  })
})
