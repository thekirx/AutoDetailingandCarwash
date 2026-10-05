import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ROLES, getBranchScopeList } from '../src/auth/permissions.js'
import { filterBranchesForProfile, resolveBranchFilter } from '../src/queue/queueLogic.js'
import { buildHomeBranchCards } from '../src/lib/homeBranches.js'
import { isStaffAssignableBranch } from '../src/lib/branchAssignable.js'
import { showBranchPicker, usesMultiBranch } from '../src/lib/peopleDirectory.js'
import {
  validateProvisionStaffInput,
  validateStaffUpdate,
  validateBranchInput,
} from '../src/lib/opsValidation.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('future branch readiness', () => {
  it('scopes a Branch Admin on a not-yet-open city the same as Bacoor', () => {
    const p = { role: ROLES.ADMIN, branch_slug: 'dasmarinas', branch_slugs: ['dasmarinas'] }
    const catalog = [
      { slug: 'bacoor', name: 'Bacoor' },
      { slug: 'batangas', name: 'Batangas' },
      { slug: 'dasmarinas', name: 'Dasmariñas' },
    ]
    assert.deepEqual(getBranchScopeList(p), ['dasmarinas'])
    assert.deepEqual(
      filterBranchesForProfile(catalog, p).map((b) => b.slug),
      ['dasmarinas'],
    )
    assert.equal(resolveBranchFilter(p, 'all'), 'dasmarinas')
  })

  it('homepage cards follow coming_soon from any slug (not a hardcoded city list)', () => {
    const cards = buildHomeBranchCards([
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor' },
      { slug: 'silang-east', name: 'Hakum Auto Care Silang', coming_soon: true },
    ])
    assert.equal(cards.length, 2)
    assert.equal(cards[1].isComingSoon, true)
    assert.equal(cards[1].href, null)
  })

  it('allows hiring onto coming-soon branches; rejects archived', () => {
    assert.equal(isStaffAssignableBranch({ is_active: false, coming_soon: true, is_archived: false }), true)
    assert.equal(isStaffAssignableBranch({ is_active: true, coming_soon: false, is_archived: false }), true)
    assert.equal(isStaffAssignableBranch({ is_active: false, coming_soon: false, is_archived: false }), false)
    assert.equal(isStaffAssignableBranch({ is_active: true, coming_soon: false, is_archived: true }), false)
  })

  it('People form requires a branch for detailer and video editor', () => {
    assert.equal(showBranchPicker('detailer'), true)
    assert.equal(showBranchPicker('video_editor'), true)
    assert.equal(showBranchPicker('investor'), false)
    assert.equal(usesMultiBranch('admin'), true)
    assert.equal(usesMultiBranch('detailer'), false)
  })

  it('provision / edit validation accepts floor roles the server can create', () => {
    const det = validateProvisionStaffInput({
      email: 'detailer.dasma@hakum.test',
      full_name: 'Dasma Detailer',
      role: 'detailer',
      branch_slug: 'dasmarinas',
    })
    assert.equal(det.role, 'detailer')
    assert.equal(det.branch_slug, 'dasmarinas')

    const vid = validateStaffUpdate({
      id: 'x',
      full_name: 'Vid',
      role: 'video_editor',
      branch_slug: 'dasmarinas',
    })
    assert.equal(vid.role, 'video_editor')

    assert.throws(
      () =>
        validateProvisionStaffInput({
          email: 'no-branch@hakum.test',
          full_name: 'No Branch',
          role: 'detailer',
          branch_slug: '',
        }),
      /Branch is required/,
    )
  })

  it('branch slug validation prefers a real future city example', () => {
    const v = validateBranchInput({
      name: 'Hakum Auto Care Dasmariñas',
      slug: 'dasmarinas',
      code: 'DAS',
      status: 'coming_soon',
    })
    assert.equal(v.slug, 'dasmarinas')
    assert.equal(v.coming_soon, true)
    assert.equal(v.is_active, false)
    const src = readFileSync(join(root, 'src/lib/opsValidation.js'), 'utf8')
    assert.match(src, /dasmarinas/)
    assert.doesNotMatch(src, /e\.g\. imus/)
  })

  it('provisionStaff accepts coming-soon branches (source seam)', () => {
    const src = readFileSync(join(root, 'server/provisionStaff.mjs'), 'utf8')
    assert.match(src, /isStaffAssignableBranch/)
    assert.match(src, /coming_soon/)
    assert.match(src, /Branch not found or not assignable/)
  })
})
