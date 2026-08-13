/**
 * C8: staff may submit planner proof (in_progress → for_review).
 * Seam: guard_plan_card_assignee_self_update in the follow-up migration.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { allowedStaffPlanAssigneePatch } from '../src/queue/staffTaskLogic.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('planner proof transitions', () => {
  it('client allows in_progress → for_review with proof fields', () => {
    const patch = allowedStaffPlanAssigneePatch(
      { status: 'in_progress', card_id: 'c', staff_id: 's' },
      {
        status: 'for_review',
        card_id: 'c',
        staff_id: 's',
        proof_url: 'https://example.com/p',
        proof_note: 'done',
      },
    )
    assert.equal(patch.status, 'for_review')
    assert.equal(patch.proof_url, 'https://example.com/p')
    assert.equal(patch.proof_note, 'done')
  })

  it('DB guard allows for_review in the proof migration', async () => {
    const sql = await readFile(
      join(root, 'supabase/migrations/20260813121000_planner_proof_transitions.sql'),
      'utf8',
    )
    assert.match(sql, /guard_plan_card_assignee_self_update/)
    assert.match(sql, /for_review/)
    assert.match(sql, /in_progress' and new\.status in \('for_review', 'done'\)/)
  })
})
