import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const page = () => readFile(resolve(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
const api = () => readFile(resolve(root, 'server/bookingStatus.mjs'), 'utf8')

describe('booking board assign-branch + labeled selects', () => {
  it('opens Assign to branch modal for confirmed moves', async () => {
    const jsx = await page()
    assert.match(jsx, /assignBranchDialog/)
    assert.match(jsx, /confirmAssignBranch/)
    assert.match(jsx, /status === 'confirmed' && canAssignBranch/)
    assert.match(jsx, /Assign to branch/)
    assert.match(jsx, /items=\{formBranchItems\}/)
    assert.match(jsx, /items=\{formServiceItems\}/)
    assert.match(jsx, /selectItems\(/)
    assert.match(jsx, /preferredBranchSlug/)
    assert.match(jsx, /branchNameBySlug/)
  })

  it('booking-status API accepts branch reassignment for Sales/SA', async () => {
    const mjs = await api()
    assert.match(mjs, /Only Sales or Super Admin can assign a branch/)
    assert.match(mjs, /patch\.branch = nextBranch/)
    assert.match(mjs, /staff\.role === 'sales'/)
  })
})
