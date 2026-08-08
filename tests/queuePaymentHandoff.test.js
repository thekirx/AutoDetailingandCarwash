import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

/** Contract: TL handoff → for_payment + pos_handoffs; Admin/ASA/SA can complete POS. */
describe('Queue payment handoff contract', () => {
  it('send_queue_ticket_to_payment allows TL, admin, ASA(+queue_all), Super Admin with branch gate', async () => {
    const migrations = await Promise.all([
      readFile(projectFile('supabase/migrations/20260808120000_queue_payment_handoff_roles.sql'), 'utf8').catch(() => ''),
      readFile(projectFile('supabase/migrations/20260715153235_crew_kpi_dynamic_branches.sql'), 'utf8'),
    ])
    const latest = migrations[0] || migrations[1]
    assert.match(latest, /send_queue_ticket_to_payment/)
    assert.match(latest, /assistant_super_admin/)
    assert.match(latest, /asa_has_grant\('queue_all'\)/)
    assert.match(latest, /user_has_branch_access/)
    assert.match(latest, /'team_lead'/)
    assert.match(latest, /'admin'/)
    assert.match(latest, /'BossMich'/)
    assert.match(latest, /status = 'for_payment'/)
    assert.match(latest, /pos_handoffs/)
  })

  it('complete_pos_sale scopes Admin via user_has_branch_access (multi-branch safe)', async () => {
    const sql = await readFile(
      projectFile('supabase/migrations/20260808120000_queue_payment_handoff_roles.sql'),
      'utf8',
    ).catch(() => '')
    assert.ok(sql, 'migration 20260808120000_queue_payment_handoff_roles.sql must exist')
    assert.match(sql, /complete_pos_sale/)
    assert.match(sql, /user_has_branch_access\(v_branch\)/)
    assert.match(sql, /assistant_super_admin/)
    assert.match(sql, /asa_has_grant\('pos'\)/)
  })

  it('booking-status API creates POS handoff when status is for_payment', async () => {
    const src = await readFile(projectFile('server/bookingStatus.mjs'), 'utf8')
    assert.match(src, /for_payment/)
    assert.match(src, /send_queue_ticket_to_payment/)
  })

  it('queue client final-check calls payment RPC without lingering in final_checking', async () => {
    const api = await readFile(projectFile('src/queue/queueApi.js'), 'utf8')
    assert.match(api, /if \(nextStatus === 'final_checking'\)/)
    assert.match(api, /await sendTicketToPayment\(ticket\.booking_id\)/)
    assert.match(api, /Never write status=final_checking first/)
    assert.match(api, /send_queue_ticket_to_payment/)
    assert.doesNotMatch(
      api,
      /patch\.final_checking_at[\s\S]*await sendTicketToPayment/,
    )
  })

  it('RPC migration accepts in_progress and lands on for_payment', async () => {
    const sql = await readFile(
      projectFile('supabase/migrations/20260808150000_final_check_atomic_to_payment.sql'),
      'utf8',
    )
    assert.match(sql, /'in_progress', 'final_checking', 'for_payment', 'completed'/)
    assert.match(sql, /from_status in \('in_progress', 'final_checking'\)/)
    assert.match(sql, /set status = 'for_payment'/)
  })

  it('TL UI labels handoff to Admin/ASA not cashier', async () => {
    const editor = await readFile(projectFile('src/components/QueueTicketEditor.jsx'), 'utf8')
    const controls = await readFile(projectFile('src/lib/uiDeadControls.js'), 'utf8')
    assert.match(controls, /Send to payment \(Admin \/ ASA\)/)
    assert.match(editor, /Branch Admin or ASA opens POS/)
    assert.doesNotMatch(editor, /Cashier opens POS/)
  })

  it('payment handoff helpers gate for_payment correctly', async () => {
    const { isPaymentHandoffStatus, canEnterPaymentHandoff } = await import('../server/queuePaymentHandoff.mjs')
    assert.equal(isPaymentHandoffStatus('for_payment'), true)
    assert.equal(isPaymentHandoffStatus('waiting'), false)
    assert.equal(canEnterPaymentHandoff('final_checking'), true)
    assert.equal(canEnterPaymentHandoff('in_progress'), true)
    assert.equal(canEnterPaymentHandoff('waiting'), false)
  })
})
